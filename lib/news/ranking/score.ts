import { TIER_WEIGHT } from "@/config/sources";
import type { RankingBreakdown, StoryCluster } from "@/lib/news/types";
import { hoursSince, minutesSince } from "@/lib/utils/time";

/**
 * Transparent 0–100 story ranking.
 *
 *   Freshness   35 — exponential time decay on the latest coverage
 *   Authority   20 — best source tier, small bonus for multiple Tier A
 *   Coverage    20 — breadth of independent sources (log scale)
 *   Geography   10 — US/Canada relevance
 *   Prominence  10 — completeness signals (image, summary, entities)
 *   Velocity     5 — how fast coverage is accumulating
 *
 * A story covered by ten credible publications outranks a minor story that is
 * merely two minutes newer; stories older than ~72h decay to irrelevance.
 */

export const RANKING_WEIGHTS = {
  freshness: 35,
  authority: 20,
  coverage: 20,
  geography: 10,
  prominence: 10,
  velocity: 5,
} as const;

/** Half-life style exponential decay: 1.0 now → ~0.5 at 8h → ~0.1 at 27h. */
export function freshnessFactor(hoursOld: number): number {
  if (hoursOld <= 0) return 1;
  if (hoursOld >= 72) return 0;
  const halfLifeHours = 8;
  const decay = Math.pow(0.5, hoursOld / halfLifeHours);
  // Linear taper after 48h so nothing survives past the 72h window.
  if (hoursOld > 48) {
    const taper = 1 - (hoursOld - 48) / 24;
    return decay * Math.max(0, taper);
  }
  return decay;
}

export function coverageFactor(sourceCount: number): number {
  if (sourceCount <= 1) return 0.2;
  // log2 scale, saturating at 12 independent sources.
  return Math.min(1, 0.2 + (Math.log2(sourceCount) / Math.log2(12)) * 0.8);
}

export function geographyFactor(country: StoryCluster["country"]): number {
  switch (country) {
    case "US":
    case "CA":
      return 1;
    case "US_CA":
      return 1;
    case "GLOBAL_NA":
      return 0.65;
    case "GLOBAL":
      return 0.35;
  }
}

export function authorityFactor(cluster: Pick<StoryCluster, "articles">): number {
  const tiers = cluster.articles.map((a) => TIER_WEIGHT[a.sourceTier]);
  const best = Math.max(...tiers);
  const tierACount = cluster.articles.filter((a) => a.sourceTier === "A").length;
  const bonus = Math.min(0.15, Math.max(0, tierACount - 1) * 0.05);
  return Math.min(1, best + bonus);
}

function prominenceFactor(cluster: StoryCluster): number {
  let score = 0;
  if (cluster.imageUrl) score += 0.35;
  if (cluster.summary && cluster.summary.length > 40) score += 0.35;
  if (cluster.entities.length >= 2) score += 0.2;
  const titleLength = cluster.title.length;
  if (titleLength >= 35 && titleLength <= 140) score += 0.1;
  return Math.min(1, score);
}

/** Share of coverage that arrived in the last 3 hours. */
export function velocityFactor(cluster: StoryCluster, now: Date): number {
  if (cluster.articles.length <= 1) return 0;
  const recent = cluster.articles.filter(
    (a) => hoursSince(a.publishedAt, now) <= 3,
  ).length;
  return Math.min(1, recent / Math.max(2, cluster.articles.length * 0.6));
}

export function scoreCluster(cluster: StoryCluster, now: Date = new Date()): RankingBreakdown {
  const hoursOld = hoursSince(cluster.lastPublishedAt, now);

  const freshness = freshnessFactor(hoursOld) * RANKING_WEIGHTS.freshness;
  const authority = authorityFactor(cluster) * RANKING_WEIGHTS.authority;
  const coverage = coverageFactor(cluster.sourceCount) * RANKING_WEIGHTS.coverage;
  const geography = geographyFactor(cluster.country) * RANKING_WEIGHTS.geography;
  const prominence = prominenceFactor(cluster) * RANKING_WEIGHTS.prominence;
  const velocity = velocityFactor(cluster, now) * RANKING_WEIGHTS.velocity;

  const total = freshness + authority + coverage + geography + prominence + velocity;

  return {
    freshness: round1(freshness),
    authority: round1(authority),
    coverage: round1(coverage),
    geography: round1(geography),
    prominence: round1(prominence),
    velocity: round1(velocity),
    total: round1(total),
  };
}

/**
 * Breaking threshold: very fresh, broadly covered, high total score.
 * Normal news must never be labeled BREAKING — at most one story qualifies
 * at a time, and only if it is also the top-ranked story.
 */
export function qualifiesAsBreaking(
  cluster: StoryCluster,
  now: Date = new Date(),
): boolean {
  const ageMinutes = minutesSince(cluster.lastPublishedAt, now);
  const hasTierA = cluster.articles.some((a) => a.sourceTier === "A");
  return (
    cluster.rankingScore >= 85 &&
    ageMinutes <= 90 &&
    (cluster.sourceCount >= 4 || (hasTierA && cluster.sourceCount >= 3))
  );
}

/** Score every cluster, flag breaking, and sort by importance. */
export function rankClusters(clusters: StoryCluster[], now: Date = new Date()): StoryCluster[] {
  for (const cluster of clusters) {
    cluster.rankingBreakdown = scoreCluster(cluster, now);
    cluster.rankingScore = cluster.rankingBreakdown.total;
  }
  const sorted = [...clusters].sort((a, b) => b.rankingScore - a.rankingScore);
  // Only the single top-ranked story may carry the BREAKING label.
  const top = sorted[0];
  if (top && qualifiesAsBreaking(top, now)) {
    top.isBreaking = true;
    if (top.status !== "developing") top.status = "live";
  }
  return sorted;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
