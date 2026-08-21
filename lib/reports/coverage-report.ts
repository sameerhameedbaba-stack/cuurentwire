import { and, asc, desc, gte, isNull, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { CATEGORIES, CATEGORY_IDS, isCategoryId } from "@/config/categories";
import { ensureArchiveSchema } from "@/lib/database/archive";
import { getDb } from "@/lib/database/client";
import { describeDbError } from "@/lib/database/errors";
import { storyArchive } from "@/lib/database/schema";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import { logger } from "@/lib/utils/logger";
import {
  REPORT_FIRST_WEEK,
  currentWeekIdET,
  previousWeekId,
  weekRangeET,
} from "./weeks";

/**
 * Weekly Media Coverage Report — statistics derived from CurrentWire's OWN
 * coverage dataset (the permanent story_archive), never prose about the
 * week's news.
 *
 * A week's rows are the archive rows whose first_seen_at (when CurrentWire
 * first archived the story — its real publication time on this site) falls
 * inside the ISO week on the US-Eastern calendar (lib/reports/weeks.ts), and
 * whose merged_into_cluster_id is null (a merged row is a duplicate that now
 * redirects to its survivor, so counting it would count one story twice).
 *
 * Part (a) is the pure aggregation; part (b) reads the rows and caches the
 * finished report.
 */

/* ------------------------------------------------------------------------ */
/* (a) Pure aggregation                                                      */
/* ------------------------------------------------------------------------ */

/** The two fields of an archived source ref the report needs. */
export interface WeekRowSource {
  name: string;
  /** Publisher-reported publication time, ISO. */
  publishedAt: string;
}

/** Minimal archive row shape the aggregation works on (ISO strings for dates). */
export interface WeekRow {
  clusterId: string;
  slug: string;
  title: string;
  category: string;
  geography: string;
  contentType: string | null;
  firstSeenAt: string;
  lastPublishedAt: string;
  /** Ranking score at the last archive write — tie-breaker only. */
  rankingScore?: number | null;
  sourceCount: number;
  sources: WeekRowSource[];
  history: StoryUpdateEvent[];
}

export interface StoryRef {
  slug: string;
  title: string;
}

export interface MostCoveredEntry extends StoryRef {
  category: string;
  /**
   * Publications ever recorded on the story (publicationsEver): the stored
   * active source_count, the distinct names in the permanent sources[] union
   * or the peak count in its coverage_change history, whichever is highest.
   * NOT the bare active count: feeds rotate a story out of their windows
   * within hours, so by the time a story leaves the live dataset its active
   * count has usually shrunk back to 1 — the 2026-08-22 audit of W33 found
   * 30 of its 31 multi-publication stories stored with source_count = 1.
   */
  independentPublications: number;
  /** first_seen_at, ISO. */
  firstSeen: string;
  /** First recorded coverage_change.from → last recorded .to; null when none. */
  coverageGrowth: { from: number; to: number } | null;
  /** Minutes from first_seen_at to the refresh that first recorded ≥2 / ≥3. */
  minutesTo2: number | null;
  minutesTo3: number | null;
}

export interface VelocityEntry extends StoryRef {
  minutes: number;
}

export interface PickupEntry extends StoryRef {
  /** First recorded count → highest count recorded inside the window. */
  from: number;
  to: number;
  gained: number;
  /** Minutes from first_seen_at to the refresh that recorded `to`. */
  withinMinutes: number;
}

export interface MixEntry {
  id: string;
  count: number;
  /** Percentage of the week's stories, one decimal. */
  pct: number;
}

export interface PublisherCount {
  name: string;
  stories: number;
}

export interface Concentration {
  /** Share of stories with exactly one / exactly two independent publications. */
  singleSourcePct: number;
  twoSourcePct: number;
  /** Shares with three or more / four or more — overlapping, not buckets. */
  threePlusPct: number;
  fourPlusPct: number;
  /** Share with two or more (= 100 − singleSourcePct, before rounding). */
  multiSourcePct: number;
  medianIndependentPublications: number;
  meanIndependentPublications: number;
}

export interface Delta {
  previous: number;
  current: number;
  delta: number;
}

export interface WeekOverWeek {
  previousWeekId: string;
  stories: Delta;
  multiSourcePct: Delta;
  medianIndependent: Delta;
  topCategory: { previous: string | null; current: string | null };
}

export interface CoverageReport {
  weekId: string;
  totalStories: number;
  /** Distinct publication names across every story's sources[]. */
  distinctPublishers: number;
  mostCovered: MostCoveredEntry[];
  velocity: {
    fastestTo2: VelocityEntry | null;
    fastestTo3: VelocityEntry | null;
    biggest24hPickup: PickupEntry | null;
  };
  categoryMix: MixEntry[];
  geographyMix: MixEntry[];
  contentTypeMix: MixEntry[];
  publisherParticipation: PublisherCount[];
  publishersFirstObserved: PublisherCount[];
  publishersMultiSourceJoins: PublisherCount[];
  concentration: Concentration;
  weekOverWeek: WeekOverWeek | null;
}

export const MOST_COVERED_LIMIT = 15;
export const PUBLISHER_LIST_LIMIT = 15;
export const FIRST_OBSERVED_LIMIT = 10;

/** Geography ids the archive writes (lib/news/types.ts Country); unknown ids are appended. */
const KNOWN_GEOGRAPHIES = ["US", "CA", "US_CA", "GLOBAL_NA", "GLOBAL"] as const;

/** Content-type buckets of the report; archive "analysis" and "live" fold into other. */
export const CONTENT_TYPE_BUCKETS = ["news", "opinion", "press_release", "other"] as const;
export type ContentTypeBucket = (typeof CONTENT_TYPE_BUCKETS)[number];

const PICKUP_WINDOW_MS = 24 * 60 * 60 * 1000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : round1((count / total) * 100);
}

/**
 * Publications ever recorded on a story — the figure every statistic in this
 * report uses for "independent publications":
 *
 *   max(source_count, distinct names in sources[], peak coverage_change count)
 *
 * source_count is the ACTIVE count at the last archive write. Publisher feeds
 * rotate a story out of their windows within hours, so the active list
 * shrinks back towards 1 while the story is still the same story; the
 * permanent sources[] union and the coverage_change history keep what the
 * story actually reached. Measured 2026-08-22 against production
 * (scripts/audit-archive-unions.mjs): W33 had 1 of 1,005 stories with
 * source_count >= 2 but 31 with >= 2 publications in the union — the bare
 * active count under-reported multi-publication coverage ~30×; W34-to-date
 * 46 vs 119 (1.5% vs 3.9%). Rows archived before the union shipped
 * (2026-08-15) carry only their last active list, so for them this is still
 * a floor.
 */
export function publicationsEver(row: WeekRow): number {
  let peak = Math.max(0, row.sourceCount);
  const union = publisherNames(row).length;
  if (union > peak) peak = union;
  for (const event of coverageChanges(row.history)) {
    if (event.to > peak) peak = event.to;
    if (event.from > peak) peak = event.from;
  }
  return peak;
}

/**
 * A story counts as multi-source when publicationsEver is ≥2 — the same
 * definition as the concentration shares, so "multi-source joins" and
 * "2+ publications" always describe the same set of stories.
 */
function isMultiSource(row: WeekRow): boolean {
  return publicationsEver(row) >= 2;
}

/**
 * Press releases are labelled and kept out of CurrentWire's curated modules
 * (Top 100, Most Covered). The report keeps them in the totals and mixes —
 * the share is itself a statistic — but not in the curated tables below.
 */
function isCurated(row: WeekRow): boolean {
  return row.contentType !== "press_release";
}

/** Bucket an archived content_type: null means the conservative default, news. */
export function contentTypeBucket(contentType: string | null): ContentTypeBucket {
  if (contentType === null || contentType === "news") return "news";
  if (contentType === "opinion" || contentType === "press_release") return contentType;
  return "other";
}

/** Distinct trimmed, non-empty publication names on a story, in array order. */
function publisherNames(row: WeekRow): string[] {
  const seen = new Set<string>();
  for (const source of row.sources) {
    const name = typeof source?.name === "string" ? source.name.trim() : "";
    if (name) seen.add(name);
  }
  return [...seen];
}

function coverageChanges(
  history: StoryUpdateEvent[],
): Extract<StoryUpdateEvent, { kind: "coverage_change" }>[] {
  return history
    .filter(
      (event): event is Extract<StoryUpdateEvent, { kind: "coverage_change" }> =>
        event.kind === "coverage_change",
    )
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Whole minutes from `fromIso` to `toIso`, floored at 0 (clock skew must not go negative). */
function minutesBetween(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 60_000));
}

/**
 * Time from first observation to the refresh that first recorded ≥ `target`
 * publications. Defined only when the story was OBSERVED below the target
 * first (the first recorded coverage_change started below it): a story that
 * already had three publications when CurrentWire first saw it did not
 * "reach three" on this site's clock — that is unknown, so null. History is
 * capped at STORY_HISTORY_LIMIT events with the oldest dropped, which can
 * only push this towards null, never invent a time.
 */
function minutesToReach(row: WeekRow, target: number): number | null {
  const changes = coverageChanges(row.history);
  if (changes.length === 0 || changes[0].from >= target) return null;
  const reached = changes.find((event) => event.to >= target);
  return reached ? minutesBetween(row.firstSeenAt, reached.at) : null;
}

/**
 * Net gain in recorded publications inside the first 24 hours after first
 * observation: first recorded count → highest count recorded within the
 * window. Null when nothing was recorded in the window or nothing grew.
 */
function pickupWithin24h(row: WeekRow): PickupEntry | null {
  const changes = coverageChanges(row.history);
  if (changes.length === 0) return null;
  const start = new Date(row.firstSeenAt).getTime();
  if (!Number.isFinite(start)) return null;
  const from = changes[0].from;
  let best: { to: number; at: string } | null = null;
  for (const event of changes) {
    const at = new Date(event.at).getTime();
    if (!Number.isFinite(at) || at - start > PICKUP_WINDOW_MS) continue;
    if (!best || event.to > best.to) best = { to: event.to, at: event.at };
  }
  if (!best || best.to <= from) return null;
  const withinMinutes = minutesBetween(row.firstSeenAt, best.at);
  if (withinMinutes === null) return null;
  return {
    slug: row.slug,
    title: row.title,
    from,
    to: best.to,
    gained: best.to - from,
    withinMinutes,
  };
}

function toMostCoveredEntry(row: WeekRow): MostCoveredEntry {
  const changes = coverageChanges(row.history);
  return {
    slug: row.slug,
    title: row.title,
    category: row.category,
    independentPublications: publicationsEver(row),
    firstSeen: row.firstSeenAt,
    coverageGrowth:
      changes.length > 0
        ? { from: changes[0].from, to: changes[changes.length - 1].to }
        : null,
    minutesTo2: minutesToReach(row, 2),
    minutesTo3: minutesToReach(row, 3),
  };
}

/** publicationsEver desc, then ranking score desc, then earliest first seen, then slug. */
function compareMostCovered(a: WeekRow, b: WeekRow): number {
  return (
    publicationsEver(b) - publicationsEver(a) ||
    (b.rankingScore ?? 0) - (a.rankingScore ?? 0) ||
    a.firstSeenAt.localeCompare(b.firstSeenAt) ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Percentage mix over a fixed vocabulary plus whatever else the rows carry:
 * known ids always appear (zero counts included, so an empty week is all
 * zeros, not an empty list), sorted by count desc then vocabulary order.
 */
function mixOver(
  rows: WeekRow[],
  known: readonly string[],
  idOf: (row: WeekRow) => string,
): MixEntry[] {
  const counts = new Map<string, number>(known.map((id) => [id, 0]));
  for (const row of rows) {
    const id = idOf(row);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const order = [...counts.keys()];
  return order
    .map((id) => ({ id, count: counts.get(id) ?? 0, pct: pct(counts.get(id) ?? 0, rows.length) }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.id) - order.indexOf(b.id));
}

/** Publishers ranked by how many of the given stories they appear on (distinct per story). */
function rankPublishers(
  rows: WeekRow[],
  limit: number,
  namesOf: (row: WeekRow) => string[] = publisherNames,
): PublisherCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const name of namesOf(row)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, stories]) => ({ name, stories }))
    .sort((a, b) => b.stories - a.stories || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * The publication with the earliest publisher-reported publishedAt among the
 * sources CurrentWire observed on the story (ties: the earlier array
 * position, i.e. the lead). This is "first observed by CurrentWire", NEVER
 * "broke the story": feeds lag, and publishers CurrentWire does not track
 * are invisible to it.
 */
function earliestPublisher(row: WeekRow): string | null {
  let best: { name: string; at: number } | null = null;
  for (const source of row.sources) {
    const name = typeof source?.name === "string" ? source.name.trim() : "";
    const at = new Date(source?.publishedAt ?? "").getTime();
    if (!name || !Number.isFinite(at)) continue;
    if (!best || at < best.at) best = { name, at };
  }
  return best?.name ?? null;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function concentrationOf(rows: WeekRow[]): Concentration {
  const total = rows.length;
  const counts = rows.map(publicationsEver).sort((a, b) => a - b);
  const count = (predicate: (n: number) => boolean) => counts.filter(predicate).length;
  const sum = counts.reduce((acc, n) => acc + n, 0);
  return {
    singleSourcePct: pct(count((n) => n <= 1), total),
    twoSourcePct: pct(count((n) => n === 2), total),
    threePlusPct: pct(count((n) => n >= 3), total),
    fourPlusPct: pct(count((n) => n >= 4), total),
    multiSourcePct: pct(count((n) => n >= 2), total),
    medianIndependentPublications: median(counts),
    meanIndependentPublications: total === 0 ? 0 : round1(sum / total),
  };
}

/** The category with the most stories (ties: CATEGORY_IDS order); null for no rows. */
function topCategoryOf(rows: WeekRow[]): string | null {
  const mix = mixOver(rows, CATEGORY_IDS, (row) => row.category);
  const top = mix[0];
  return top && top.count > 0 ? top.id : null;
}

function delta(previous: number, current: number): Delta {
  return { previous, current, delta: round1(current - previous) };
}

/** Velocity extremes over the curated rows: smallest minutes wins, ties by slug. */
function fastest(
  rows: WeekRow[],
  minutesOf: (row: WeekRow) => number | null,
): VelocityEntry | null {
  let best: VelocityEntry | null = null;
  for (const row of rows) {
    const minutes = minutesOf(row);
    if (minutes === null) continue;
    if (!best || minutes < best.minutes || (minutes === best.minutes && row.slug < best.slug)) {
      best = { slug: row.slug, title: row.title, minutes };
    }
  }
  return best;
}

function biggestPickup(rows: WeekRow[]): PickupEntry | null {
  let best: PickupEntry | null = null;
  for (const row of rows) {
    const pickup = pickupWithin24h(row);
    if (!pickup) continue;
    if (
      !best ||
      pickup.gained > best.gained ||
      (pickup.gained === best.gained && pickup.withinMinutes < best.withinMinutes)
    ) {
      best = pickup;
    }
  }
  return best;
}

/**
 * Aggregate one week of archive rows into the report. Pure and deterministic.
 * `previousRows` enables the week-over-week block; null (no previous week to
 * compare against) or an empty previous week yields weekOverWeek = null.
 */
export function aggregateCoverageWeek(
  rows: WeekRow[],
  previousRows: WeekRow[] | null,
  weekId: string,
): CoverageReport {
  const curated = rows.filter(isCurated);
  const multiSource = rows.filter(isMultiSource);
  const publishers = new Set<string>();
  for (const row of rows) for (const name of publisherNames(row)) publishers.add(name);

  const concentration = concentrationOf(rows);
  const previous =
    previousRows && previousRows.length > 0
      ? { rows: previousRows, concentration: concentrationOf(previousRows) }
      : null;
  const prevId = previousWeekId(weekId);

  return {
    weekId,
    totalStories: rows.length,
    distinctPublishers: publishers.size,
    mostCovered: [...curated]
      .sort(compareMostCovered)
      .slice(0, MOST_COVERED_LIMIT)
      .map(toMostCoveredEntry),
    velocity: {
      fastestTo2: fastest(curated, (row) => minutesToReach(row, 2)),
      fastestTo3: fastest(curated, (row) => minutesToReach(row, 3)),
      biggest24hPickup: biggestPickup(curated),
    },
    categoryMix: mixOver(rows, CATEGORY_IDS, (row) => row.category),
    geographyMix: mixOver(rows, KNOWN_GEOGRAPHIES, (row) => row.geography),
    contentTypeMix: mixOver(rows, CONTENT_TYPE_BUCKETS, (row) =>
      contentTypeBucket(row.contentType),
    ),
    publisherParticipation: rankPublishers(rows, PUBLISHER_LIST_LIMIT),
    // Only multi-source stories: being "first" on a story nobody else
    // covered is participation, not a lead.
    publishersFirstObserved: rankPublishers(
      multiSource.filter(isCurated),
      FIRST_OBSERVED_LIMIT,
      (row) => {
        const first = earliestPublisher(row);
        return first ? [first] : [];
      },
    ),
    publishersMultiSourceJoins: rankPublishers(multiSource, PUBLISHER_LIST_LIMIT),
    concentration,
    weekOverWeek:
      previous && prevId
        ? {
            previousWeekId: prevId,
            stories: delta(previous.rows.length, rows.length),
            multiSourcePct: delta(
              previous.concentration.multiSourcePct,
              concentration.multiSourcePct,
            ),
            medianIndependent: delta(
              previous.concentration.medianIndependentPublications,
              concentration.medianIndependentPublications,
            ),
            topCategory: {
              previous: topCategoryOf(previous.rows),
              current: topCategoryOf(rows),
            },
          }
        : null,
  };
}

/** Display label for a stored category id (ids no longer in the taxonomy fall back verbatim). */
export function categoryDisplayLabel(category: string): string {
  if (isCategoryId(category)) return CATEGORIES[category].label;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Meta description of a week page, built only from the report's numbers —
 * deterministic for a frozen week and distinct per week. Says "publications",
 * never "<n> sources" (a production probe regex-anchors that string).
 */
export function describeCoverageReport(report: CoverageReport, weekLabel: string): string {
  const top = report.categoryMix[0];
  const topCategory = top && top.count > 0 ? categoryDisplayLabel(top.id) : null;
  const parts = [
    `CurrentWire's media coverage report for ${weekLabel}: ${report.totalStories.toLocaleString("en-US")} stories across ${report.distinctPublishers.toLocaleString("en-US")} publications`,
    `${report.concentration.multiSourcePct}% covered by 2+ independent publications`,
  ];
  if (topCategory) parts.push(`top category ${topCategory}`);
  return `${parts.join("; ")}.`;
}

/* ------------------------------------------------------------------------ */
/* (b) Database readers                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Hard ceiling on rows per week. The archive gains ~300–480 stories a day
 * (measured 2026-08-21), so a full week is ~2,100–3,400 rows; 5,000 leaves
 * headroom without letting a runaway week pull the whole table.
 */
export const WEEK_ROWS_LIMIT = 5_000;

/** TTLs: a past week is immutable; the current week gains rows every 15-minute refresh. */
const PAST_WEEK_TTL_S = 3_600;
const CURRENT_WEEK_TTL_S = 1_800;

type CompactSourceRow = { name: string | null; publishedAt: string | null }[] | null;

/**
 * Read-through cache, copied from lib/database/briefing.ts cachedRead:
 * unstable_cache shares a result across ISR renders (Neon's transfer quota
 * cannot afford a query per render), and falls back to the raw query
 * outside a Next request scope (vitest, scripts), where unstable_cache
 * throws "Invariant: incrementalCache missing".
 */
function cachedRead<Args extends unknown[], Result>(
  keyPrefix: string,
  ttlSeconds: number,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  const cached = unstable_cache(fn, [keyPrefix], { revalidate: ttlSeconds });
  return async (...args) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("incrementalCache missing")
      ) {
        return fn(...args);
      }
      throw error;
    }
  };
}

/**
 * The week's archive rows, UNCACHED — only ever called inside the cached
 * report builders below. Caching the rows themselves would be pointless:
 * Vercel's Data Cache caps an item at 2 MB and a week of rows carries every
 * story's sources jsonb (url + title per source), several MB uncompressed;
 * the finished report is a few KB. For the same reason the query projects
 * sources down to the two fields the report reads (name, publishedAt),
 * which drops the bulk of the transfer.
 *
 * Empty without a database or for an invalid week id. THROWS on a query
 * error — the callers decide between fail-soft and fail-loud.
 */
export async function loadWeekRows(weekId: string): Promise<WeekRow[]> {
  const range = weekRangeET(weekId);
  if (!range) return [];
  const db = getDb();
  if (!db) return [];
  // The history column is runtime-migrated (ensureArchiveSchema); a database
  // it has not reached yet still serves the report, just without velocity.
  const hasHistory = await ensureArchiveSchema();
  const compactSources = sql<CompactSourceRow>`coalesce((
    select jsonb_agg(jsonb_build_object('name', s->>'name', 'publishedAt', s->>'publishedAt') order by ord)
    from jsonb_array_elements(${storyArchive.sources}) with ordinality as t(s, ord)
  ), '[]'::jsonb)`;
  const rows = await db
    .select({
      clusterId: storyArchive.clusterId,
      slug: storyArchive.slug,
      title: storyArchive.title,
      category: storyArchive.category,
      geography: storyArchive.geography,
      contentType: storyArchive.contentType,
      firstSeenAt: storyArchive.firstSeenAt,
      lastPublishedAt: storyArchive.lastPublishedAt,
      rankingScore: storyArchive.rankingScore,
      sourceCount: storyArchive.sourceCount,
      sources: compactSources,
      history: hasHistory
        ? storyArchive.history
        : sql<StoryUpdateEvent[]>`'[]'::jsonb`,
    })
    .from(storyArchive)
    .where(
      and(
        isNull(storyArchive.mergedIntoClusterId),
        gte(storyArchive.firstSeenAt, new Date(range.startUtcISO)),
        lt(storyArchive.firstSeenAt, new Date(range.endUtcISO)),
      ),
    )
    // Deterministic order so a (never expected) truncation drops the
    // least-covered, latest rows rather than a random subset.
    .orderBy(desc(storyArchive.sourceCount), asc(storyArchive.firstSeenAt))
    .limit(WEEK_ROWS_LIMIT);
  if (rows.length === WEEK_ROWS_LIMIT) {
    logger.warn("reports.week_rows_truncated", { weekId, limit: WEEK_ROWS_LIMIT });
  }
  return rows.map((row) => ({
    clusterId: row.clusterId,
    slug: row.slug,
    title: row.title,
    category: row.category,
    geography: row.geography,
    contentType: row.contentType,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastPublishedAt: row.lastPublishedAt.toISOString(),
    rankingScore: row.rankingScore,
    sourceCount: row.sourceCount,
    sources: (Array.isArray(row.sources) ? row.sources : [])
      .filter((s) => typeof s?.name === "string" && typeof s?.publishedAt === "string")
      .map((s) => ({ name: s.name as string, publishedAt: s.publishedAt as string })),
    history: Array.isArray(row.history) ? row.history : [],
  }));
}

/**
 * Previous-week rows for the week-over-week block, fail-soft: the comparison
 * is an enrichment, so an outage on it must not take the report down. Null
 * when the previous week predates the archive.
 */
async function loadPreviousRowsSoft(weekId: string): Promise<WeekRow[] | null> {
  const prevId = previousWeekId(weekId);
  if (!prevId || prevId < REPORT_FIRST_WEEK) return null;
  try {
    return await loadWeekRows(prevId);
  } catch (error) {
    logger.warn("reports.previous_week_rows_failed", {
      weekId: prevId,
      error: describeDbError(error),
    });
    return null;
  }
}

/** Rows → report, or null when the week has no archived stories (or no database). */
async function buildCoverageReport(weekId: string): Promise<CoverageReport | null> {
  const rows = await loadWeekRows(weekId);
  if (rows.length === 0) return null;
  const previousRows = await loadPreviousRowsSoft(weekId);
  return aggregateCoverageWeek(rows, previousRows, weekId);
}

const getPastWeekReport = cachedRead(
  "coverage-report-week",
  PAST_WEEK_TTL_S,
  buildCoverageReport,
);
const getCurrentWeekReport = cachedRead(
  "coverage-report-current",
  CURRENT_WEEK_TTL_S,
  buildCoverageReport,
);

/**
 * The coverage report for a week id, or null when there is nothing to
 * report (no database, zero rows, malformed id).
 *
 * Failure policy mirrors lib/database/briefing.ts getBriefing: for the
 * CURRENT week a query error is caught OUTSIDE the cache scope (a rejected
 * promise is never cached, so an outage does not freeze a null for 30
 * minutes) and reported as null — the index page renders its honest empty
 * state for one cycle. For a PAST week the error is THROWN so the ISR
 * revalidation fails and the last good page stays up, instead of a real,
 * permanent report being replaced by a 404.
 */
export async function getCoverageReport(
  weekId: string,
  now: Date = new Date(),
): Promise<CoverageReport | null> {
  if (!weekRangeET(weekId)) return null;
  if (weekId === currentWeekIdET(now)) {
    try {
      return await getCurrentWeekReport(weekId);
    } catch (error) {
      logger.warn("reports.current_week_report_failed", {
        weekId,
        error: describeDbError(error),
      });
      return null;
    }
  }
  return getPastWeekReport(weekId);
}
