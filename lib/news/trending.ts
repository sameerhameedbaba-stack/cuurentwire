import type { StoryCluster, TrendingTopic } from "@/lib/news/types";
import { slugify } from "@/lib/utils/text";

/**
 * Trending topics derived from entity frequency across ranked clusters —
 * never hardcoded. Weight combines how many stories mention the entity and
 * how important those stories are.
 */
export function deriveTrending(clusters: StoryCluster[], limit = 8): TrendingTopic[] {
  const topics = new Map<
    string,
    { display: string; clusterCount: number; articleCount: number; score: number }
  >();

  for (const cluster of clusters) {
    for (const entity of cluster.entities.slice(0, 4)) {
      // Skip bare country names — they are navigation, not topics.
      const lower = entity.toLowerCase();
      if (lower === "united states" || lower === "canada") continue;
      const existing = topics.get(lower);
      if (existing) {
        existing.clusterCount++;
        existing.articleCount += cluster.articles.length;
        existing.score += cluster.rankingScore;
      } else {
        topics.set(lower, {
          display: entity,
          clusterCount: 1,
          articleCount: cluster.articles.length,
          score: cluster.rankingScore,
        });
      }
    }
  }

  return [...topics.values()]
    .filter((t) => t.clusterCount >= 2 || t.articleCount >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((t) => ({
      topic: t.display,
      slug: slugify(t.display, 60),
      articleCount: t.articleCount,
      clusterCount: t.clusterCount,
      score: Math.round(t.score),
    }));
}
