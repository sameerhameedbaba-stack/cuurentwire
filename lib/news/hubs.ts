import { HUBS, HUB_IDS, type HubDefinition, type HubId } from "@/config/hubs";
import { isTop100Eligible } from "@/lib/news/ranking/score";
import type { NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * Topic-hub membership: deterministic vocabulary matching over headline and
 * summary, computed once per dataset version and memoized.
 *
 * Rule: a keyword hit in the HEADLINE scores 2, in the summary 1 (each
 * distinct keyword counts once); any negative phrase anywhere subtracts 2.
 * A story joins the hub at score >= 2 — so one headline keyword qualifies,
 * or two summary keywords, and a single summary mention of a broad word
 * ("school", "storm") never does on its own.
 */
const MEMBERSHIP_THRESHOLD = 2;

/** Page and sitemap cap — a hub lists the top of its ranking, not a feed. */
export const HUB_PAGE_LIMIT = 40;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary matcher with optional plural "s": bounded by non-alphanumerics
 * so "ai" never fires inside "said" and "gm" never inside "gmail", while
 * "judge's" still matches "judge". Built once per hub.
 */
function buildMatcher(terms: readonly string[]): RegExp | null {
  if (terms.length === 0) return null;
  const alternatives = terms
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    // Longest first so "rate cut" is tried before "rate".
    .sort((a, b) => b.length - a.length)
    .map((t) => `${escapeRegex(t)}s?`);
  return new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})(?![a-z0-9])`, "g");
}

interface CompiledHub {
  def: HubDefinition;
  keywords: RegExp | null;
  negatives: RegExp | null;
}

const compiled: Record<HubId, CompiledHub> = Object.fromEntries(
  HUB_IDS.map((id) => [
    id,
    {
      def: HUBS[id],
      keywords: buildMatcher(HUBS[id].keywords),
      negatives: buildMatcher(HUBS[id].negatives ?? []),
    },
  ]),
) as Record<HubId, CompiledHub>;

function distinctHits(regex: RegExp | null, text: string): number {
  if (!regex || !text) return 0;
  const seen = new Set<string>();
  regex.lastIndex = 0;
  for (const match of text.matchAll(regex)) seen.add(match[0]);
  return seen.size;
}

/** Membership score for one story against one hub (exported for tests). */
export function hubScore(
  hubId: HubId,
  story: { title: string; summary?: string | null },
): number {
  const hub = compiled[hubId];
  const title = ` ${story.title.toLowerCase()} `;
  const summary = ` ${(story.summary ?? "").toLowerCase()} `;
  let score = distinctHits(hub.keywords, title) * 2 + distinctHits(hub.keywords, summary);
  if (score === 0) return 0;
  score -= distinctHits(hub.negatives, `${title}${summary}`) * 2;
  return Math.max(0, score);
}

export function matchesHub(
  hubId: HubId,
  story: { title: string; summary?: string | null },
): boolean {
  return hubScore(hubId, story) >= MEMBERSHIP_THRESHOLD;
}

/** Every hub a story belongs to. */
export function hubsForStory(story: {
  title: string;
  summary?: string | null;
}): HubId[] {
  return HUB_IDS.filter((id) => matchesHub(id, story));
}

type HubIndex = Map<HubId, StoryCluster[]>;

// Two most recent dataset versions: the serving version plus the one a
// revalidation may be rendering against.
const indexCache = new Map<string, HubIndex>();

function indexFor(dataset: NewsDataset): HubIndex {
  const cached = indexCache.get(dataset.datasetVersion);
  if (cached) return cached;
  const index: HubIndex = new Map(HUB_IDS.map((id) => [id, []]));
  // Ranked order is the dataset order; press releases and other
  // non-news stay out, exactly as on the Top 100.
  for (const cluster of dataset.clusters) {
    if (!isTop100Eligible(cluster)) continue;
    for (const id of HUB_IDS) {
      if (matchesHub(id, cluster)) index.get(id)!.push(cluster);
    }
  }
  indexCache.set(dataset.datasetVersion, index);
  if (indexCache.size > 2) {
    const oldest = indexCache.keys().next().value;
    if (oldest) indexCache.delete(oldest);
  }
  return index;
}

/** Ranked stories for a hub, capped at HUB_PAGE_LIMIT. */
export function hubStories(dataset: NewsDataset, hubId: HubId): StoryCluster[] {
  return indexFor(dataset).get(hubId)!.slice(0, HUB_PAGE_LIMIT);
}

/** Story count per hub (before the page cap) — sitemap/index gating. */
export function hubCounts(dataset: NewsDataset): Record<HubId, number> {
  const index = indexFor(dataset);
  return Object.fromEntries(
    HUB_IDS.map((id) => [id, index.get(id)!.length]),
  ) as Record<HubId, number>;
}
