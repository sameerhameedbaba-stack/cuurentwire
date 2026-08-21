import type { Metadata } from "next";
import { sql, type SQL } from "drizzle-orm";
import { storyArchive } from "@/lib/database/schema";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import { GSC_PROTECT_MIN_IMPRESSIONS } from "@/lib/seo/gsc-signals";
import { NOINDEX_FOLLOW } from "@/lib/seo/indexing";
import { truncate } from "@/lib/utils/text";

/**
 * Thin single-source story lifecycle (ChatGPT audit §7, revised after the
 * reviewer's "do not noindex merely because a page is single-source after
 * 48–72 hours" note).
 *
 * ~755 story clusters enter the archive per refresh and most of them are
 * one publisher's report that nothing ever corroborates. Once such a page is
 * past its news window and has earned nothing, it adds only a duplicate of
 * the publisher's own page to the index, so the policy keeps it OUT of the
 * index while leaving it online and crawlable (noindex,follow) — never a
 * 404, never a deletion, because the URL may have been linked and the
 * archive is a permanent record.
 *
 * What "earned nothing" means here — a page is PROTECTED (indexable) when
 * ANY of these holds, checked in this order:
 *
 *   1. the policy switch is off (THIN_STORY_NOINDEX=off);
 *   2. its age is unknown (a bad timestamp never costs a page its standing);
 *   3. it is inside the EVALUATION WINDOW — 14 days, not 72 hours:
 *      CurrentWire is young and Google has only just started evaluating
 *      these URLs, so every story keeps its index standing for two weeks
 *      no matter how thin it is;
 *   4. two or more independent publications cover it;
 *   5. it has a recorded update history (headline, coverage or source
 *      events — see countStoryValueEvents);
 *   6. it has corroborated details;
 *   7. it links related or earlier coverage;
 *   8. Google Search Console recorded >= 1 click for it in the last 28-day
 *      report;
 *   9. Search Console recorded >= GSC_PROTECT_MIN_IMPRESSIONS impressions
 *      (web + news) for it in that report;
 *  10. there is NO fresh Search Console report at all (placeholder file or
 *      a report older than GSC_SIGNALS_MAX_AGE_DAYS) — the policy never
 *      noindexes without Google data.
 *
 * Only a mature single-source story with no recorded value that a FRESH
 * report shows with zero impressions answers noindex,follow. Absence from a
 * fresh report is itself data: Google showed the URL to nobody in 28 days.
 *
 * Backlinks are NOT a signal, by necessity rather than choice: there is no
 * backlink data source — the Search Console API has no links endpoint and
 * the project has no paid link index — so the policy cannot tell a linked
 * page from an unlinked one and therefore errs toward index at every step
 * above (wide window, any Google visibility at all, and index whenever the
 * Google data is missing).
 *
 * The Search Console data is the committed data/gsc-url-signals.json,
 * written weekly by scripts/gsc-report.mjs and read through
 * lib/seo/gsc-signals.ts (the weekly commit triggers a deploy, so every
 * page and the archive sitemap see the same report).
 *
 * Everything here is pure. The page decides per request with the signals it
 * already computes plus the story's Search Console row; the archive sitemap
 * approximates the same rule in SQL (see archiveSitemapIndexableSql) so it
 * never advertises a URL that answers noindex.
 */

/**
 * Every story is indexable — regardless of depth or Search Console data —
 * while it is at most this old. Age runs from first coverage (archive
 * first_seen_at when known, else the first publisher time). Two weeks: the
 * 28-day GSC window is published 2–3 days late, so a story needs well over
 * 72 hours before "zero impressions" can mean anything, and a young site's
 * URLs are still being evaluated long after their news window closes.
 */
export const EVALUATION_WINDOW_HOURS = 14 * 24;

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

/** The story's row in the committed Search Console report (lib/seo/gsc-signals.ts). */
export interface StoryGscInput {
  /** True when a fresh report exists (see gscSignalsAvailable). */
  available: boolean;
  /** Web + news impressions in the report's 28-day window; 0 when the URL is absent. */
  impressions: number;
  /** Web + news clicks in the report's 28-day window; 0 when the URL is absent. */
  clicks: number;
}

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
  /** Informational only (recorded in the noindex reason); never changes the decision. */
  hasSummary: boolean;
  gsc: StoryGscInput;
}

export interface StoryIndexDecision {
  index: boolean;
  /** Human-readable rationale, for logs and the integrator's docs — never rendered. */
  reason: string;
}

/**
 * Decide a story page's index standing. See the module comment for the
 * ordered rules; the SQL approximation in archiveSitemapIndexableSql
 * mirrors the window, the publication count, the history and the
 * Search Console protection (it cannot see corroborated details or
 * related coverage, both computed at render time).
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
  // standing: unknown age is treated as inside the window.
  if (!Number.isFinite(input.ageHours)) {
    return { index: true, reason: "age unknown — treated as inside the evaluation window" };
  }
  if (input.ageHours <= EVALUATION_WINDOW_HOURS) {
    return {
      index: true,
      reason: `inside the evaluation window (${Math.floor(input.ageHours)}h <= ${EVALUATION_WINDOW_HOURS}h)`,
    };
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
  if (input.gsc.clicks >= 1) {
    return {
      index: true,
      reason: `${input.gsc.clicks} Search Console click(s) in the last 28-day report`,
    };
  }
  if (input.gsc.impressions >= GSC_PROTECT_MIN_IMPRESSIONS) {
    return {
      index: true,
      reason: `${input.gsc.impressions} Search Console impression(s) in the last 28-day report`,
    };
  }
  if (!input.gsc.available) {
    return {
      index: true,
      reason: "no fresh Search Console data — never noindex without Google data",
    };
  }
  return {
    index: false,
    reason:
      "mature single-source story, no recorded value, 0 Search Console impressions in the last 28-day report" +
      (input.hasSummary ? "" : "; no summary"),
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
 *   first_seen_at > now() - interval '336 hours'   -- evaluation window
 *   OR source_count >= 2                            -- active publications
 *   OR jsonb_array_length(sources) >= 2             -- all-time source union
 *   OR jsonb_array_length(history) > 0              -- recorded update events
 *   OR cluster_id = any($1::text[])                 -- Search Console protected
 *
 * `protectedIds` is the report's protected set (gscProtectedStoryIds()) —
 * the caller only uses this predicate when that report is fresh; without a
 * fresh report the sitemap lists every non-merged story, exactly as the
 * pages then answer. It is bound as ONE text[] parameter (node-postgres
 * serializes a JS array as a Postgres array literal), so an empty set is
 * still valid SQL (`= any('{}')` is simply false).
 *
 * Differences from the TS predicate, accepted on purpose: an archived page
 * counts independent publications over the all-time sources union
 * (archivedStoryToCluster builds its articles from `sources`), so both the
 * stored ACTIVE count and the union length are tested; the union may hold
 * a press release the page does not count, and the history clause counts
 * category_changed events the page ignores — over-inclusion of a URL that
 * answers noindex, rare and harmless to a crawler. Corroborated details and
 * related coverage are render-time signals with no column, so a page
 * indexable only through them is simply not advertised (still crawlable
 * through the links that make it indexable). Composed with the
 * merged_into_cluster_id IS NULL filter by the route.
 */
export function archiveSitemapIndexableSql(protectedIds: readonly string[]): SQL {
  const evaluationWindow = sql.raw(`interval '${EVALUATION_WINDOW_HOURS} hours'`);
  const protectedIdsParam = sql.param<string[], string[]>([...protectedIds]);
  return sql`(${storyArchive.firstSeenAt} > now() - ${evaluationWindow} or ${storyArchive.sourceCount} >= 2 or jsonb_array_length(${storyArchive.sources}) >= 2 or jsonb_array_length(${storyArchive.history}) > 0 or ${storyArchive.clusterId} = any(${protectedIdsParam}::text[]))`;
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
