import { classifyCategory } from "@/lib/news/classification/category";
import type { Article, StoryCluster } from "@/lib/news/types";

/**
 * Data-quality monitors for the admin dashboard. Pure functions over the
 * current dataset — they FLAG for inspection, they never mutate anything
 * (the audit is explicit: do not auto-correct based on these heuristics).
 */

export interface PossibleFalseSplit {
  entity: string;
  aId: string;
  aTitle: string;
  bId: string;
  bTitle: string;
  /** Hours between the two clusters' publication midpoints. */
  gapHours: number;
}

const FALSE_SPLIT_MAX_GAP_HOURS = 6;
/** An entity shared by more clusters than this is too generic to signal. */
const FALSE_SPLIT_MAX_CLUSTERS_PER_ENTITY = 2;
const FALSE_SPLIT_MAX_RESULTS = 20;

/**
 * Likely false splits: two different clusters that share a rare multi-word
 * entity (person/organization names — single words are too generic) and
 * were published within a few hours of each other. High-precision signal
 * surface for the admin page; merging remains the clustering engine's job.
 */
export function detectPossibleFalseSplits(
  clusters: StoryCluster[],
): PossibleFalseSplit[] {
  const byEntity = new Map<string, { display: string; clusters: StoryCluster[] }>();
  for (const cluster of clusters) {
    for (const entity of cluster.entities) {
      if (!entity.includes(" ")) continue;
      const key = entity.toLowerCase();
      const entry = byEntity.get(key);
      if (entry) {
        if (!entry.clusters.some((c) => c.id === cluster.id)) {
          entry.clusters.push(cluster);
        }
      } else {
        byEntity.set(key, { display: entity, clusters: [cluster] });
      }
    }
  }

  const results: PossibleFalseSplit[] = [];
  const seenPairs = new Set<string>();
  for (const { display, clusters: shared } of byEntity.values()) {
    if (shared.length < 2 || shared.length > FALSE_SPLIT_MAX_CLUSTERS_PER_ENTITY) {
      continue;
    }
    for (let i = 0; i < shared.length; i++) {
      for (let j = i + 1; j < shared.length; j++) {
        const a = shared[i];
        const b = shared[j];
        const pairKey = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (seenPairs.has(pairKey)) continue;
        const midpoint = (c: StoryCluster) =>
          (new Date(c.firstPublishedAt).getTime() +
            new Date(c.lastPublishedAt).getTime()) /
          2;
        const gapHours = Math.abs(midpoint(a) - midpoint(b)) / 3_600_000;
        if (gapHours > FALSE_SPLIT_MAX_GAP_HOURS) continue;
        seenPairs.add(pairKey);
        results.push({
          entity: display,
          aId: a.id,
          aTitle: a.title,
          bId: b.id,
          bTitle: b.title,
          gapHours: Math.round(gapHours * 10) / 10,
        });
      }
    }
    if (results.length >= FALSE_SPLIT_MAX_RESULTS) break;
  }
  return results.slice(0, FALSE_SPLIT_MAX_RESULTS);
}

export interface ClassificationQualitySummary {
  /** Articles in the internal general (low-confidence) bucket. */
  generalCount: number;
  /** Articles whose specific category was assigned with confidence < 0.2. */
  lowConfidenceCount: number;
  /** Article counts per primary category, descending. */
  distribution: { category: string; count: number }[];
}

/**
 * Classification quality summary for the admin page. Confidence is
 * recomputed deterministically from the same inputs normalization used
 * (title + description) — identical output, nothing stored twice.
 */
export function summarizeClassificationQuality(
  articles: Article[],
): ClassificationQualitySummary {
  const counts = new Map<string, number>();
  let generalCount = 0;
  let lowConfidenceCount = 0;
  for (const article of articles) {
    counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    if (article.category === "general") {
      generalCount++;
      continue;
    }
    const result = classifyCategory({
      title: article.title,
      description: article.description,
    });
    if (result.confidence < 0.2) lowConfidenceCount++;
  }
  return {
    generalCount,
    lowConfidenceCount,
    distribution: [...counts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}
