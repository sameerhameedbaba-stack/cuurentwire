import type { CategoryId } from "@/config/categories";
import type { NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * Durable per-publisher facts for a `/source/<slug>` hub.
 *
 * Why this exists: on 2026-08-25 a crawl of `/source/bbc-news` found 870
 * words of which essentially all were headline text from the story links,
 * a title of "BBC News — Latest stories", and no publisher-level facts at
 * all (seo/BACKLOG.md item 3). A source hub that publishes nothing durable
 * competes only for the publisher's own brand name, where the publisher
 * always wins. Competitors (AllSides, Ground News) win those queries with
 * per-outlet reference pages.
 *
 * What this adds instead is the one thing CurrentWire can say and nobody
 * else computes: how this publisher's reporting sits inside a corroborated
 * cluster set — how much of it is carried by other publications, how often
 * it is the account we lead with, and which sections it actually files in.
 * Same design contract as `hubStats` in lib/news/hubs.ts: plain counts over
 * a dataset already in memory, so no new IO and no added ISR cost.
 *
 * Honesty rules baked in, matching the hub snapshot:
 * - Every figure is scoped to the CURRENT dataset window, never all-time.
 *   Callers must say so in the rendered copy.
 * - Corroboration counts are LOWER BOUNDS over the publications this site
 *   ingests; other outlets may have covered a story without being tracked.
 * - Nothing here is, or may be rendered as, a bias or factuality rating.
 *   CurrentWire deliberately publishes neither (seo/BACKLOG.md item 3), and
 *   authority tiers are explicitly not one.
 * - `mostCorroborated` stays null unless a story genuinely carries 2+
 *   publications, so the copy can never imply breadth that is not there.
 */
export interface SourceProfile {
  /** Articles from this publisher in the current window. */
  articles: number;
  /** Distinct stories (clusters) those articles belong to. */
  stories: number;
  /** Of `stories`, those also carried by at least one other publication. */
  corroborated: number;
  /** Of `stories`, those where this publisher is the account we lead with. */
  led: number;
  /** Sections this publisher filed in, most-filed first. */
  sections: { id: CategoryId; count: number }[];
  /** Oldest and newest publish timestamps in the window (ISO), or null. */
  earliest: string | null;
  latest: string | null;
  /** The publisher most often reporting the same stories, if any. */
  topCoPublisher: { name: string; shared: number } | null;
  /** Their most widely corroborated story, only at 2+ publications. */
  mostCorroborated: { title: string; slug: string; sourceCount: number } | null;
}

/**
 * Articles carry `clusterId`; a publisher's article is only counted once per
 * cluster, because two wire pickups of one story are one story, not two.
 * Articles with no cluster (not yet clustered in this generation) count
 * toward `articles` but contribute to nothing that claims a story count —
 * inflating `stories` with unclustered rows would overstate coverage.
 */
export function sourceProfile(
  dataset: NewsDataset,
  sourceSlug: string,
): SourceProfile {
  const clustersById = new Map<string, StoryCluster>(
    dataset.clusters.map((cluster) => [cluster.id, cluster]),
  );
  const sectionCounts = new Map<CategoryId, number>();
  const seenClusters = new Set<string>();
  const coPublishers = new Map<string, number>();

  let articles = 0;
  let corroborated = 0;
  let led = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  let mostCorroborated: StoryCluster | null = null;

  for (const article of dataset.articles) {
    if (article.sourceSlug !== sourceSlug) continue;
    articles += 1;
    if (!earliest || article.publishedAt < earliest) earliest = article.publishedAt;
    if (!latest || article.publishedAt > latest) latest = article.publishedAt;

    const cluster = article.clusterId ? clustersById.get(article.clusterId) : undefined;
    if (!cluster || seenClusters.has(cluster.id)) continue;
    seenClusters.add(cluster.id);

    sectionCounts.set(cluster.category, (sectionCounts.get(cluster.category) ?? 0) + 1);
    if (cluster.lead.sourceSlug === sourceSlug) led += 1;
    if (cluster.sourceCount >= 2) {
      corroborated += 1;
      if (!mostCorroborated || cluster.sourceCount > mostCorroborated.sourceCount) {
        mostCorroborated = cluster;
      }
      for (const name of cluster.sourceNames) {
        // The publisher's own name is in its own clusters; skip it rather
        // than reporting an outlet as its own most frequent partner.
        if (name === cluster.lead.source && cluster.lead.sourceSlug === sourceSlug) continue;
        coPublishers.set(name, (coPublishers.get(name) ?? 0) + 1);
      }
    }
  }

  // The publisher's own display name is whatever its articles carry; drop
  // every spelling of it from the co-publisher tally by matching the slug
  // through the cluster members rather than trusting one label.
  const ownNames = new Set<string>();
  for (const article of dataset.articles) {
    if (article.sourceSlug === sourceSlug) ownNames.add(article.source);
  }
  let topCoPublisher: { name: string; shared: number } | null = null;
  for (const [name, shared] of coPublishers) {
    if (ownNames.has(name)) continue;
    if (!topCoPublisher || shared > topCoPublisher.shared) {
      topCoPublisher = { name, shared };
    }
  }

  const sections = [...sectionCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    // Ties broken by section id so the rendered order is deterministic and
    // two renders of one dataset can never disagree.
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  return {
    articles,
    stories: seenClusters.size,
    corroborated,
    led,
    sections,
    earliest,
    latest,
    topCoPublisher,
    mostCorroborated: mostCorroborated
      ? {
          title: mostCorroborated.title,
          slug: mostCorroborated.slug,
          sourceCount: mostCorroborated.sourceCount,
        }
      : null,
  };
}

/**
 * Human label for the span an outlet's stories cover, e.g. "the past 3 days".
 * Rendered into ISR-cached HTML, so it is deliberately coarse: a figure that
 * changes every minute would make the cached copy wrong between renders,
 * and the claim is about a window, not a timestamp.
 *
 * Returns null when there is nothing to describe (no stories, or a span
 * under an hour) rather than printing "the past 0 hours".
 */
export function windowSpanLabel(
  earliest: string | null,
  latest: string | null,
): string | null {
  if (!earliest || !latest) return null;
  const ms = new Date(latest).getTime() - new Date(earliest).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return null;
  if (hours < 36) return `the past ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `the past ${days} ${days === 1 ? "day" : "days"}`;
}
