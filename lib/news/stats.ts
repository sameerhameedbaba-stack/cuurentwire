import type {
  Article,
  CoverageDistribution,
  FeedHealth,
  FeedValueStat,
  RawArticle,
  StoryCluster,
} from "@/lib/news/types";

/**
 * Measurement helpers for the ingestion run: how independently corroborated
 * the story set is, and what each configured feed actually contributes.
 *
 * Pure and single-pass by design — they run inside every refresh on the
 * Vercel Hobby CPU budget (~755 clusters / ~830 articles / 98 feeds per run,
 * measured 2026-08-21), so nothing here may regex, sort large arrays or
 * allocate per article beyond a Map lookup.
 */

/** Percentage (0–100) of `part` in `whole`, one decimal; 0 when whole is 0. */
function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

/** Ratio (0–1) with three decimals; 0 when the denominator is 0. */
function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000;
}

/**
 * Median of non-negative integer counts via a frequency table — O(n) and no
 * sort of the cluster list (only the ≤ ~20 distinct count values are sorted).
 * Even totals take the mean of the middle pair.
 */
function medianOfCounts(frequency: Map<number, number>, total: number): number {
  if (total === 0) return 0;
  const values = [...frequency.keys()].sort((a, b) => a - b);
  const lowerIndex = Math.floor((total - 1) / 2);
  const upperIndex = Math.floor(total / 2);
  let seen = 0;
  let lower: number | undefined;
  for (const value of values) {
    seen += frequency.get(value) ?? 0;
    if (lower === undefined && seen > lowerIndex) lower = value;
    if (seen > upperIndex) return (lower! + value) / 2;
  }
  return lower ?? 0;
}

/** Multi-source coverage KPIs over ALL clusters of a run. */
export function computeCoverageDistribution(
  clusters: readonly StoryCluster[],
): CoverageDistribution {
  const total = clusters.length;
  let singleSource = 0;
  let twoSource = 0;
  let threeSource = 0;
  let fourPlus = 0;
  let pressRelease = 0;
  let opinion = 0;
  let general = 0;
  let sourceSum = 0;
  const sourceCountFrequency = new Map<number, number>();

  for (const cluster of clusters) {
    const n = cluster.sourceCount;
    if (n <= 1) singleSource++;
    else if (n === 2) twoSource++;
    else if (n === 3) threeSource++;
    else fourPlus++;
    sourceSum += n;
    sourceCountFrequency.set(n, (sourceCountFrequency.get(n) ?? 0) + 1);
    if (cluster.contentType === "press_release") pressRelease++;
    else if (cluster.contentType === "opinion") opinion++;
    if (cluster.category === "general") general++;
  }

  return {
    clusters: total,
    singleSource,
    twoSource,
    threeSource,
    fourPlus,
    multiSourcePct: pct(twoSource + threeSource + fourPlus, total),
    threePlusPct: pct(threeSource + fourPlus, total),
    fourPlusPct: pct(fourPlus, total),
    medianIndependentPublications: medianOfCounts(sourceCountFrequency, total),
    meanIndependentPublications:
      total === 0 ? 0 : Math.round((sourceSum / total) * 100) / 100,
    pressReleasePct: pct(pressRelease, total),
    opinionPct: pct(opinion, total),
    generalCategoryPct: pct(general, total),
  };
}

export interface FeedValueInput {
  /** Raw article per accepted article id (first occurrence wins, as in the pipeline). */
  rawByArticleId: ReadonlyMap<string, RawArticle>;
  /** The accepted, deduplicated articles of the run. */
  articles: readonly Article[];
  /** Ranked clusters of the run (membership + sourceCount). */
  clusters: readonly StoryCluster[];
  /** Last-run health of every configured feed, including zero-item ones. */
  feedHealth: readonly FeedHealth[];
}

/** Mutable accumulator for one feed while the passes run. */
interface FeedTally {
  accepted: number;
  pressReleases: number;
  firstObserved: number;
  clusterIds: Set<string>;
}

function newTally(): FeedTally {
  return { accepted: 0, pressReleases: 0, firstObserved: 0, clusterIds: new Set() };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Per-feed value statistics. Every feed in `feedHealth` gets a row (a dead
 * or empty feed still shows up with zeros — that IS the signal), plus any
 * feed URL seen on a raw article but missing from the health list.
 */
export function computeFeedValueStats(input: FeedValueInput): FeedValueStat[] {
  const { rawByArticleId, articles, clusters, feedHealth } = input;

  // Pass 1 — cluster membership, per-cluster publication count and, per
  // ≥2-publication cluster, the earliest article: the one that "first
  // observed" the story for us. ISO-8601 UTC strings compare
  // lexicographically, so no Date is allocated per member.
  const clusterIdByArticleId = new Map<string, string>();
  const sourceCountByClusterId = new Map<string, number>();
  const firstObservedArticleIds = new Set<string>();
  for (const cluster of clusters) {
    sourceCountByClusterId.set(cluster.id, cluster.sourceCount);
    let earliest: Article | undefined;
    for (const member of cluster.articles) {
      clusterIdByArticleId.set(member.id, cluster.id);
      if (!earliest || member.publishedAt < earliest.publishedAt) earliest = member;
    }
    if (earliest && cluster.sourceCount >= 2) firstObservedArticleIds.add(earliest.id);
  }

  // Pass 2 — attribute accepted articles to their feed. Health rows are
  // seeded first so configured order is preserved and empty feeds appear.
  const tallies = new Map<string, FeedTally>();
  for (const health of feedHealth) {
    if (!tallies.has(health.url)) tallies.set(health.url, newTally());
  }
  for (const article of articles) {
    const feedUrl = rawByArticleId.get(article.id)?.feedUrl;
    if (!feedUrl) continue;
    let tally = tallies.get(feedUrl);
    if (!tally) {
      tally = newTally();
      tallies.set(feedUrl, tally);
    }
    tally.accepted++;
    if (article.contentType === "press_release") tally.pressReleases++;
    if (firstObservedArticleIds.has(article.id)) tally.firstObserved++;
    const clusterId = clusterIdByArticleId.get(article.id);
    if (clusterId !== undefined) tally.clusterIds.add(clusterId);
  }

  // Pass 3 — one row per feed.
  const healthByUrl = new Map(feedHealth.map((h) => [h.url, h] as const));
  const rows: FeedValueStat[] = [];
  for (const [url, tally] of tallies) {
    const health = healthByUrl.get(url);
    let singletonClusters = 0;
    let multiSourceJoins = 0;
    for (const clusterId of tally.clusterIds) {
      if ((sourceCountByClusterId.get(clusterId) ?? 1) <= 1) singletonClusters++;
      else multiSourceJoins++;
    }
    // A feed can never contribute more than it produced; the max only
    // matters for a feed URL missing from the health list.
    const received = Math.max(health?.itemsParsed ?? 0, tally.accepted);
    const rejected = received - tally.accepted;
    const clustersJoined = tally.clusterIds.size;
    rows.push({
      url,
      publisher: hostnameOf(url),
      received,
      accepted: tally.accepted,
      rejected,
      clustersJoined,
      singletonClusters,
      multiSourceJoins,
      firstObserved: tally.firstObserved,
      pressReleases: tally.pressReleases,
      ok: health?.ok ?? true,
      durationMs: health?.durationMs ?? 0,
      singletonRate: rate(singletonClusters, clustersJoined),
      joinRate: rate(multiSourceJoins, clustersJoined),
      firstObservedRate: rate(tally.firstObserved, tally.accepted),
      noiseRate: rate(rejected + tally.pressReleases, received),
    });
  }
  return rows;
}
