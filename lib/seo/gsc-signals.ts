import signalsFile from "@/data/gsc-url-signals.json";

/**
 * Google Search Console signals for /story/ URLs, read from the committed
 * data/gsc-url-signals.json.
 *
 * The file is written weekly by scripts/gsc-report.mjs (the gsc-bot commit)
 * and lists every /story/ URL that earned at least one impression on the
 * web or news surface in the last 28 days, keyed by the cluster id at the
 * end of the URL, as `[impressions, clicks]` sums across the two surfaces.
 * The app imports it statically, so the weekly commit triggers a deploy and
 * every page sees the same report.
 *
 * The thin-story index policy (lib/seo/story-indexing.ts) consumes it in
 * two ways: a story Google showed to anyone is protected from noindex, and
 * a report older than GSC_SIGNALS_MAX_AGE_DAYS (or the never-run
 * placeholder) counts as NO data, in which case the policy never noindexes
 * anything — absence from a FRESH report is data (Google showed the URL
 * zero times in the window); absence of a report is not.
 *
 * Everything is pure over the parsed file so tests can feed fixtures
 * through createGscSignals; the module-level functions read the committed
 * file once.
 */

/** A report older than this is treated as no data at all. */
export const GSC_SIGNALS_MAX_AGE_DAYS = 14;
/** Impressions (web + news, 28 days) that protect a story from noindex. */
export const GSC_PROTECT_MIN_IMPRESSIONS = 1;

/** The on-disk contract of data/gsc-url-signals.json. */
export interface GscUrlSignalsFile {
  /** When the report was generated; null for the never-run placeholder. */
  generatedAt: string | null;
  window: { startDate: string; endDate: string; days: number } | null;
  surfaces: readonly string[];
  minImpressions: number;
  /** cluster id → [impressions, clicks], highest impressions first. */
  stories: Readonly<Record<string, readonly number[]>>;
}

export interface GscStorySignal {
  impressions: number;
  clicks: number;
}

export interface GscSignals {
  /** Parsed generatedAt, or null when the file is the placeholder or unparseable. */
  generatedAt: Date | null;
  /** True when the report exists and is at most GSC_SIGNALS_MAX_AGE_DAYS old. */
  available(now?: Date): boolean;
  /** The story's 28-day totals, or null when the report never showed it. */
  story(clusterId: string): GscStorySignal | null;
  /**
   * Cluster ids with clicks >= 1 or impressions >= GSC_PROTECT_MIN_IMPRESSIONS,
   * in file order. Memoized — the same array every call; do not mutate it.
   */
  protectedStoryIds(): string[];
  /** generatedAt as written in the file, or "none" — a cache key. */
  version(): string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function parseStorySignal(entry: unknown): GscStorySignal | null {
  if (!Array.isArray(entry) || entry.length < 2) return null;
  return { impressions: finiteCount(entry[0]), clicks: finiteCount(entry[1]) };
}

export function isGscProtected(signal: GscStorySignal): boolean {
  return signal.clicks >= 1 || signal.impressions >= GSC_PROTECT_MIN_IMPRESSIONS;
}

/** Build the signal reader over a parsed signals file (pure; fixtures in tests). */
export function createGscSignals(data: GscUrlSignalsFile): GscSignals {
  const generatedAtMs =
    typeof data.generatedAt === "string" ? Date.parse(data.generatedAt) : Number.NaN;
  const generatedAt = Number.isFinite(generatedAtMs) ? new Date(generatedAtMs) : null;
  const stories: Readonly<Record<string, readonly number[]>> =
    data.stories && typeof data.stories === "object" ? data.stories : {};
  let protectedIds: string[] | null = null;

  return {
    generatedAt,
    available(now: Date = new Date()): boolean {
      if (!generatedAt) return false;
      const ageDays = (now.getTime() - generatedAt.getTime()) / DAY_MS;
      return ageDays <= GSC_SIGNALS_MAX_AGE_DAYS;
    },
    story(clusterId: string): GscStorySignal | null {
      if (!Object.prototype.hasOwnProperty.call(stories, clusterId)) return null;
      return parseStorySignal(stories[clusterId]);
    },
    protectedStoryIds(): string[] {
      if (protectedIds) return protectedIds;
      const ids: string[] = [];
      for (const [clusterId, entry] of Object.entries(stories)) {
        const signal = parseStorySignal(entry);
        if (signal && isGscProtected(signal)) ids.push(clusterId);
      }
      protectedIds = ids;
      return ids;
    },
    version(): string {
      return typeof data.generatedAt === "string" && data.generatedAt.length > 0
        ? data.generatedAt
        : "none";
    },
  };
}

const committedSignals = createGscSignals(signalsFile as GscUrlSignalsFile);

/** True when the committed report is fresh enough to act on (<= 14 days old). */
export function gscSignalsAvailable(now: Date = new Date()): boolean {
  return committedSignals.available(now);
}

/** The committed report's totals for one story, or null when it never showed. */
export function gscStorySignal(clusterId: string): GscStorySignal | null {
  return committedSignals.story(clusterId);
}

/** Stories the committed report protects from noindex (memoized; do not mutate). */
export function gscProtectedStoryIds(): string[] {
  return committedSignals.protectedStoryIds();
}

/** Cache key for anything derived from the committed report. */
export function gscSignalsVersion(): string {
  return committedSignals.version();
}
