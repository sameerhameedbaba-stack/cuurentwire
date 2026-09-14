/**
 * Keyword targeting for the slim relaunch, at $0.
 *
 * The owner's instruction (2026-09-15): write the article as original prose
 * from the facts, but "search how we need to post the content with keywords
 * to bring the traffic". So keyword research must happen BEFORE the writing,
 * and it must shape the headline and structure — not be sprinkled over a
 * finished draft. Sprinkling is keyword stuffing; Google has penalised it
 * for two decades and our domain cannot afford a second strike.
 *
 * The research budget is zero, so there is no Ahrefs/Semrush here. Instead we
 * use the one keyword dataset we already own and that is strictly better than
 * a third-party estimate: Search Console's record of queries real people
 * typed that ALREADY showed this domain, with the impressions and average
 * position each earned. A third-party tool guesses national volume; GSC tells
 * us what we specifically can win.
 *
 * Priority order, best opportunity first:
 *
 *   1. STRIKING DISTANCE — queries where we already rank ~5-20. Google has
 *      decided we are relevant; a genuinely better page is the whole job.
 *      Cheapest possible traffic.
 *   2. IMPRESSED BUT BURIED — queries earning impressions at a poor position.
 *      Demand is proven, our page is not yet the answer.
 *   3. ENTITY — the story's own named subjects. No history yet (new stories
 *      have none by definition), but these are what a reader will actually
 *      type.
 *
 * Every target carries its evidence, so a brief can say WHY a phrase is worth
 * targeting instead of asserting it.
 */

import type { StoryCluster } from "@/lib/news/types";
import { significantTokens } from "@/lib/utils/text";

/** One Search Console query row (data/gsc-queries.json). */
export interface GscQueryRow {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  /** Present on striking-distance rows: the page already ranking. */
  page?: string;
}

export type KeywordOrigin =
  | "gsc-striking-distance"
  | "gsc-impressed"
  | "cluster-entity";

export interface KeywordTarget {
  phrase: string;
  origin: KeywordOrigin;
  /** Search Console evidence, absent for entity-derived targets. */
  impressions?: number;
  position?: number;
  /** Opportunity score; higher is a better use of one article. */
  score: number;
  /** Plain-English justification for the brief. */
  rationale: string;
}

/**
 * Positions that count as "striking distance": close enough that Google
 * already ranks us, far enough that almost nobody clicks. Page-one-bottom
 * through page-two.
 */
export const STRIKING_MIN_POSITION = 4;
export const STRIKING_MAX_POSITION = 20;

/** Below this overlap a query is about a different story. */
const MIN_QUERY_OVERLAP = 0.34;

/** Query rows thinner than this are noise, not demand. */
const MIN_IMPRESSIONS = 2;

/**
 * Fraction of a query's tokens that must appear in the story's own text.
 *
 * Containment, not Jaccard: a short query ("tommy john") should match a long
 * headline that covers it, and symmetric similarity would wrongly punish the
 * length difference. We ask "is this query about this story", not "are these
 * two strings alike".
 */
function queryOverlap(queryTokens: string[], storyTokens: Set<string>): number {
  if (queryTokens.length === 0) return 0;
  let hits = 0;
  for (const token of queryTokens) if (storyTokens.has(token)) hits++;
  return hits / queryTokens.length;
}

/** Every token the story is "about": headline, summary, entities. */
function storyTokenSet(
  cluster: Pick<StoryCluster, "title" | "summary" | "entities">,
): Set<string> {
  const text = [cluster.title, cluster.summary ?? "", ...cluster.entities].join(" ");
  return new Set(significantTokens(text));
}

/**
 * Opportunity score for a query we already rank for.
 *
 * Impressions measure proven demand; position measures how much headroom a
 * better page has. A query at position 12 with 14 impressions is worth far
 * more than one at position 95 with 26 — the second is a ranking we are not
 * going to close with one article. The position term therefore falls away
 * sharply past page two rather than scaling linearly.
 */
function opportunityScore(impressions: number, position: number): number {
  const demand = Math.log2(impressions + 1);
  const headroom =
    position <= STRIKING_MAX_POSITION
      ? 1 + (STRIKING_MAX_POSITION - position) / STRIKING_MAX_POSITION
      : Math.max(0.15, STRIKING_MAX_POSITION / position);
  return Number((demand * headroom).toFixed(4));
}

export interface KeywordTargetOptions {
  /** How many targets to return. */
  limit?: number;
  /** Striking-distance rows (gsc-queries.json `strikingDistance`). */
  strikingDistance?: GscQueryRow[];
}

/**
 * Rank the keyword targets one article should be built around.
 *
 * Returns at most `limit` targets, best opportunity first. The FIRST target
 * is the one the headline should serve; the rest belong in subheads and body
 * where they fit naturally. If a phrase cannot be used in a sentence a human
 * would write, it must be dropped — that rule lives in the brief, and the
 * writing step is bound by it.
 */
export function keywordTargets(
  cluster: Pick<StoryCluster, "title" | "summary" | "entities">,
  webQueries: GscQueryRow[],
  options: KeywordTargetOptions = {},
): KeywordTarget[] {
  const { limit = 5, strikingDistance = [] } = options;
  const storyTokens = storyTokenSet(cluster);
  const targets: KeywordTarget[] = [];
  const seen = new Set<string>();

  const push = (target: KeywordTarget) => {
    const key = target.phrase.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };

  // 1. Striking distance — already ranking, just not winning.
  for (const row of strikingDistance) {
    if (row.impressions < MIN_IMPRESSIONS) continue;
    if (queryOverlap(significantTokens(row.query), storyTokens) < MIN_QUERY_OVERLAP) continue;
    push({
      phrase: row.query,
      origin: "gsc-striking-distance",
      impressions: row.impressions,
      position: row.position,
      score: opportunityScore(row.impressions, row.position) * 1.5,
      rationale:
        `Already ranking at position ${row.position.toFixed(1)} with ` +
        `${row.impressions} impressions — Google accepts us as relevant, so a ` +
        `better page on this phrase is the cheapest traffic available.`,
    });
  }

  // 2. Proven demand, poor position.
  for (const row of webQueries) {
    if (row.impressions < MIN_IMPRESSIONS) continue;
    if (queryOverlap(significantTokens(row.query), storyTokens) < MIN_QUERY_OVERLAP) continue;
    const striking =
      row.position >= STRIKING_MIN_POSITION && row.position <= STRIKING_MAX_POSITION;
    push({
      phrase: row.query,
      origin: striking ? "gsc-striking-distance" : "gsc-impressed",
      impressions: row.impressions,
      position: row.position,
      score: opportunityScore(row.impressions, row.position) * (striking ? 1.5 : 1),
      rationale: striking
        ? `Already ranking at position ${row.position.toFixed(1)} with ` +
          `${row.impressions} impressions — close enough that a better page wins it.`
        : `${row.impressions} impressions at position ${row.position.toFixed(1)} — ` +
          `real demand we are not yet answering.`,
    });
  }

  // 3. The story's own subjects. No search history, but these are what a
  //    reader types, and a new story has no history by definition.
  for (const entity of cluster.entities) {
    push({
      phrase: entity,
      origin: "cluster-entity",
      score: 0.5,
      rationale: "Named subject of the story — what a reader searching for it would type.",
    });
  }

  return targets.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * The single phrase the headline should serve, or undefined when we have no
 * evidence worth bending a headline around.
 *
 * Returning undefined is a real answer, not a failure: forcing a headline to
 * carry a phrase nobody searched is how keyword stuffing starts.
 */
export function primaryTarget(targets: KeywordTarget[]): KeywordTarget | undefined {
  const best = targets[0];
  if (!best) return undefined;
  return best.origin === "cluster-entity" ? undefined : best;
}
