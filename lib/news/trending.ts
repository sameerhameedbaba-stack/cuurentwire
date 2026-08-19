import { isTopicEligible, topicIndexFor, topicKey } from "@/lib/news/topics";
import type { StoryCluster, TrendingTopic } from "@/lib/news/types";

/**
 * Trending topics derived from entity frequency across ranked clusters —
 * never hardcoded. Weight combines how many stories mention the entity and
 * how important those stories are.
 *
 * Grouped by TOPIC KEY, not by display string, so "Big Bend" and "Big Bend
 * National Park" pool their evidence into one row pointing at one URL.
 * `clusterCount` comes from the index (every cluster mentioning the topic),
 * which is exactly what /topic/<slug> will list — so the sitemap's
 * shouldIndexCollection() gate can no longer advertise a URL that renders
 * fewer stories than the threshold.
 */
export function deriveTrending(clusters: StoryCluster[], limit = 8): TrendingTopic[] {
  const index = topicIndexFor(clusters);
  const totals = new Map<string, { articleCount: number; score: number }>();

  for (const cluster of clusters) {
    const seen = new Set<string>();
    for (const entity of cluster.entities.slice(0, 4)) {
      const key = topicKey(entity);
      if (!key) continue;
      // Skip bare country names — they are navigation, not topics.
      if (key === "united-states" || key === "canada") continue;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = totals.get(key);
      if (existing) {
        existing.articleCount += cluster.articles.length;
        existing.score += cluster.rankingScore;
      } else {
        totals.set(key, {
          articleCount: cluster.articles.length,
          score: cluster.rankingScore,
        });
      }
    }
  }

  return [...totals.entries()]
    .map(([key, totalsForKey]) => ({
      entry: index.byKey.get(key),
      ...totalsForKey,
    }))
    // A discovered phrase seen in exactly one story is a headline fragment
    // until a second story corroborates it — it never gets a link or a URL.
    .filter((row) => isTopicEligible(row.entry))
    .filter(
      (row) => row.entry!.clusterCount >= 2 || row.articleCount >= 3,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => ({
      topic: row.entry!.display,
      slug: row.entry!.slug,
      articleCount: row.articleCount,
      clusterCount: row.entry!.clusterCount,
      score: Math.round(row.score),
    }));
}
