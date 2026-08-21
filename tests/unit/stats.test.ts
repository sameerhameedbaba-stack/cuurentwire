import { describe, expect, it } from "vitest";
import { computeCoverageDistribution, computeFeedValueStats } from "@/lib/news/stats";
import type {
  Article,
  FeedHealth,
  RawArticle,
  StoryCluster,
} from "@/lib/news/types";

const NOW = new Date("2026-08-22T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "a1",
    slug: "an-article-a1",
    title: "An article",
    url: "https://example.com/a",
    canonicalUrl: "https://example.com/a",
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example.com",
    sourceTier: "A",
    publishedAt: hoursAgo(2),
    country: "US",
    category: "politics",
    categories: ["politics"],
    contentType: "news",
    entities: [],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  const lead = overrides.articles?.[0] ?? makeArticle();
  const names = [...new Set((overrides.articles ?? [lead]).map((a) => a.source))];
  return {
    id: "c1",
    slug: "a-story-c1",
    title: "A story",
    category: "politics",
    country: "US",
    contentType: "news",
    articles: [lead],
    lead,
    sourceCount: names.length,
    sourceNames: names,
    entities: [],
    firstPublishedAt: hoursAgo(4),
    lastPublishedAt: hoursAgo(2),
    rankingScore: 50,
    rankingBreakdown: {
      freshness: 20, authority: 10, coverage: 10, geography: 5,
      prominence: 3, velocity: 2, total: 50,
    },
    status: null,
    isBreaking: false,
    isMock: false,
    ...overrides,
  };
}

function makeRaw(feedUrl: string | undefined): RawArticle {
  return {
    title: "raw",
    url: "https://example.com/raw",
    source: "Example Wire",
    publishedAt: hoursAgo(1),
    provider: feedUrl ? "rss" : "gnews",
    ...(feedUrl ? { feedUrl } : {}),
  };
}

function health(overrides: Partial<FeedHealth> & { url: string }): FeedHealth {
  return { ok: true, itemsParsed: 0, itemsSkipped: 0, durationMs: 100, ...overrides };
}

describe("computeCoverageDistribution", () => {
  it("is all zeros for an empty run", () => {
    expect(computeCoverageDistribution([])).toEqual({
      clusters: 0,
      singleSource: 0,
      twoSource: 0,
      threeSource: 0,
      fourPlus: 0,
      multiSourcePct: 0,
      threePlusPct: 0,
      fourPlusPct: 0,
      medianIndependentPublications: 0,
      meanIndependentPublications: 0,
      pressReleasePct: 0,
      opinionPct: 0,
      generalCategoryPct: 0,
    });
  });

  it("buckets clusters by distinct publications and derives percentages", () => {
    const clusters = [
      makeCluster({ id: "s1", sourceCount: 1, contentType: "press_release" }),
      makeCluster({ id: "s2", sourceCount: 2, contentType: "opinion", category: "general" }),
      makeCluster({ id: "s3", sourceCount: 3 }),
      makeCluster({ id: "s4", sourceCount: 5 }),
    ];
    const d = computeCoverageDistribution(clusters);
    expect(d.clusters).toBe(4);
    expect([d.singleSource, d.twoSource, d.threeSource, d.fourPlus]).toEqual([1, 1, 1, 1]);
    expect(d.multiSourcePct).toBe(75);
    expect(d.threePlusPct).toBe(50);
    expect(d.fourPlusPct).toBe(25);
    // Even count: mean of the middle pair (2 and 3).
    expect(d.medianIndependentPublications).toBe(2.5);
    expect(d.meanIndependentPublications).toBe(2.75);
    expect(d.pressReleasePct).toBe(25);
    expect(d.opinionPct).toBe(25);
    expect(d.generalCategoryPct).toBe(25);
  });

  it("takes the middle value as median for an odd count and rounds to one decimal", () => {
    const clusters = [1, 1, 3, 4, 9].map((n, i) =>
      makeCluster({ id: `s${i}`, sourceCount: n }),
    );
    const d = computeCoverageDistribution(clusters);
    expect(d.medianIndependentPublications).toBe(3);
    expect(d.meanIndependentPublications).toBe(3.6);
    // 3 of 5 have ≥2 publications → 60%; 1 of 3 third → 33.3%.
    expect(d.multiSourcePct).toBe(60);
    expect(computeCoverageDistribution(clusters.slice(0, 3)).threePlusPct).toBe(33.3);
  });
});

describe("computeFeedValueStats", () => {
  const FEED_A = "https://a.example.com/rss";
  const FEED_B = "https://b.example.com/rss";
  const FEED_DEAD = "https://dead.example.com/rss";
  const FEED_UNLISTED = "https://unlisted.example.com/rss";

  // Feed A: a1 (earliest in a two-publication cluster), a3 (singleton),
  // a4 (press release, singleton). A wire article with no feedUrl shares
  // cluster c1. Feed B produced items but none survived; FEED_DEAD failed.
  const a1 = makeArticle({ id: "a1", publishedAt: hoursAgo(5), source: "A Wire" });
  const wire = makeArticle({ id: "w1", publishedAt: hoursAgo(3), source: "Other Wire" });
  const a3 = makeArticle({ id: "a3", source: "A Wire" });
  const a4 = makeArticle({ id: "a4", source: "A Wire", contentType: "press_release" });
  const u1 = makeArticle({ id: "u1", source: "Unlisted" });
  const clusters = [
    makeCluster({ id: "c1", articles: [wire, a1] }),
    makeCluster({ id: "c2", articles: [a3] }),
    makeCluster({ id: "c3", articles: [a4], contentType: "press_release" }),
    makeCluster({ id: "c4", articles: [u1] }),
  ];
  const rawByArticleId = new Map<string, RawArticle>([
    ["a1", makeRaw(FEED_A)],
    ["a3", makeRaw(FEED_A)],
    ["a4", makeRaw(FEED_A)],
    ["w1", makeRaw(undefined)],
    ["u1", makeRaw(FEED_UNLISTED)],
  ]);
  const feedHealth = [
    health({ url: FEED_A, itemsParsed: 5, durationMs: 250 }),
    health({ url: FEED_B, itemsParsed: 2 }),
    health({ url: FEED_DEAD, ok: false, error: "503", durationMs: 8_000 }),
  ];
  const rows = computeFeedValueStats({
    rawByArticleId,
    articles: [a1, wire, a3, a4, u1],
    clusters,
    feedHealth,
  });
  const byUrl = new Map(rows.map((r) => [r.url, r]));

  it("attributes accepted articles, clusters, singletons, joins and first-observed", () => {
    expect(byUrl.get(FEED_A)).toEqual({
      url: FEED_A,
      publisher: "a.example.com",
      received: 5,
      accepted: 3,
      rejected: 2,
      clustersJoined: 3,
      singletonClusters: 2,
      multiSourceJoins: 1,
      firstObserved: 1,
      pressReleases: 1,
      ok: true,
      durationMs: 250,
      singletonRate: 0.667,
      joinRate: 0.333,
      firstObservedRate: 0.333,
      noiseRate: 0.6,
    });
  });

  it("lists zero-article and failed feeds with zero counts and their health", () => {
    expect(byUrl.get(FEED_B)).toMatchObject({
      received: 2,
      accepted: 0,
      rejected: 2,
      clustersJoined: 0,
      ok: true,
      singletonRate: 0,
      joinRate: 0,
      firstObservedRate: 0,
      noiseRate: 1,
    });
    expect(byUrl.get(FEED_DEAD)).toMatchObject({
      received: 0,
      accepted: 0,
      rejected: 0,
      ok: false,
      durationMs: 8_000,
      noiseRate: 0,
    });
  });

  it("keeps configured order first and appends feeds missing from the health list", () => {
    expect(rows.map((r) => r.url)).toEqual([FEED_A, FEED_B, FEED_DEAD, FEED_UNLISTED]);
    expect(byUrl.get(FEED_UNLISTED)).toMatchObject({
      received: 1,
      accepted: 1,
      rejected: 0,
      ok: true,
      durationMs: 0,
    });
  });

  it("ignores articles whose raw item carries no feed URL (other providers)", () => {
    expect(rows.some((r) => r.accepted > 0 && r.url === "")).toBe(false);
    expect(rows.reduce((sum, r) => sum + r.accepted, 0)).toBe(4);
  });

  it("credits first-observed to the feed with the earliest publishedAt only", () => {
    const late = makeArticle({ id: "l1", publishedAt: hoursAgo(1), source: "A Wire" });
    const early = makeArticle({ id: "e1", publishedAt: hoursAgo(6), source: "B Wire" });
    const result = computeFeedValueStats({
      rawByArticleId: new Map([
        ["l1", makeRaw(FEED_A)],
        ["e1", makeRaw(FEED_B)],
      ]),
      articles: [late, early],
      clusters: [makeCluster({ id: "c9", articles: [late, early] })],
      feedHealth: [health({ url: FEED_A, itemsParsed: 1 }), health({ url: FEED_B, itemsParsed: 1 })],
    });
    const byFeed = new Map(result.map((r) => [r.url, r.firstObserved]));
    expect(byFeed.get(FEED_A)).toBe(0);
    expect(byFeed.get(FEED_B)).toBe(1);
  });
});
