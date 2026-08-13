import { TIER_WEIGHT } from "@/config/sources";
import type { Article, StoryCluster } from "@/lib/news/types";
import { bigrams, fnv1a, jaccard, significantTokens, slugify } from "@/lib/utils/text";
import { hoursSince } from "@/lib/utils/time";

/**
 * Deterministic story clustering.
 *
 * Multiple publications reporting the same event are merged into one canonical
 * story cluster using headline token overlap, bigram overlap and shared named
 * entities, constrained to a publication-time window. This is the non-LLM
 * fallback described in the architecture; an embedding-based enhancer can be
 * plugged in via the IntelligenceProvider abstraction later.
 */

const SIMILARITY_THRESHOLD = 0.42;
const TIME_WINDOW_HOURS = 48;

interface ArticleFeatures {
  tokens: Set<string>;
  pairs: Set<string>;
  entities: Set<string>;
  time: number;
}

function features(article: Article): ArticleFeatures {
  const tokens = significantTokens(article.title);
  return {
    tokens: new Set(tokens),
    pairs: bigrams(tokens),
    entities: new Set(article.entities.map((e) => e.toLowerCase())),
    time: new Date(article.publishedAt).getTime(),
  };
}

/** Combined similarity of two articles in [0, 1]. */
export function articleSimilarity(a: ArticleFeatures, b: ArticleFeatures): number {
  const tokenSim = jaccard(a.tokens, b.tokens);
  const bigramSim = jaccard(a.pairs, b.pairs);
  const entitySim = jaccard(a.entities, b.entities);
  return tokenSim * 0.5 + bigramSim * 0.3 + entitySim * 0.2;
}

/** Union-find over article indices. */
class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

/**
 * Group articles into story clusters.
 * Ranking scores are attached later by the ranking engine.
 */
export function clusterArticles(articles: Article[], now: Date = new Date()): StoryCluster[] {
  const feats = articles.map(features);
  const uf = new UnionFind(articles.length);
  const windowMs = TIME_WINDOW_HOURS * 3_600_000;

  // Bucket by category to keep the pairwise pass cheap and avoid
  // cross-category false merges.
  const byCategory = new Map<string, number[]>();
  for (let i = 0; i < articles.length; i++) {
    const key = articles[i].category;
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(i);
    else byCategory.set(key, [i]);
  }

  for (const bucket of byCategory.values()) {
    for (let x = 0; x < bucket.length; x++) {
      for (let y = x + 1; y < bucket.length; y++) {
        const i = bucket[x];
        const j = bucket[y];
        if (Math.abs(feats[i].time - feats[j].time) > windowMs) continue;
        if (articles[i].sourceDomain === articles[j].sourceDomain) continue;
        if (articleSimilarity(feats[i], feats[j]) >= SIMILARITY_THRESHOLD) {
          uf.union(i, j);
        }
      }
    }
  }

  const groups = new Map<number, Article[]>();
  for (let i = 0; i < articles.length; i++) {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) group.push(articles[i]);
    else groups.set(root, [articles[i]]);
  }

  return [...groups.values()].map((members) => buildCluster(members, now));
}

/** Pick the representative article: best tier, then completeness, then newest. */
export function pickLead(members: Article[]): Article {
  return [...members].sort((a, b) => {
    const tierDiff = TIER_WEIGHT[b.sourceTier] - TIER_WEIGHT[a.sourceTier];
    if (tierDiff !== 0) return tierDiff;
    const completeness = (article: Article) =>
      (article.description ? 1 : 0) + (article.imageUrl ? 1 : 0);
    const completenessDiff = completeness(b) - completeness(a);
    if (completenessDiff !== 0) return completenessDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  })[0];
}

function buildCluster(members: Article[], now: Date): StoryCluster {
  const sorted = [...members].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const lead = pickLead(members);

  // Stable cluster identity anchored on the earliest article's canonical URL.
  const id = `c${fnv1a(`cluster:${earliest.canonicalUrl}`)}`;
  const sourceNames = [...new Set(members.map((m) => m.source))];

  const entityCounts = new Map<string, { display: string; count: number }>();
  for (const member of members) {
    for (const entity of member.entities) {
      const key = entity.toLowerCase();
      const existing = entityCounts.get(key);
      if (existing) existing.count++;
      else entityCounts.set(key, { display: entity, count: 1 });
    }
  }
  const entities = [...entityCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map((e) => e.display)
    .slice(0, 8);

  const membersByTier = [...members].sort((a, b) => {
    const tierDiff = TIER_WEIGHT[b.sourceTier] - TIER_WEIGHT[a.sourceTier];
    if (tierDiff !== 0) return tierDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const ageMinutes = (now.getTime() - new Date(latest.publishedAt).getTime()) / 60_000;
  const spanHours = hoursSince(earliest.publishedAt, new Date(latest.publishedAt));

  let status: StoryCluster["status"] = null;
  if (members.length >= 3 && ageMinutes <= 45) status = "developing";
  else if (members.length >= 2 && spanHours >= 2 && ageMinutes <= 120) status = "updated";

  const clusterId = id;
  for (const member of members) member.clusterId = clusterId;

  return {
    id,
    slug: `${slugify(lead.title)}-${id}`,
    title: lead.title,
    summary: lead.description,
    category: lead.category,
    country: pickCountry(members),
    imageUrl: membersByTier.find((m) => m.imageUrl)?.imageUrl,
    articles: membersByTier,
    lead,
    sourceCount: sourceNames.length,
    sourceNames,
    entities,
    firstPublishedAt: earliest.publishedAt,
    lastPublishedAt: latest.publishedAt,
    rankingScore: 0,
    rankingBreakdown: {
      freshness: 0, authority: 0, coverage: 0,
      geography: 0, prominence: 0, velocity: 0, total: 0,
    },
    status,
    isBreaking: false,
    isMock: members.some((m) => m.isMock),
  };
}

/** Majority geography across members; ties involving US and CA become US_CA. */
function pickCountry(members: Article[]): StoryCluster["country"] {
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.country, (counts.get(member.country) ?? 0) + 1);
  }
  const us = (counts.get("US") ?? 0) + (counts.get("US_CA") ?? 0);
  const ca = (counts.get("CA") ?? 0) + (counts.get("US_CA") ?? 0);
  if (us > 0 && ca > 0) return "US_CA";
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as StoryCluster["country"];
}
