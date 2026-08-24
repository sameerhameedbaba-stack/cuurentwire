import { HUBS, HUB_IDS, type HubDefinition, type HubId } from "@/config/hubs";
import { lookupSourceByName } from "@/config/sources";
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

/**
 * Factual coverage stats for one hub, over the hub's FULL story set (not the
 * page-capped slice), for the snapshot line the hub renders.
 *
 * Why this exists: on 2026-08-25 the first URL-Inspection sweep found all 15
 * hubs "Discovered — currently not indexed" while being in the sitemap,
 * index,follow, internally linked and 2,000+ words long. Nothing was broken —
 * Google was declining index budget on pages that only re-list other
 * publishers' headlines. These counts are the one thing on a hub page that is
 * ours and exists nowhere else, so the page stops being a pure list
 * (seo/STRATEGY.md BET 2). Every field is a plain count over data already in
 * memory: no new IO, no added ISR cost.
 *
 * Honesty rules baked in: counts are lower bounds over the publishers this
 * site tracks (never "all coverage"), `broadest` is null unless a story
 * genuinely carries 2+ publications, and nothing here is sourced from
 * dataset-wide ingestion figures — attributing a whole-run number to one hub
 * would be a fabricated metric.
 */
export interface HubStats {
  /** Stories in the hub before HUB_PAGE_LIMIT. */
  total: number;
  /** Distinct publisher names across the hub's stories. */
  publishers: number;
  /**
   * The subset of `publishers` found in config/sources.ts. The pipeline
   * admits publishers we do not track (normalize keeps the provider-supplied
   * name, resolveTier defaults them to C), so `publishers` alone could
   * EXCEED the tracked-publications denominator in rendered copy — the
   * red-team catch of 2026-08-25. Any "N of the M we tier" sentence must
   * use this field as N.
   */
  trackedPublishers: number;
  /** Stories carrying two or more publications. */
  multiSource: number;
  /** The most widely covered story, only when it has 2+ publications. */
  broadest: { title: string; slug: string; sourceCount: number } | null;
}

/**
 * Counts use sourceNames/sourceCount deliberately: hub pages render LIVE
 * dataset clusters whose story cards show the same sourceCount, so the
 * snapshot line and the cards beneath it can never disagree on one page.
 * (The documented sourceCount drift is an archive-rebuild phenomenon —
 * lib/database/archive.ts — and archive clusters never enter this index.)
 */
export function hubStats(dataset: NewsDataset, hubId: HubId): HubStats {
  const stories = indexFor(dataset).get(hubId)!;
  const publishers = new Set<string>();
  let multiSource = 0;
  let broadest: StoryCluster | null = null;
  for (const story of stories) {
    for (const name of story.sourceNames) publishers.add(name);
    if (story.sourceCount >= 2) {
      multiSource += 1;
      if (!broadest || story.sourceCount > broadest.sourceCount) broadest = story;
    }
  }
  let trackedPublishers = 0;
  for (const name of publishers) {
    if (lookupSourceByName(name)) trackedPublishers += 1;
  }
  return {
    total: stories.length,
    publishers: publishers.size,
    trackedPublishers,
    multiSource,
    broadest: broadest
      ? { title: broadest.title, slug: broadest.slug, sourceCount: broadest.sourceCount }
      : null,
  };
}
