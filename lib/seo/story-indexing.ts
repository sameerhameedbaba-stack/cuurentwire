import type { Metadata } from "next";
import { sql, type SQL } from "drizzle-orm";
import { storyArchive } from "@/lib/database/schema";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import { NOINDEX_FOLLOW } from "@/lib/seo/indexing";
import { truncate } from "@/lib/utils/text";

/**
 * Thin single-source story lifecycle (ChatGPT audit §7).
 *
 * ~755 story clusters enter the archive per refresh and most of them are
 * one publisher's report that nothing ever corroborates. Once such a page is
 * past the news window it has no CurrentWire-specific value for a searcher:
 * the summary restates one article, the coverage list names one outlet, and
 * the only thing the URL adds to the index is a duplicate of the publisher's
 * own page. The policy below keeps those pages OUT of the index while
 * leaving them online and crawlable (noindex,follow) — never a 404, never a
 * deletion, because the URL may have been linked and the archive is a
 * permanent record.
 *
 * Everything here is pure. The page decides per request with the signals it
 * already computes; the archive sitemap approximates the same rule in SQL
 * (see archiveSitemapIndexableSql) so it never advertises a URL that
 * answers noindex.
 */

/**
 * A story is FRESH — indexable regardless of depth — while it is younger
 * than this. 72h is the live dataset's own window: every story is a live
 * page for that long, and a single report can still attract corroboration
 * inside it (live: coverage grows 1→3 within hours on the stories that
 * grow at all).
 */
export const FRESH_STORY_HOURS = 72;

/**
 * Env switch for the policy. `THIN_STORY_NOINDEX=off` disables it (every
 * story page indexable, archive sitemap unfiltered — the pre-policy
 * behaviour); unset or any other value keeps it on. A string read so the
 * kill switch works from the Vercel dashboard without a deploy.
 */
export function readThinStoryNoindexSwitch(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "off";
}

export const THIN_STORY_NOINDEX_ENABLED = readThinStoryNoindexSwitch(
  process.env.THIN_STORY_NOINDEX,
);

export interface StoryIndexInput {
  /** Hours since first coverage (archive first_seen_at when known, else first publisher time). */
  ageHours: number;
  /** Distinct publisher names among non-press-release coverage. */
  independentPublications: number;
  /** headline_updated + coverage_change + source_added events (see countStoryValueEvents). */
  historyEvents: number;
  /** Details corroborated by two independent sources (coverage-analysis). */
  corroboratedDetails: number;
  /** Related live clusters plus earlier archive coverage linked from the page. */
  relatedCoverage: number;
  hasSummary: boolean;
}

export interface StoryIndexDecision {
  index: boolean;
  /** Human-readable rationale, for logs and the integrator's docs — never rendered. */
  reason: string;
}

/**
 * Index a story page while it is fresh; after that only when the page adds
 * something a single publisher page does not — independent corroboration,
 * a recorded update history, corroborated details or links to related
 * coverage. The SQL approximation in archiveSitemapIndexableSql mirrors the
 * first three signals (it cannot see corroborated details or related
 * coverage, both computed at render time).
 */
export function storyIndexDecision(
  input: StoryIndexInput,
  options: { enabled?: boolean } = {},
): StoryIndexDecision {
  const enabled = options.enabled ?? THIN_STORY_NOINDEX_ENABLED;
  if (!enabled) {
    return { index: true, reason: "thin-story noindex disabled (THIN_STORY_NOINDEX=off)" };
  }
  // An unparseable first-coverage time must never cost a page its index
  // standing: unknown age is treated as fresh.
  if (!Number.isFinite(input.ageHours)) {
    return { index: true, reason: "age unknown — treated as fresh" };
  }
  if (input.ageHours <= FRESH_STORY_HOURS) {
    return { index: true, reason: `fresh story (${Math.floor(input.ageHours)}h <= ${FRESH_STORY_HOURS}h)` };
  }
  if (input.independentPublications >= 2) {
    return { index: true, reason: `${input.independentPublications} independent publications` };
  }
  if (input.historyEvents >= 1) {
    return { index: true, reason: `${input.historyEvents} recorded update event(s)` };
  }
  if (input.corroboratedDetails >= 1) {
    return { index: true, reason: `${input.corroboratedDetails} corroborated detail(s)` };
  }
  if (input.relatedCoverage >= 1) {
    return { index: true, reason: `${input.relatedCoverage} related coverage link(s)` };
  }
  return {
    index: false,
    reason: input.hasSummary
      ? "mature single-source story with no CurrentWire-specific value"
      : "mature single-source story with no CurrentWire-specific value and no summary",
  };
}

/**
 * History events that mean the story page records something a reader cannot
 * get from the publisher: a headline that changed, coverage that grew or
 * shrank, a publication that joined. category_changed is our own
 * reclassification, not story news, so it never counts.
 */
export function countStoryValueEvents(history: StoryUpdateEvent[]): number {
  let count = 0;
  for (const event of history) {
    if (
      event.kind === "headline_updated" ||
      event.kind === "coverage_change" ||
      event.kind === "source_added"
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Apply a decision to page metadata: noindex,follow replaces `robots` (the
 * page-level value replaces the layout's wholesale in this Next version);
 * an index decision leaves the metadata untouched so the page keeps the
 * layout's full indexable directive set.
 */
export function applyStoryIndexDecision(
  metadata: Metadata,
  decision: StoryIndexDecision,
): Metadata {
  if (decision.index) return metadata;
  return { ...metadata, robots: NOINDEX_FOLLOW };
}

/**
 * SQL approximation of storyIndexDecision for the archive sitemap:
 *
 *   first_seen_at > now() - interval '72 hours'   -- FRESH
 *   OR source_count >= 2                           -- independent publications
 *   OR jsonb_array_length(history) > 0             -- recorded update events
 *
 * Differences from the TS predicate, accepted on purpose: source_count is
 * the stored ACTIVE publication count (the page counts the all-time union,
 * which is never smaller, and a count that dropped leaves a coverage_change
 * event behind, so the history clause catches it); the history clause also
 * counts category_changed events the page ignores (over-inclusion of a URL
 * that answers noindex — rare, and harmless to a crawler); corroborated
 * details and related coverage are render-time signals with no column, so
 * a page indexable only through them is simply not advertised (still
 * crawlable through the links that make it indexable). Composed with the
 * merged_into_cluster_id IS NULL filter by the route.
 */
export function archiveSitemapIndexableSql(): SQL {
  const freshInterval = sql.raw(`interval '${FRESH_STORY_HOURS} hours'`);
  return sql`(${storyArchive.firstSeenAt} > now() - ${freshInterval} or ${storyArchive.sourceCount} >= 2 or jsonb_array_length(${storyArchive.history}) > 0)`;
}

/* ------------------------------------------------------------------------ *
 * Daily briefing metadata
 *
 * Shared by /briefing (today's live top stories) and /briefing/[date] (a
 * stored day) so both describe a briefing identically: a title that names
 * the region and the day, and a description that quotes the day's leading
 * headlines instead of standing prose — the day pages used to differ from
 * each other only by the date inside one boilerplate sentence, which gives
 * a searcher nothing to pick a day by.
 * ------------------------------------------------------------------------ */

/** One briefing item as far as metadata is concerned (live cluster or stored row). */
export interface BriefingMetaItem {
  title: string;
  sourceCount: number;
}

/** Google renders roughly 60 characters of a headline before clipping. */
export const BRIEFING_HEADLINE_CHARS = 60;
/** Hard ceiling for the whole description. */
export const BRIEFING_DESCRIPTION_MAX_CHARS = 300;

/** "US & Canada News Briefing — August 21, 2026". */
export function briefingMetaTitle(dayLabel: string): string {
  return `US & Canada News Briefing — ${dayLabel}`;
}

function joinHeadlines(headlines: string[]): string {
  if (headlines.length <= 1) return headlines.join("");
  return `${headlines.slice(0, -1).join(", ")} and ${headlines[headlines.length - 1]}`;
}

/**
 * "Today's US and Canada news briefing covers <h1>, <h2> and <h3> — 10
 * stories ranked from 47 publisher reports." Headlines are truncated at a
 * word boundary to ~60 chars; the leading headlines are dropped one by one
 * if even that overruns the 300-char ceiling. `dayLabel` switches the
 * lead-in to a dated past day. Empty items yield an empty string so the
 * caller can fall back to its standing description.
 */
export function briefingMetaDescription(
  items: BriefingMetaItem[],
  options: { dayLabel?: string } = {},
): string {
  if (items.length === 0) return "";
  const leadIn = options.dayLabel
    ? `The ${options.dayLabel} US and Canada news briefing covers`
    : "Today's US and Canada news briefing covers";
  const reports = items.reduce((sum, item) => sum + Math.max(0, item.sourceCount), 0);
  const tail = `— ${items.length} ${items.length === 1 ? "story" : "stories"} ranked from ${reports} publisher ${reports === 1 ? "report" : "reports"}.`;
  const headlines = items
    .slice(0, 3)
    .map((item) => truncate(item.title.replace(/\s+/g, " ").trim(), BRIEFING_HEADLINE_CHARS))
    .filter((headline) => headline.length > 0);
  for (let keep = headlines.length; keep >= 1; keep--) {
    const candidate = `${leadIn} ${joinHeadlines(headlines.slice(0, keep))} ${tail}`;
    if (candidate.length <= BRIEFING_DESCRIPTION_MAX_CHARS) return candidate;
  }
  return truncate(`${leadIn} ${tail}`, BRIEFING_DESCRIPTION_MAX_CHARS);
}
