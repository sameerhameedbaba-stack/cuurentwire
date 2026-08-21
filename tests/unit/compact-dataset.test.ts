import { describe, expect, it } from "vitest";
import {
  compactDataset,
  expandDataset,
  expandIfCompact,
  isCompactDataset,
} from "@/lib/news/compact";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

function article(id: string, title: string): Article {
  return {
    id,
    slug: `${id}-slug`,
    title,
    description: `About ${title}`,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    source: "Example",
    sourceSlug: "example",
    sourceDomain: "example.com",
    sourceTier: "B",
    publishedAt: "2026-08-21T12:00:00.000Z",
    country: "US",
    category: "politics",
    categories: ["politics"],
    entities: ["Example"],
    provider: "rss",
    isMock: false,
  };
}

function cluster(id: string, articles: Article[], lead: Article): StoryCluster {
  return {
    id,
    slug: `${id}-story`,
    title: lead.title,
    category: "politics",
    country: "US",
    articles,
    lead,
    sourceCount: new Set(articles.map((a) => a.source)).size,
    sourceNames: [...new Set(articles.map((a) => a.source))],
    entities: ["Example"],
    firstPublishedAt: lead.publishedAt,
    lastPublishedAt: lead.publishedAt,
    rankingScore: 50,
    rankingBreakdown: {
      freshness: 20, authority: 10, coverage: 10, geography: 5, prominence: 3, velocity: 2,
    },
    status: "developing",
    isBreaking: false,
    isMock: false,
  } as StoryCluster;
}

function dataset(): NewsDataset {
  const a1 = article("a1", "First");
  const a2 = article("a2", "Second");
  const a3 = article("a3", "Third");
  return {
    articles: [a1, a2, a3],
    clusters: [cluster("c1", [a1, a2], a1), cluster("c2", [a3], a3)],
    generatedAt: "2026-08-21T12:05:00.000Z",
    datasetVersion: "v1",
    dataMode: "live",
    ingestion: {
      startedAt: "2026-08-21T12:04:00.000Z",
      finishedAt: "2026-08-21T12:05:00.000Z",
      durationMs: 60_000,
      articlesReceived: 3,
      articlesAccepted: 3,
      articlesRejected: 0,
      duplicatesRemoved: 0,
      providers: [],
    },
  } as unknown as NewsDataset;
}

describe("compact dataset wire form", () => {
  it("round-trips to a deep-equal dataset", () => {
    const original = dataset();
    const compact = compactDataset(original);
    expect(isCompactDataset(compact)).toBe(true);
    const restored = expandDataset(JSON.parse(JSON.stringify(compact)));
    expect(restored).toEqual(JSON.parse(JSON.stringify(original)));
    expect(restored.clusters[0].lead.id).toBe("a1");
    expect(restored.clusters[0].articles.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("stores each article once", () => {
    const original = dataset();
    const full = JSON.stringify(original).length;
    const small = JSON.stringify(compactDataset(original)).length;
    expect(small).toBeLessThan(full * 0.7);
  });

  it("carries a lead that is not in dataset.articles", () => {
    const original = dataset();
    const stray = article("a9", "Stray lead");
    original.clusters[1] = cluster("c2", [original.articles[2]], stray);
    const restored = expandDataset(compactDataset(original));
    expect(restored.clusters[1].lead.id).toBe("a9");
  });

  it("expandIfCompact passes plain datasets through", () => {
    const original = dataset();
    expect(expandIfCompact(original)).toBe(original);
    expect(expandIfCompact(compactDataset(original))).toEqual(original);
  });
});

describe("fitToCacheBudget", () => {
  it("leaves a small dataset untouched", async () => {
    const { fitToCacheBudget } = await import("@/lib/news/compact");
    const original = dataset();
    const fit = fitToCacheBudget(original);
    expect(fit.droppedClusters).toBe(0);
    expect(fit.dataset).toBe(original);
  });

  it("drops lowest-ranked clusters and their orphaned articles until it fits", async () => {
    const { fitToCacheBudget, compactDataset: compact } = await import("@/lib/news/compact");
    const original = dataset();
    // Force a tiny budget: only the first cluster should survive.
    const oneClusterBytes = JSON.stringify(
      compact({ ...original, clusters: [original.clusters[0]], articles: original.articles.slice(0, 2) }),
    ).length;
    const fit = fitToCacheBudget(original, oneClusterBytes);
    expect(fit.bytes).toBeLessThanOrEqual(oneClusterBytes);
    expect(fit.dataset.clusters.map((c) => c.id)).toEqual(["c1"]);
    expect(fit.dataset.articles.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(fit.droppedClusters).toBe(1);
    expect(fit.droppedArticles).toBe(1);
  });
});
