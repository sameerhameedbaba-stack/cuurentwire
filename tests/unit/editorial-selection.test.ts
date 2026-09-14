import { describe, expect, it } from "vitest";
import type { CategoryId } from "@/config/categories";
import { DAILY_TARGET, MAX_PER_CATEGORY, reasonTally, selectDaily } from "@/lib/editorial/selection";
import type { Article, StoryCluster } from "@/lib/news/types";

let seq = 0;

function makeArticle(overrides: Partial<Article> = {}): Article {
  seq += 1;
  return {
    id: `a${seq}`,
    slug: `story-${seq}`,
    title: "Chipmaker ships new AI accelerator",
    url: "https://apnews.com/tech",
    canonicalUrl: "https://apnews.com/tech",
    source: "Associated Press",
    sourceSlug: "associated-press",
    sourceDomain: "apnews.com",
    sourceTier: "A",
    publishedAt: "2026-09-15T08:00:00.000Z",
    country: "US",
    category: "technology",
    categories: ["technology"],
    contentType: "news",
    entities: [],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

/** A cluster that passes the sourcing gate: two free, independent sources. */
function makeCluster(
  overrides: Partial<StoryCluster> = {},
  articles?: Article[],
): StoryCluster {
  seq += 1;
  const members = articles ?? [
    makeArticle(),
    makeArticle({
      source: "The Verge",
      sourceSlug: "the-verge",
      sourceDomain: "theverge.com",
      url: "https://theverge.com/tech",
      canonicalUrl: "https://theverge.com/tech",
    }),
  ];
  return {
    id: `c${seq}`,
    slug: `cluster-${seq}`,
    title: "Chipmaker ships new AI accelerator",
    category: "technology",
    country: "US",
    articles: members,
    lead: members[0],
    sourceCount: members.length,
    sourceNames: members.map((a) => a.source),
    entities: [],
    firstPublishedAt: "2026-09-15T08:00:00.000Z",
    lastPublishedAt: "2026-09-15T09:00:00.000Z",
    rankingScore: 50,
    rankingBreakdown: {
      freshness: 30, authority: 10, coverage: 5,
      geography: 3, prominence: 1, velocity: 1, total: 50,
    },
    status: "live",
    isBreaking: false,
    isMock: false,
    ...overrides,
  };
}

function cleanClusters(count: number, category: CategoryId = "technology"): StoryCluster[] {
  return Array.from({ length: count }, (_, i) =>
    makeCluster({ category, rankingScore: 100 - i }),
  );
}

describe("selectDaily", () => {
  it("never publishes more than the daily target", () => {
    // Spread across the three launch categories so the per-category cap
    // cannot be what limits the slate.
    const clusters = [
      ...cleanClusters(8, "technology"),
      ...cleanClusters(8, "business"),
      ...cleanClusters(8, "science"),
    ];
    const selection = selectDaily(clusters);
    expect(selection.publish).toHaveLength(DAILY_TARGET);
    expect(selection.shortfall).toBeUndefined();
  });

  it("caps how much of a day one category can own", () => {
    const selection = selectDaily(cleanClusters(20, "technology"));
    expect(selection.publish).toHaveLength(MAX_PER_CATEGORY);
    expect(selection.shortfall).toContain("per-category cap");
  });

  it("publishes in ranking order", () => {
    const clusters = [
      makeCluster({ rankingScore: 10, slug: "low" }),
      makeCluster({ rankingScore: 90, slug: "high" }),
      makeCluster({ rankingScore: 50, slug: "mid" }),
    ];
    const slugs = selectDaily(clusters).publish.map((s) => s.cluster.slug);
    expect(slugs).toEqual(["high", "mid", "low"]);
  });

  it("routes sensitive stories to review instead of publishing them", () => {
    const clusters = [
      makeCluster({ title: "Executive charged with fraud", slug: "crime" }),
      makeCluster({ slug: "clean" }),
    ];
    const selection = selectDaily(clusters);
    expect(selection.publish.map((s) => s.cluster.slug)).toEqual(["clean"]);
    expect(selection.review.map((s) => s.cluster.slug)).toEqual(["crime"]);
  });

  it("separates stories that failed the sourcing gate", () => {
    const thin = makeCluster({ slug: "thin" }, [makeArticle()]);
    const selection = selectDaily([thin, makeCluster({ slug: "clean" })]);
    expect(selection.rejected.map((s) => s.cluster.slug)).toEqual(["thin"]);
    expect(selection.publish.map((s) => s.cluster.slug)).toEqual(["clean"]);
  });

  it("held and rejected stories never occupy a publish slot", () => {
    const clusters = [
      ...cleanClusters(2, "technology"),
      makeCluster({ category: "sports", slug: "held" }),
      makeCluster({ slug: "thin" }, [makeArticle()]),
    ];
    const selection = selectDaily(clusters);
    const publishedSlugs = selection.publish.map((s) => s.cluster.slug);
    expect(publishedSlugs).not.toContain("held");
    expect(publishedSlugs).not.toContain("thin");
    expect(selection.publish.every((s) => s.verdict.autoPublish)).toBe(true);
  });

  it("explains a short slate instead of silently returning fewer", () => {
    const selection = selectDaily([makeCluster({ slug: "thin" }, [makeArticle()])]);
    expect(selection.publish).toHaveLength(0);
    expect(selection.shortfall).toContain("0/10");
    expect(selection.shortfall).toContain("failed the sourcing gate");
  });

  it("handles an empty day without throwing", () => {
    const selection = selectDaily([]);
    expect(selection.publish).toHaveLength(0);
    expect(selection.shortfall).toContain("from 0 clusters");
  });

  it("honours a caller-supplied target and cap", () => {
    const selection = selectDaily(cleanClusters(20, "technology"), {
      target: 3,
      maxPerCategory: 3,
    });
    expect(selection.publish).toHaveLength(3);
  });

  it("widens with the launch scope", () => {
    const clusters = [makeCluster({ category: "sports", slug: "sport" })];
    expect(selectDaily(clusters).publish).toHaveLength(0);
    expect(
      selectDaily(clusters, { launchCategories: ["sports"] }).publish,
    ).toHaveLength(1);
  });
});

describe("reasonTally", () => {
  it("counts why stories did not make the slate", () => {
    const selection = selectDaily([
      makeCluster({ slug: "thin" }, [makeArticle()]),
      makeCluster({ category: "sports", slug: "held" }),
    ]);
    const tally = reasonTally(selection);
    expect(tally["single-source"]).toBe(1);
    expect(tally["outside-launch-categories"]).toBe(1);
  });
});
