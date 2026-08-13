import { describe, expect, it } from "vitest";
import type { Article, StoryCluster } from "@/lib/news/types";
import {
  coverageFactor,
  freshnessFactor,
  qualifiesAsBreaking,
  rankClusters,
  scoreCluster,
} from "@/lib/news/ranking/score";

const NOW = new Date("2026-08-13T12:00:00Z");

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: "a1",
    slug: "test-story-a1",
    title: "Test story headline about a policy decision",
    description: "A useful description of the story for testing purposes only.",
    url: "https://example.com/story",
    canonicalUrl: "https://example.com/story",
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example.com",
    sourceTier: "A",
    publishedAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
    country: "US",
    category: "politics",
    categories: ["politics"],
    entities: ["Congress", "Washington"],
    provider: "mock",
    isMock: true,
    ...overrides,
  };
}

function cluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  const lead = article();
  const articles = overrides.articles ?? [lead];
  return {
    id: "c1",
    slug: "test-cluster-c1",
    title: lead.title,
    summary: lead.description,
    category: "politics",
    country: "US",
    imageUrl: "/placeholders/politics-1.svg",
    articles,
    lead: articles[0],
    sourceCount: new Set(articles.map((a) => a.source)).size,
    sourceNames: [...new Set(articles.map((a) => a.source))],
    entities: ["Congress"],
    firstPublishedAt: articles[articles.length - 1]?.publishedAt ?? lead.publishedAt,
    lastPublishedAt: articles[0]?.publishedAt ?? lead.publishedAt,
    rankingScore: 0,
    rankingBreakdown: {
      freshness: 0, authority: 0, coverage: 0,
      geography: 0, prominence: 0, velocity: 0, total: 0,
    },
    status: null,
    isBreaking: false,
    isMock: true,
    ...overrides,
  };
}

describe("freshnessFactor (time decay)", () => {
  it("is 1 at publication and decays monotonically", () => {
    expect(freshnessFactor(0)).toBe(1);
    expect(freshnessFactor(4)).toBeGreaterThan(freshnessFactor(8));
    expect(freshnessFactor(8)).toBeGreaterThan(freshnessFactor(24));
  });

  it("halves roughly every 8 hours", () => {
    expect(freshnessFactor(8)).toBeCloseTo(0.5, 1);
  });

  it("reaches zero at the 72-hour window boundary", () => {
    expect(freshnessFactor(72)).toBe(0);
    expect(freshnessFactor(100)).toBe(0);
  });

  it("tapers between 48h and 72h so old stories cannot dominate", () => {
    expect(freshnessFactor(60)).toBeLessThan(freshnessFactor(48));
    expect(freshnessFactor(71)).toBeGreaterThan(0);
    expect(freshnessFactor(71)).toBeLessThan(0.02);
  });
});

describe("coverageFactor", () => {
  it("rewards breadth on a saturating curve", () => {
    expect(coverageFactor(1)).toBeLessThan(coverageFactor(3));
    expect(coverageFactor(3)).toBeLessThan(coverageFactor(10));
    expect(coverageFactor(12)).toBe(1);
    expect(coverageFactor(50)).toBe(1);
  });
});

describe("scoreCluster", () => {
  it("produces a total within 0–100", () => {
    const breakdown = scoreCluster(cluster(), NOW);
    expect(breakdown.total).toBeGreaterThan(0);
    expect(breakdown.total).toBeLessThanOrEqual(100);
    const sum =
      breakdown.freshness + breakdown.authority + breakdown.coverage +
      breakdown.geography + breakdown.prominence + breakdown.velocity;
    expect(breakdown.total).toBeCloseTo(sum, 0);
  });

  it("ranks a broadly-covered story above a slightly newer single-source story", () => {
    const wellCovered = cluster({
      id: "c-covered",
      articles: Array.from({ length: 8 }, (_, i) =>
        article({
          id: `a${i}`,
          source: `Outlet ${i}`,
          sourceDomain: `outlet${i}.com`,
          canonicalUrl: `https://outlet${i}.com/story`,
          publishedAt: new Date(NOW.getTime() - (40 + i * 5) * 60_000).toISOString(),
        }),
      ),
      sourceCount: 8,
      lastPublishedAt: new Date(NOW.getTime() - 40 * 60_000).toISOString(),
    });
    const minorButNewer = cluster({
      id: "c-minor",
      imageUrl: undefined,
      summary: undefined,
      articles: [
        article({
          id: "solo",
          sourceTier: "C",
          publishedAt: new Date(NOW.getTime() - 2 * 60_000).toISOString(),
        }),
      ],
      sourceCount: 1,
      lastPublishedAt: new Date(NOW.getTime() - 2 * 60_000).toISOString(),
    });
    const ranked = rankClusters([minorButNewer, wellCovered], NOW);
    expect(ranked[0].id).toBe("c-covered");
  });

  it("scores US/Canada stories above purely international ones, all else equal", () => {
    const domestic = scoreCluster(cluster({ country: "CA" }), NOW);
    const international = scoreCluster(cluster({ country: "GLOBAL" }), NOW);
    expect(domestic.geography).toBeGreaterThan(international.geography);
  });
});

describe("breaking flag", () => {
  it("never marks a stale or thinly-covered story as breaking", () => {
    const stale = cluster({
      rankingScore: 95,
      lastPublishedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
    });
    expect(qualifiesAsBreaking(stale, NOW)).toBe(false);

    const thin = cluster({ rankingScore: 95, sourceCount: 1 });
    expect(qualifiesAsBreaking(thin, NOW)).toBe(false);
  });

  it("only the top-ranked story can be breaking", () => {
    const big = cluster({
      id: "c-big",
      articles: Array.from({ length: 6 }, (_, i) =>
        article({
          id: `b${i}`,
          source: `Outlet ${i}`,
          publishedAt: new Date(NOW.getTime() - (10 + i * 4) * 60_000).toISOString(),
        }),
      ),
      sourceCount: 6,
      lastPublishedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
    });
    const alsoBig = cluster({
      id: "c-second",
      articles: Array.from({ length: 5 }, (_, i) =>
        article({
          id: `s${i}`,
          source: `Other ${i}`,
          publishedAt: new Date(NOW.getTime() - (20 + i * 4) * 60_000).toISOString(),
        }),
      ),
      sourceCount: 5,
      imageUrl: undefined,
      lastPublishedAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
    });
    const ranked = rankClusters([big, alsoBig], NOW);
    const breakingCount = ranked.filter((c) => c.isBreaking).length;
    expect(breakingCount).toBeLessThanOrEqual(1);
    if (breakingCount === 1) {
      expect(ranked[0].isBreaking).toBe(true);
    }
  });
});
