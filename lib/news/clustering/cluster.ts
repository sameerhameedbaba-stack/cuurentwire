import { TIER_WEIGHT } from "@/config/sources";
import { getPreviousDataset } from "@/lib/news/previous";
import type { Article, StoryCluster } from "@/lib/news/types";
import { bigrams, jaccard, significantTokens, slugify, stableId } from "@/lib/utils/text";
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

export const SIMILARITY_THRESHOLD = 0.42;
/**
 * Category is a soft signal, not a wall: pairs whose primary categories
 * differ must clear SIMILARITY_THRESHOLD + CROSS_CATEGORY_MARGIN, so a
 * misclassified article can still merge with its event.
 */
const CROSS_CATEGORY_MARGIN = 0.05;
/**
 * Anti-chaining validation floor: after union-find, members of a multi-article
 * cluster whose similarity to the cluster lead falls below this are evicted
 * into their own singleton clusters (transitive A–B–C merges can otherwise
 * join articles far below SIMILARITY_THRESHOLD).
 */
const MIN_LEAD_SIMILARITY = 0.25;
/**
 * Candidate blocking: tokens appearing in more than this many articles are
 * too common to be useful candidate keys and are skipped to keep candidate
 * generation far from O(n²).
 */
const MAX_TOKEN_POSTINGS = 50;
const TIME_WINDOW_HOURS = 48;

export interface ArticleFeatures {
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
 *
 * Candidate blocking is category-independent (inverted entity/token indexes)
 * so a misclassified article can still merge with its event; category only
 * raises the required similarity (CROSS_CATEGORY_MARGIN). A validation pass
 * then evicts weakly-attached members (MIN_LEAD_SIMILARITY) to stop
 * transitive chaining.
 */
export function clusterArticles(articles: Article[], now: Date = new Date()): StoryCluster[] {
  const feats = articles.map(features);
  const uf = new UnionFind(articles.length);
  const windowMs = TIME_WINDOW_HOURS * 3_600_000;
  const n = articles.length;

  // Inverted indexes for candidate blocking: a pair is compared when it
  // shares at least 1 entity OR at least 2 significant title tokens.
  const entityIndex = new Map<string, number[]>();
  const tokenIndex = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    for (const entity of feats[i].entities) {
      const postings = entityIndex.get(entity);
      if (postings) postings.push(i);
      else entityIndex.set(entity, [i]);
    }
    for (const token of feats[i].tokens) {
      const postings = tokenIndex.get(token);
      if (postings) postings.push(i);
      else tokenIndex.set(token, [i]);
    }
  }

  const candidates = new Set<number>();
  for (const postings of entityIndex.values()) {
    if (postings.length > MAX_TOKEN_POSTINGS) continue;
    for (let x = 0; x < postings.length; x++) {
      for (let y = x + 1; y < postings.length; y++) {
        candidates.add(postings[x] * n + postings[y]);
      }
    }
  }
  const sharedTokens = new Map<number, number>();
  for (const postings of tokenIndex.values()) {
    if (postings.length > MAX_TOKEN_POSTINGS) continue;
    for (let x = 0; x < postings.length; x++) {
      for (let y = x + 1; y < postings.length; y++) {
        const key = postings[x] * n + postings[y];
        const count = (sharedTokens.get(key) ?? 0) + 1;
        sharedTokens.set(key, count);
        if (count >= 2) candidates.add(key);
      }
    }
  }

  for (const key of candidates) {
    const i = Math.floor(key / n);
    const j = key % n;
    if (Math.abs(feats[i].time - feats[j].time) > windowMs) continue;
    if (articles[i].sourceDomain === articles[j].sourceDomain) continue;
    const required =
      articles[i].category === articles[j].category
        ? SIMILARITY_THRESHOLD
        : SIMILARITY_THRESHOLD + CROSS_CATEGORY_MARGIN;
    if (articleSimilarity(feats[i], feats[j]) >= required) {
      uf.union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }

  // Validation pass (anti-chaining): every member of a multi-article cluster
  // must sit within MIN_LEAD_SIMILARITY of the cluster lead, or it becomes a
  // singleton again.
  const validated: number[][] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      validated.push(group);
      continue;
    }
    const members = group.map((i) => articles[i]);
    const leadIndex = group[members.indexOf(pickLead(members))];
    const kept: number[] = [];
    for (const i of group) {
      if (
        i === leadIndex ||
        articleSimilarity(feats[i], feats[leadIndex]) >= MIN_LEAD_SIMILARITY
      ) {
        kept.push(i);
      } else {
        validated.push([i]);
      }
    }
    validated.push(kept);
  }

  const previousIds = assignPreviousIds(validated, articles);
  return validated.map((group, index) =>
    buildCluster(group.map((i) => articles[i]), now, previousIds.get(index)),
  );
}

/**
 * Cluster id continuity: when any member appeared in a previous-run cluster,
 * reuse that cluster's id — the previous id with the largest member overlap
 * wins, assigned greedily so no id is reused twice. Keeps a story's URL
 * stable as coverage expands. With an empty registry this is a no-op.
 */
function assignPreviousIds(
  groups: number[][],
  articles: Article[],
): Map<number, string> {
  const assigned = new Map<number, string>();
  const previous = getPreviousDataset();
  if (!previous) return assigned;

  const prevIdByUrl = new Map<string, string>();
  for (const cluster of previous.clusters) {
    for (const member of cluster.articles) {
      prevIdByUrl.set(member.canonicalUrl, cluster.id);
    }
  }
  if (prevIdByUrl.size === 0) return assigned;

  const claims: { group: number; prevId: string; overlap: number }[] = [];
  groups.forEach((group, index) => {
    const overlaps = new Map<string, number>();
    for (const i of group) {
      const prevId = prevIdByUrl.get(articles[i].canonicalUrl);
      if (prevId) overlaps.set(prevId, (overlaps.get(prevId) ?? 0) + 1);
    }
    for (const [prevId, overlap] of overlaps) {
      claims.push({ group: index, prevId, overlap });
    }
  });

  // Deterministic greedy assignment: largest overlap first, ties broken by
  // id then group order.
  claims.sort(
    (a, b) =>
      b.overlap - a.overlap ||
      a.prevId.localeCompare(b.prevId) ||
      a.group - b.group,
  );
  const usedIds = new Set<string>();
  for (const claim of claims) {
    if (assigned.has(claim.group) || usedIds.has(claim.prevId)) continue;
    assigned.set(claim.group, claim.prevId);
    usedIds.add(claim.prevId);
  }
  return assigned;
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

function buildCluster(
  members: Article[],
  now: Date,
  previousId?: string,
): StoryCluster {
  const sorted = [...members].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const lead = pickLead(members);

  // Stable cluster identity: the previous run's id when the story already
  // existed, else anchored on the earliest article's canonical URL.
  const id = previousId ?? `c${stableId(`cluster:${earliest.canonicalUrl}`)}`;
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
