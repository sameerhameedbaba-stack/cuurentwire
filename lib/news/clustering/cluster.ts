import { TIER_WEIGHT } from "@/config/sources";
import {
  buildCorpusStats,
  buildFingerprint,
  fingerprintContainment,
  fingerprintSimilarity,
  hasConflictingAction,
  hasSharedAction,
  idfWeight,
  isDeathEventPair,
  isStrongFingerprint,
  MIN_SHARED_RARE_STEMS,
  sharedRareStems,
  type CorpusStats,
  type EventFingerprint,
} from "@/lib/news/clustering/fingerprint";
import { getPreviousDataset } from "@/lib/news/previous";
import type { Article, StoryCluster } from "@/lib/news/types";
import { bigrams, jaccard, significantTokens, slugify, stableId } from "@/lib/utils/text";
import { hoursSince } from "@/lib/utils/time";

/**
 * Deterministic story clustering.
 *
 * Multiple publications reporting the same event are merged into one canonical
 * story cluster using headline token overlap, bigram overlap and shared named
 * entities, constrained to a publication-time window. Because headline Jaccard
 * alone cannot carry heavily reworded coverage of one event, an event
 * FINGERPRINT (rare-token overlap + stemming + action synonyms, see
 * fingerprint.ts) relaxes the threshold when the evidence is strong. This is
 * the non-LLM fallback described in the architecture; an embedding-based
 * enhancer can be plugged in via the IntelligenceProvider abstraction later.
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
 * join articles far below SIMILARITY_THRESHOLD). A member may also stay via
 * strong fingerprint evidence against the lead — the same relaxed rule that
 * merged it in the first place.
 */
const MIN_LEAD_SIMILARITY = 0.25;
/**
 * Candidate blocking: tokens appearing in more than this many articles are
 * too common to be useful candidate keys and are skipped to keep candidate
 * generation far from O(n²).
 */
const MAX_TOKEN_POSTINGS = 50;
const TIME_WINDOW_HOURS = 48;
/**
 * Relaxed-threshold path: when a pair has a STRONG fingerprint (>= 2 shared
 * rare stems incl. a proper-noun anchor + no action conflict,
 * fingerprint.ts), it merges if IDF-weighted fingerprint similarity reaches
 * this bar. Calibrated on the 200+ labeled fixture pairs
 * (tests/fixtures/cluster-pairs.ts): reworded same-event pairs measure
 * ~0.40-0.65 while same-entity different-event pairs (two votes by one
 * politician, two wins by one team) stay <= ~0.37 — 0.42 splits the bands.
 */
export const FINGERPRINT_SIMILARITY_THRESHOLD = 0.42;
/**
 * …and the plain headline similarity is at least this floor — a sanity check
 * so fingerprint evidence alone can never join headlines with essentially no
 * surface overlap.
 */
const FINGERPRINT_MIN_HEADLINE_SIMILARITY = 0.1;
/**
 * Containment path (asymmetric rewordings): when one outlet's headline adds
 * detail the other omits (a person's full name, a duration), IDF Jaccard
 * dilutes below FINGERPRINT_SIMILARITY_THRESHOLD even though the shorter
 * headline is essentially contained in the longer one. Such pairs merge when
 * the fingerprint is STRONG (which already excludes conflicting actions)
 * and the IDF-weighted overlap coefficient over the smaller side reaches a
 * bar that depends on the action evidence:
 *  - both headlines carry the SAME action group (released~freed): the act
 *    is confirmed, the moderate bar applies;
 *  - one-sided or absent actions (rewordings routinely nominalize or drop
 *    the verb): the strict bar applies — near-total containment only.
 * Calibrated on the 500+ labeled pairs: same-subject different-object
 * follow-ups ("Hale vetoes school bill" / "Hale vetoes housing bill") stay
 * under 0.65, while genuine rewordings of one event measure 0.7–1.0.
 */
export const FINGERPRINT_CONTAINMENT_SHARED_ACTION = 0.65;
export const FINGERPRINT_CONTAINMENT_NO_ACTION = 0.72;
/**
 * Deep-rewording tier: with a WIDE anchor (at least 3 shared rare stems,
 * proper-noun anchored — place + subject + object, not just a name) AND the
 * same action group on both sides, the event identity is established by the
 * anchors themselves and containment only needs to clear this floor.
 * Same-team different-match pairs share only ~2 rare stems (team name; the
 * opponents differ) and never qualify.
 */
export const FINGERPRINT_CONTAINMENT_WIDE_ANCHOR = 0.62;
export const WIDE_ANCHOR_MIN_RARE_STEMS = 3;
/**
 * Conflicting-action veto: when BOTH headlines carry action words from the
 * synonym table and share no group ("erupts" vs "clears", "wins" vs
 * "fired"), they very likely describe different events even when their
 * nouns overlap heavily ("Volcano erupts, ash grounds flights" vs "Flights
 * resume as ash clears"). Such pairs pay this extra margin on the headline
 * path and never qualify for the relaxed fingerprint path.
 */
const CONFLICTING_ACTION_MARGIN = 0.15;
/**
 * Second-pass cluster merge: clusters merge when their compact fingerprints
 * (top stems + actions + time overlap) share >= MIN_SHARED_RARE_STEMS rare
 * stems with a proper anchor, a compatible action, and this IDF-weighted
 * overlap coefficient over their top stems. Higher than the pair bar because
 * top-stem sets are compact and overlap coefficients run hot.
 */
const CLUSTER_MERGE_MIN_OVERLAP = 0.6;
/** Size of the compact top-stem fingerprint a cluster is summarized by. */
const CLUSTER_TOP_STEMS = 10;

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

/**
 * Everything pair decisions need, precomputed once per run: headline
 * features, event fingerprints, and corpus-wide document frequencies (token
 * rarity is relative to the CURRENT run corpus).
 */
export interface ClusterContext {
  articles: Article[];
  feats: ArticleFeatures[];
  prints: EventFingerprint[];
  stats: CorpusStats;
}

export function buildClusterContext(articles: Article[]): ClusterContext {
  const prints = articles.map((a) => buildFingerprint(a.title, a.entities));
  return {
    articles,
    feats: articles.map(features),
    prints,
    stats: buildCorpusStats(prints),
  };
}

export interface PairDecision {
  merge: boolean;
  headlineSimilarity: number;
  fingerprintSimilarity: number;
  strongFingerprint: boolean;
}

/**
 * THE production merge decision for two articles (time window and same-domain
 * skip are enforced by the caller):
 *  - headline similarity >= SIMILARITY_THRESHOLD merges as before; on this
 *    path cross-category pairs pay CROSS_CATEGORY_MARGIN and pairs with
 *    CONFLICTING action words pay CONFLICTING_ACTION_MARGIN;
 *  - otherwise a STRONG fingerprint lowers the bar: merge when fingerprint
 *    similarity >= FINGERPRINT_SIMILARITY_THRESHOLD and headline similarity
 *    is at least FINGERPRINT_MIN_HEADLINE_SIMILARITY. No category margin
 *    here: this path exists precisely because one variant of a story is
 *    often misclassified, and its evidence is already anchored on shared
 *    rare entities (conflicting actions disqualify strong outright).
 */
export function decidePair(ctx: ClusterContext, i: number, j: number): PairDecision {
  const conflictMargin = hasConflictingAction(ctx.prints[i], ctx.prints[j])
    ? CONFLICTING_ACTION_MARGIN
    : 0;
  const categoryMargin =
    ctx.articles[i].category === ctx.articles[j].category ? 0 : CROSS_CATEGORY_MARGIN;
  const headlineSim = articleSimilarity(ctx.feats[i], ctx.feats[j]);
  const fpSim = fingerprintSimilarity(ctx.prints[i], ctx.prints[j], ctx.stats);
  const strong = isStrongFingerprint(ctx.prints[i], ctx.prints[j], ctx.stats);
  const containmentBar = containmentBarFor(ctx, i, j);
  const merge =
    headlineSim >= SIMILARITY_THRESHOLD + categoryMargin + conflictMargin ||
    (strong &&
      fpSim >= FINGERPRINT_SIMILARITY_THRESHOLD &&
      headlineSim >= FINGERPRINT_MIN_HEADLINE_SIMILARITY) ||
    // Asymmetric rewording: the shorter headline contained in the longer
    // one, bar depending on action evidence (see the threshold docs).
    (strong &&
      fingerprintContainment(ctx.prints[i], ctx.prints[j], ctx.stats) >=
        containmentBar &&
      headlineSim >= FINGERPRINT_MIN_HEADLINE_SIMILARITY) ||
    // Same-event DEATH rule (isDeathEventPair): explicit death signal on
    // BOTH sides + shared person anchor + no non-death action disagreement.
    // The person's name is often the only shared rare material between
    // "dies at 82" and "Obituary: … remembered as …" coverage, which sits
    // below every containment bar — the live four-page split. Only the
    // surface-overlap sanity floor applies; no category margin, mirroring
    // the strong-fingerprint paths.
    (isDeathPair(ctx, i, j) && headlineSim >= FINGERPRINT_MIN_HEADLINE_SIMILARITY);
  return {
    merge,
    headlineSimilarity: headlineSim,
    fingerprintSimilarity: fpSim,
    strongFingerprint: strong,
  };
}

/**
 * Death-event pair with the 48h publication window enforced locally: the
 * clustering caller already windows candidate pairs, but this rule is
 * deliberately strong enough to merge name-only-anchor coverage, so it
 * re-checks time itself and never outlives the window through any caller.
 */
function isDeathPair(ctx: ClusterContext, i: number, j: number): boolean {
  return (
    Math.abs(ctx.feats[i].time - ctx.feats[j].time) <=
      TIME_WINDOW_HOURS * 3_600_000 &&
    isDeathEventPair(ctx.prints[i], ctx.prints[j], ctx.stats)
  );
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
  const ctx = buildClusterContext(articles);
  const { feats } = ctx;
  const uf = new UnionFind(articles.length);
  const windowMs = TIME_WINDOW_HOURS * 3_600_000;
  const n = articles.length;

  // Inverted indexes for candidate blocking: a pair is compared when it
  // shares at least 1 entity OR at least 2 significant title tokens OR at
  // least 2 canonical fingerprint stems (stemmed, so kidnap/kidnapped
  // block together the same way they match together).
  const entityIndex = new Map<string, number[]>();
  const tokenIndex = new Map<string, number[]>();
  const stemIndex = new Map<string, number[]>();
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
    for (const stem of ctx.prints[i].stems) {
      const postings = stemIndex.get(stem);
      if (postings) postings.push(i);
      else stemIndex.set(stem, [i]);
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
  const sharedCounts = new Map<number, number>();
  const addPairCounts = (index: Map<string, number[]>) => {
    for (const postings of index.values()) {
      if (postings.length > MAX_TOKEN_POSTINGS) continue;
      for (let x = 0; x < postings.length; x++) {
        for (let y = x + 1; y < postings.length; y++) {
          const key = postings[x] * n + postings[y];
          const count = (sharedCounts.get(key) ?? 0) + 1;
          sharedCounts.set(key, count);
          if (count >= 2) candidates.add(key);
        }
      }
    }
  };
  addPairCounts(tokenIndex);
  addPairCounts(stemIndex);

  for (const key of candidates) {
    const i = Math.floor(key / n);
    const j = key % n;
    if (Math.abs(feats[i].time - feats[j].time) > windowMs) continue;
    if (articles[i].sourceDomain === articles[j].sourceDomain) continue;
    if (decidePair(ctx, i, j).merge) uf.union(i, j);
  }

  const groups = collectGroups(uf, n);
  let validated = validateGroups(ctx, groups);

  // SECOND PASS: merge clusters that clearly describe the same event even
  // though no single pair cleared the bar, then re-run the anti-chaining
  // validation on the merged result.
  const merged = mergeClusterFingerprints(ctx, validated, windowMs);
  if (merged !== validated) validated = validateGroups(ctx, merged);

  const previousIds = assignPreviousIds(validated, articles);
  const previousById = new Map(
    (getPreviousDataset()?.clusters ?? []).map((c) => [c.id, c] as const),
  );
  // Every id handed out this run, previous ids up front: when a story splits,
  // the fragment holding the original anchor article re-derives EXACTLY the
  // id the other fragment just inherited, and a duplicate id breaks the
  // single-statement story_clusters upsert (and story URL uniqueness).
  const takenIds = new Set(previousIds.values());
  return validated.map((group, index) => {
    const prevId = previousIds.get(index);
    return buildCluster(
      group.map((i) => articles[i]),
      now,
      prevId === undefined ? undefined : previousById.get(prevId),
      takenIds,
    );
  });
}

function collectGroups(uf: UnionFind, n: number): number[][] {
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()];
}

/**
 * Validation pass (anti-chaining): every member of a multi-article cluster
 * must either support the cluster LEAD or support a MAJORITY of the other
 * members — otherwise it becomes a singleton again. A genuinely chained
 * outlier (A–B–C where C only resembles B) supports exactly one neighbor
 * and is still evicted; a heavily reworded variant that matches most of the
 * group but happens to sit far from the one article chosen as lead (the
 * live BBC Niger case) is kept.
 */
function validateGroups(ctx: ClusterContext, groups: number[][]): number[][] {
  const validated: number[][] = [];
  for (const group of groups) {
    if (group.length === 1) {
      validated.push(group);
      continue;
    }
    const members = group.map((i) => ctx.articles[i]);
    const leadIndex = group[members.indexOf(pickLead(members))];
    const kept: number[] = [];
    for (const i of group) {
      if (
        i === leadIndex ||
        memberSupportsMember(ctx, i, leadIndex) ||
        supportsMajority(ctx, i, group, leadIndex)
      ) {
        kept.push(i);
      } else {
        validated.push([i]);
      }
    }
    validated.push(kept);
  }
  return validated;
}

/** Member i supports more than half of the OTHER members of its group. */
function supportsMajority(
  ctx: ClusterContext,
  i: number,
  group: number[],
  leadIndex: number,
): boolean {
  let supported = 0;
  let others = 0;
  for (const j of group) {
    if (j === i) continue;
    others++;
    if (j !== leadIndex && memberSupportsMember(ctx, i, j)) supported++;
  }
  return others > 0 && supported * 2 > others;
}

/** The containment bar a pair must clear, by strength of action evidence. */
function containmentBarFor(ctx: ClusterContext, i: number, j: number): number {
  if (!hasSharedAction(ctx.prints[i], ctx.prints[j])) {
    return FINGERPRINT_CONTAINMENT_NO_ACTION;
  }
  const rare = sharedRareStems(ctx.prints[i], ctx.prints[j], ctx.stats);
  return rare.length >= WIDE_ANCHOR_MIN_RARE_STEMS
    ? FINGERPRINT_CONTAINMENT_WIDE_ANCHOR
    : FINGERPRINT_CONTAINMENT_SHARED_ACTION;
}

/** A member may stay near another member via headline OR fingerprint evidence. */
function memberSupportsMember(ctx: ClusterContext, i: number, j: number): boolean {
  if (articleSimilarity(ctx.feats[i], ctx.feats[j]) >= MIN_LEAD_SIMILARITY) {
    return true;
  }
  // Mirror the death-event merge path: an obituary variant admitted on the
  // name anchor alone must not be evicted by validation for the same low
  // surface overlap the rule exists to bridge.
  if (isDeathPair(ctx, i, j)) return true;
  if (!isStrongFingerprint(ctx.prints[i], ctx.prints[j], ctx.stats)) {
    return false;
  }
  // Mirror the relaxed merge paths so a member admitted via containment
  // is not immediately evicted by validation.
  return (
    fingerprintSimilarity(ctx.prints[i], ctx.prints[j], ctx.stats) >=
      FINGERPRINT_SIMILARITY_THRESHOLD ||
    fingerprintContainment(ctx.prints[i], ctx.prints[j], ctx.stats) >=
      containmentBarFor(ctx, i, j)
  );
}

/** Compact cluster fingerprint used by the second-pass merge. */
interface ClusterPrint {
  /** Top stems by member support then rarity — the cluster's identity. */
  top: Set<string>;
  proper: Set<string>;
  actions: Set<string>;
  minTime: number;
  maxTime: number;
}

function buildClusterPrint(ctx: ClusterContext, group: number[]): ClusterPrint {
  const counts = new Map<string, number>();
  const proper = new Set<string>();
  const actions = new Set<string>();
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const i of group) {
    const print = ctx.prints[i];
    for (const stem of print.stems) counts.set(stem, (counts.get(stem) ?? 0) + 1);
    for (const stem of print.proper) proper.add(stem);
    for (const marker of print.actions) actions.add(marker);
    minTime = Math.min(minTime, ctx.feats[i].time);
    maxTime = Math.max(maxTime, ctx.feats[i].time);
  }
  const top = [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        idfWeight(ctx.stats, b[0]) - idfWeight(ctx.stats, a[0]) ||
        a[0].localeCompare(b[0]),
    )
    .slice(0, CLUSTER_TOP_STEMS)
    .map(([stem]) => stem);
  return { top: new Set(top), proper, actions, minTime, maxTime };
}

/**
 * Second-pass cluster merge: compare compact cluster fingerprints and union
 * clusters that clearly describe the same event — publication spans within
 * the time window, >= MIN_SHARED_RARE_STEMS shared rare top stems with a
 * proper-noun anchor on both sides, a compatible action, and an IDF-weighted
 * overlap coefficient >= CLUSTER_MERGE_MIN_OVERLAP over the top stems.
 * Returns the input array unchanged (same reference) when nothing merges.
 */
function mergeClusterFingerprints(
  ctx: ClusterContext,
  groups: number[][],
  windowMs: number,
): number[][] {
  const prints = groups.map((group) => buildClusterPrint(ctx, group));
  const uf = new UnionFind(groups.length);
  let mergedAny = false;
  for (let a = 0; a < groups.length; a++) {
    for (let b = a + 1; b < groups.length; b++) {
      const pa = prints[a];
      const pb = prints[b];
      if (pa.minTime > pb.maxTime + windowMs || pb.minTime > pa.maxTime + windowMs) {
        continue;
      }
      // Conflict-only action gate (mirrors hasConflictingAction): clusters
      // whose action sets are both non-empty yet disjoint describe
      // different acts; one-sided or absent actions are neutral.
      if (pa.actions.size > 0 && pb.actions.size > 0) {
        let actionMatch = false;
        for (const marker of pa.actions) {
          if (pb.actions.has(marker)) {
            actionMatch = true;
            break;
          }
        }
        if (!actionMatch) continue;
      }

      let sharedWeight = 0;
      let weightA = 0;
      let weightB = 0;
      let sharedRare = 0;
      let anchored = false;
      for (const stem of pa.top) {
        const w = idfWeight(ctx.stats, stem);
        weightA += w;
        if (!pb.top.has(stem)) continue;
        sharedWeight += w;
        if ((ctx.stats.df.get(stem) ?? 1) <= ctx.stats.rareDfMax) {
          sharedRare++;
          // Either-side anchor, mirroring isStrongFingerprint: one side
          // observing the stem capitalized mid-title proves properness.
          if (pa.proper.has(stem) || pb.proper.has(stem)) anchored = true;
        }
      }
      for (const stem of pb.top) weightB += idfWeight(ctx.stats, stem);
      if (sharedRare < MIN_SHARED_RARE_STEMS || !anchored) continue;
      const overlap = sharedWeight / Math.min(weightA, weightB);
      if (overlap >= CLUSTER_MERGE_MIN_OVERLAP) {
        uf.union(a, b);
        mergedAny = true;
      }
    }
  }
  if (!mergedAny) return groups;

  const mergedGroups = new Map<number, number[]>();
  for (let g = 0; g < groups.length; g++) {
    const root = uf.find(g);
    const target = mergedGroups.get(root);
    if (target) target.push(...groups[g]);
    else mergedGroups.set(root, [...groups[g]]);
  }
  return [...mergedGroups.values()];
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
  previous?: StoryCluster,
  takenIds?: Set<string>,
): StoryCluster {
  const sorted = [...members].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const lead = pickLead(members);

  // Stable cluster identity: the previous run's id when the story already
  // existed, else anchored on the earliest article's canonical URL. The
  // derived id is bumped deterministically while it collides with an id
  // already taken this run — without this, the losing fragment of a split
  // story re-mints the exact id its old cluster kept (its anchor article IS
  // the URL the original id was hashed from).
  let id = previous?.id ?? `c${stableId(`cluster:${earliest.canonicalUrl}`)}`;
  for (let bump = 2; previous === undefined && takenIds?.has(id); bump++) {
    id = `c${stableId(`cluster:${earliest.canonicalUrl}#${bump}`)}`;
  }
  takenIds?.add(id);
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

  // Cluster content type (see types.ts): press_release when EVERY member is
  // a press release — syndicated copies of one release stay a press-release
  // cluster no matter how many domains carry them. Otherwise the lead's type
  // (one real news report means the event has genuine coverage, but a
  // press-release lead still labels the page truthfully).
  const contentType = members.every((m) => m.contentType === "press_release")
    ? ("press_release" as const)
    : (lead.contentType ?? ("news" as const));

  const { category, categoryStreak } = applyCategoryHysteresis(
    pickCategory(members, lead),
    members,
    previous,
  );

  return {
    id,
    slug: `${slugify(lead.title)}-${id}`,
    title: lead.title,
    summary: lead.description,
    category,
    categoryStreak,
    contentType,
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

/**
 * Cluster category by member MAJORITY, not by whichever member happens to
 * be lead. The lead changes as coverage and images arrive, and one member
 * with a keyword-free headline classifying "general" must not relabel a
 * story that three other outlets classify "world" (the live World→General
 * flapping case). Rules, all deterministic:
 *  - general votes are ignored unless EVERY member is general — the
 *    low-confidence bucket never outvotes actual evidence;
 *  - highest vote count wins; when the lead's category ties the top count,
 *    the lead's category is preferred (label matches the displayed lead);
 *  - remaining ties break alphabetically.
 */
export function pickCategory(members: Article[], lead: Article): Article["category"] {
  const counts = new Map<Article["category"], number>();
  for (const member of members) {
    if (member.category === "general") continue;
    counts.set(member.category, (counts.get(member.category) ?? 0) + 1);
  }
  if (counts.size === 0) return "general";
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const topCount = sorted[0][1];
  if (counts.get(lead.category) === topCount) return lead.category;
  return sorted[0][0];
}

/**
 * Category hysteresis for carried-over stories: the fresh majority vote is
 * adopted immediately when it agrees with the previous generation's category
 * or when membership genuinely changed (symmetric difference of member URLs
 * greater than 1 — the vote moved because the story moved). With unchanged
 * membership a disagreeing vote must repeat for 2 consecutive generations
 * before it wins, so a single borderline re-vote can never flip a story's
 * category between two adjacent page loads, and A→B→A flapping is
 * impossible. The streak lives on the cluster itself and round-trips
 * through the DB snapshot, giving cross-instance continuity.
 */
function applyCategoryHysteresis(
  fresh: Article["category"],
  members: Article[],
  previous: StoryCluster | undefined,
): { category: Article["category"]; categoryStreak?: StoryCluster["categoryStreak"] } {
  if (!previous || fresh === previous.category) return { category: fresh };

  const current = new Set(members.map((m) => m.canonicalUrl));
  const before = new Set(previous.articles.map((m) => m.canonicalUrl));
  let symmetricDiff = 0;
  for (const url of current) if (!before.has(url)) symmetricDiff++;
  for (const url of before) if (!current.has(url)) symmetricDiff++;
  if (symmetricDiff > 1) return { category: fresh };

  const count =
    previous.categoryStreak?.candidate === fresh
      ? previous.categoryStreak.count + 1
      : 1;
  if (count >= 2) return { category: fresh };
  return {
    category: previous.category,
    categoryStreak: { candidate: fresh, count },
  };
}

/**
 * Majority geography across members. US_CA only when the minority side is a
 * REAL fraction of the cluster — at least 2 members or at least a third of
 * the US+CA votes — so one misclassified member can never drag a whole US
 * story onto the Canada surface (or vice versa). Otherwise the majority
 * country wins outright.
 */
export function pickCountry(members: Article[]): StoryCluster["country"] {
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.country, (counts.get(member.country) ?? 0) + 1);
  }
  const us = (counts.get("US") ?? 0) + (counts.get("US_CA") ?? 0);
  const ca = (counts.get("CA") ?? 0) + (counts.get("US_CA") ?? 0);
  const minority = Math.min(us, ca);
  if (minority >= 2 || (minority > 0 && minority / (us + ca) >= 1 / 3)) {
    return "US_CA";
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as StoryCluster["country"];
}
