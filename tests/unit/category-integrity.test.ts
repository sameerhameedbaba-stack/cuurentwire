import { describe, expect, it, vi } from "vitest";
import { CATEGORY_IDS, PUBLIC_CATEGORY_IDS, type CategoryId } from "@/config/categories";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * Category-page HARD invariant (audit): every story in a category's primary
 * feed satisfies story.category === category. Secondary-category matches
 * appear only in the explicitly labeled `related` list. Enforced for every
 * category over a synthetic dataset that deliberately mixes primary and
 * secondary categories.
 */

const dataset = buildDataset();
vi.mock("@/lib/cache/store", () => ({
  getDataset: async () => dataset,
}));

import { filterClusters, getCategoryData, getHomepageData } from "@/lib/news/queries";

function makeArticle(id: string, category: CategoryId, secondary: CategoryId[]): Article {
  return {
    id,
    slug: `story-${id}`,
    title: `Story ${id} about ${category}`,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example.com",
    sourceTier: "A",
    publishedAt: "2026-08-15T08:00:00.000Z",
    country: "US",
    category,
    categories: [category, ...secondary],
    contentType: "news",
    entities: [],
    provider: "rss",
    isMock: false,
  };
}

function makeCluster(id: string, category: CategoryId, secondary: CategoryId[]): StoryCluster {
  const lead = makeArticle(id, category, secondary);
  return {
    id: `c${id}`,
    slug: `story-${id}-c${id}`,
    title: lead.title,
    category,
    country: "US",
    contentType: "news",
    articles: [lead],
    lead,
    sourceCount: 1,
    sourceNames: [lead.source],
    entities: [],
    firstPublishedAt: lead.publishedAt,
    lastPublishedAt: lead.publishedAt,
    rankingScore: 50,
    rankingBreakdown: {
      freshness: 20, authority: 10, coverage: 5, geography: 10,
      prominence: 5, velocity: 0, total: 50,
    },
    status: null,
    isBreaking: false,
    isMock: false,
  };
}

function buildDataset(): NewsDataset {
  const clusters: StoryCluster[] = [];
  const articles: Article[] = [];
  let n = 0;
  for (const id of CATEGORY_IDS) {
    // Two clusters per category; the second also lists ANOTHER category as
    // a secondary signal — the classic contamination vector.
    const other = CATEGORY_IDS[(CATEGORY_IDS.indexOf(id) + 1) % CATEGORY_IDS.length];
    for (const secondary of [[], [other]] as CategoryId[][]) {
      n++;
      const cluster = makeCluster(`${id}${n}`, id, secondary);
      clusters.push(cluster);
      articles.push(cluster.lead);
    }
  }
  return {
    articles,
    clusters,
    trending: [],
    generatedAt: "2026-08-15T08:05:00.000Z",
    datasetVersion: "20260815T080500Z-test01",
    dataMode: "live",
    ingestion: {} as NewsDataset["ingestion"],
  };
}

describe("category page hard invariant", () => {
  it.each([...CATEGORY_IDS])(
    "/%s primary feed contains ONLY primary-category matches",
    async (category) => {
      const data = await getCategoryData(category);
      const primaryFeed = [
        ...(data.hero ? [data.hero] : []),
        ...data.secondary,
        ...data.more,
      ];
      expect(primaryFeed.length).toBeGreaterThan(0);
      expect(primaryFeed.every((c) => c.category === category)).toBe(true);
      expect(data.latest.every((a) => a.category === category)).toBe(true);
      // Related list holds ONLY other-primary stories touching this category.
      expect(
        data.related.every(
          (c) => c.category !== category && c.lead.categories.includes(category),
        ),
      ).toBe(true);
    },
  );

  it("filterClusters with a category filter matches primary category only", () => {
    for (const category of CATEGORY_IDS) {
      const filtered = filterClusters(dataset.clusters, { category });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((c) => c.category === category)).toBe(true);
    }
  });

  it("homepage section bands match their primary category only", async () => {
    const home = await getHomepageData();
    for (const [sectionId, clusters] of Object.entries(home.sections)) {
      expect(clusters.every((c) => c.category === sectionId)).toBe(true);
    }
  });

  it("general is internal: not in public navigation categories", () => {
    expect(CATEGORY_IDS).toContain("general");
    expect(PUBLIC_CATEGORY_IDS).not.toContain("general");
    expect(PUBLIC_CATEGORY_IDS.length).toBe(CATEGORY_IDS.length - 1);
  });
});
