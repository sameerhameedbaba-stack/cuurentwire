import { isPressReleaseMember } from "@/lib/news/coverage-analysis";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import type { Article } from "@/lib/news/types";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * "Coverage at a glance" — the compact, deterministic block under a story's
 * byline. Every line is derived from data the page already holds (member
 * articles, the archive's update history, CurrentWire's first-seen time);
 * a line is emitted only when its input exists, and a single report yields
 * no block at all because "1 report from 1 publication" restates the byline.
 *
 * Wording is deliberate: "first observed" (the earliest publisher timestamp
 * among the coverage we hold) — never "broke the story", which we cannot
 * know; "publications"/"reports" — never "<number> sources", which a
 * production probe regex-anchors in story cards.
 */

/** The slice of an Article this module reads (archived members carry no contentType). */
export type GlanceArticle = Pick<
  Article,
  "source" | "sourceDomain" | "publishedAt" | "contentType"
>;

export interface CoverageGlanceInput {
  articles: GlanceArticle[];
  /** Stored update history (archive), oldest-to-newest; empty without a database. */
  history: StoryUpdateEvent[];
  /** CurrentWire's own first-seen time (archive first_seen_at) when known. */
  firstSeenAt?: string;
}

export type CoverageGlanceKind = "first-observed" | "span" | "counts" | "growth";

export interface CoverageGlanceLine {
  kind: CoverageGlanceKind;
  label: string;
  value: string;
}

export interface CoverageCounts {
  /** Member articles — every report in the cluster. */
  reports: number;
  /** Distinct publisher names among non-press-release members. */
  independentPublications: number;
  pressReleases: number;
  opinionPieces: number;
}

export interface CoverageGrowth {
  from: number;
  to: number;
  /** Minutes from first coverage to the last coverage change; null when unknown. */
  minutes: number | null;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** "47 min", "3h 18m", "2d 3h" — whole units, floor-rounded. */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  if (safe < HOUR_MS) return `${Math.floor(safe / MINUTE_MS)} min`;
  if (safe < DAY_MS) {
    const hours = Math.floor(safe / HOUR_MS);
    const minutes = Math.floor((safe % HOUR_MS) / MINUTE_MS);
    return `${hours}h ${minutes}m`;
  }
  const days = Math.floor(safe / DAY_MS);
  const hours = Math.floor((safe % DAY_MS) / HOUR_MS);
  return `${days}d ${hours}h`;
}

function timeOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The earliest-published member; ties keep member order (the lead is first).
 * Members with an unparseable timestamp never win.
 */
export function firstObserved(articles: GlanceArticle[]): GlanceArticle | null {
  let best: GlanceArticle | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const article of articles) {
    const ms = timeOf(article.publishedAt);
    if (ms === null || ms >= bestMs) continue;
    best = article;
    bestMs = ms;
  }
  return best;
}

/** Earliest-to-latest publisher timestamp across members, in ms (0 when unknown). */
export function coverageSpanMs(articles: GlanceArticle[]): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const article of articles) {
    const ms = timeOf(article.publishedAt);
    if (ms === null) continue;
    if (ms < min) min = ms;
    if (ms > max) max = ms;
  }
  return max > min ? max - min : 0;
}

export function coverageCounts(articles: GlanceArticle[]): CoverageCounts {
  const publications = new Set<string>();
  let pressReleases = 0;
  let opinionPieces = 0;
  for (const article of articles) {
    if (isPressReleaseMember(article)) {
      pressReleases += 1;
      continue;
    }
    if (article.source) publications.add(article.source);
    if (article.contentType === "opinion") opinionPieces += 1;
  }
  return {
    reports: articles.length,
    independentPublications: publications.size,
    pressReleases,
    opinionPieces,
  };
}

/**
 * Net coverage growth recorded in the history: the first coverage_change's
 * `from` to the last one's `to`, timed from first coverage (`since`) to the
 * last event. Null when nothing grew — a history that only shrank or
 * oscillated back is not growth, and the timeline already shows it.
 */
export function coverageGrowth(
  history: StoryUpdateEvent[],
  since: string | undefined,
): CoverageGrowth | null {
  const changes = history
    .filter(
      (event): event is Extract<StoryUpdateEvent, { kind: "coverage_change" }> =>
        event.kind === "coverage_change",
    )
    .sort((a, b) => (timeOf(a.at) ?? 0) - (timeOf(b.at) ?? 0));
  const first = changes[0];
  const last = changes[changes.length - 1];
  if (!first || !last || last.to <= first.from) return null;
  const sinceMs = timeOf(since);
  const lastMs = timeOf(last.at);
  const minutes =
    sinceMs !== null && lastMs !== null && lastMs > sinceMs
      ? Math.floor((lastMs - sinceMs) / MINUTE_MS)
      : null;
  return { from: first.from, to: last.to, minutes };
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The counts sentence: "3 reports from 2 independent publications, 1 press release". */
export function formatCoverageCounts(counts: CoverageCounts): string {
  const parts = [
    `${plural(counts.reports, "report")} from ${plural(counts.independentPublications, "independent publication")}`,
  ];
  if (counts.pressReleases > 0) parts.push(plural(counts.pressReleases, "press release"));
  if (counts.opinionPieces > 0) parts.push(plural(counts.opinionPieces, "opinion piece"));
  return parts.join(", ");
}

/** "1 → 3 publications in 47 min" (the duration is omitted when unknown). */
export function formatCoverageGrowth(growth: CoverageGrowth): string {
  const base = `${growth.from} → ${plural(growth.to, "publication")}`;
  return growth.minutes !== null && growth.minutes >= 1
    ? `${base} in ${formatDuration(growth.minutes * MINUTE_MS)}`
    : base;
}

/**
 * All lines for the block, in display order. Empty for a single report
 * (every line would restate the byline) and for any line whose input is
 * missing — the caller renders nothing when the list is empty.
 */
export function coverageGlance(input: CoverageGlanceInput): CoverageGlanceLine[] {
  const { articles } = input;
  if (articles.length < 2) return [];
  const lines: CoverageGlanceLine[] = [];

  const first = firstObserved(articles);
  if (first) {
    lines.push({
      kind: "first-observed",
      label: "First observed by CurrentWire",
      value: `${first.source} · ${fullTimestamp(first.publishedAt)}`,
    });
  }

  const spanMs = coverageSpanMs(articles);
  if (spanMs >= MINUTE_MS) {
    lines.push({ kind: "span", label: "Coverage span", value: formatDuration(spanMs) });
  }

  lines.push({ kind: "counts", label: "Coverage", value: formatCoverageCounts(coverageCounts(articles)) });

  const growth = coverageGrowth(input.history, input.firstSeenAt ?? first?.publishedAt);
  if (growth) {
    lines.push({ kind: "growth", label: "Coverage growth", value: formatCoverageGrowth(growth) });
  }
  return lines;
}
