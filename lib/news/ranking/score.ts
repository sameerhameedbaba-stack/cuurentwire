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

/**
 * Press releases are issuer communications, not journalism: the publishing
 * outlet's tier says nothing about editorial scrutiny, so a press-release
 * cluster's AUTHORITY INPUT is halved. This is an input adjustment (like
 * TIER_WEIGHT), not a change to RANKING_WEIGHTS — the audit forbids weight
 * tuning this sprint.
 */
export const PRESS_RELEASE_AUTHORITY_MULTIPLIER = 0.5;

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

/**
 * Independent editorial sources in a cluster: distinct domains of members
 * that are NOT press releases. Syndicated copies of one release
 * (GlobeNewswire → Financial Post → Yahoo Finance) are one distribution
 * chain, not three independent reports — an all-press-release cluster
 * counts as exactly 1 (the issuer), no matter how many domains carry it.
 * Coverage scoring and breaking eligibility reward independent REPORTING,
 * never distribution breadth.
 */
export function independentSourceCount(
  cluster: Pick<StoryCluster, "articles">,
): number {
  const editorial = new Set(
    cluster.articles
      .filter((a) => a.contentType !== "press_release")
      .map((a) => a.sourceDomain),
  );
  return Math.max(1, editorial.size);
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

export function authorityFactor(
  cluster: Pick<StoryCluster, "articles" | "contentType">,
): number {
  const tiers = cluster.articles.map((a) => TIER_WEIGHT[a.sourceTier]);
  const best = Math.max(...tiers);
  const tierACount = cluster.articles.filter((a) => a.sourceTier === "A").length;
  const bonus = Math.min(0.15, Math.max(0, tierACount - 1) * 0.05);
  // Press-release downgrade: issuer communications carry the outlet's tier
  // but none of its editorial judgment (input adjustment, weights untouched).
  const multiplier =
    cluster.contentType === "press_release"
      ? PRESS_RELEASE_AUTHORITY_MULTIPLIER
      : 1;
  return Math.min(1, best + bonus) * multiplier;
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
  // Coverage counts INDEPENDENT editorial sources (input adjustment, not a
  // weight change): syndicated press-release copies never widen coverage.
  const coverage =
    coverageFactor(independentSourceCount(cluster)) * RANKING_WEIGHTS.coverage;
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
  // Eligibility gate: press releases and opinion essays are never BREAKING
  // no matter how fresh or broadly syndicated — BREAKING is reserved for
  // reported news events.
  if (
    cluster.contentType === "press_release" ||
    cluster.contentType === "opinion"
  ) {
    return false;
  }
  const ageMinutes = minutesSince(cluster.lastPublishedAt, now);
  const hasTierA = cluster.articles.some((a) => a.sourceTier === "A");
  // Independent editorial sources only — a story padded by syndicated
  // press-release copies cannot fake the breadth BREAKING requires.
  const independent = independentSourceCount(cluster);
  return (
    cluster.rankingScore >= 85 &&
    ageMinutes <= 90 &&
    (independent >= 4 || (hasTierA && independent >= 3))
  );
}

/**
 * Top-100 eligibility: press-release clusters are excluded unless the story
 * has genuinely independent coverage — at least one member that is NOT
 * itself a press release, published on a different domain than the release
 * copies. Syndicated copies of one press release (the only way an
 * all-press-release cluster spans multiple domains) never count as
 * independent coverage. Everything else is always eligible.
 */
export function isTop100Eligible(
  cluster: Pick<StoryCluster, "articles" | "contentType">,
): boolean {
  if (cluster.contentType !== "press_release") return true;
  const releaseDomains = new Set(
    cluster.articles
      .filter((a) => a.contentType === "press_release")
      .map((a) => a.sourceDomain),
  );
  return cluster.articles.some(
    (a) =>
      a.contentType !== "press_release" && !releaseDomains.has(a.sourceDomain),
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
