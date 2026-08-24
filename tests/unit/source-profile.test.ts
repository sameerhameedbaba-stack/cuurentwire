import { describe, expect, it } from "vitest";
import { sourceProfile, windowSpanLabel } from "@/lib/news/source-profile";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * Guards the per-publisher facts rendered on `/source/<slug>` (seo/BACKLOG.md
 * item 3). The honesty properties matter more than the arithmetic here: every
 * count is a lower bound over one dataset window, so a bug that inflates one
 * of them puts a wrong number in front of a reader as a fact about a real
 * publisher.
 */
function article(
  id: string,
  sourceSlug: string,
  overrides: Partial<Article> = {},
): Article {
  return {
    id,
    slug: `a-${id}`,
    title: `Headline ${id}`,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    source: sourceSlug === "bbc-news" ? "BBC News" : "Reuters",
    sourceSlug,
    sourceDomain: "example.com",
    sourceTier: "A",
    publishedAt: "2026-08-25T10:00:00.000Z",
    country: "US",
    category: "politics",
    categories: ["politics"],
    entities: [],
    provider: "test",
    ...overrides,
  } as unknown as Article;
}

function cluster(
  id: string,
  sourceNames: string[],
  leadSlug: string,
  overrides: Partial<StoryCluster> = {},
): StoryCluster {
  return {
    id,
    slug: `story-${id}`,
    title: `Story ${id}`,
    category: "politics",
    country: "US",
    articles: [],
    lead: { source: sourceNames[0], sourceSlug: leadSlug },
    sourceCount: sourceNames.length,
    sourceNames,
    entities: [],
    firstPublishedAt: "2026-08-25T09:00:00.000Z",
    lastPublishedAt: "2026-08-25T10:00:00.000Z",
    rankingScore: 50,
    isMock: false,
    ...overrides,
  } as unknown as StoryCluster;
}

function dataset(articles: Article[], clusters: StoryCluster[]): NewsDataset {
  return {
    articles,
    clusters,
    trending: [],
    generatedAt: "2026-08-25T12:00:00.000Z",
    datasetVersion: `v-${articles.length}-${clusters.length}`,
    dataMode: "live",
  } as unknown as NewsDataset;
}

describe("sourceProfile", () => {
  it("counts reports, distinct stories, corroboration and lead credit", () => {
    const data = dataset(
      [
        article("1", "bbc-news", { clusterId: "c1" }),
        article("2", "bbc-news", { clusterId: "c2" }),
        article("3", "bbc-news", { clusterId: "c3" }),
        article("9", "reuters", { clusterId: "c1" }),
      ],
      [
        cluster("c1", ["BBC News", "Reuters"], "bbc-news"),
        cluster("c2", ["BBC News"], "bbc-news"),
        cluster("c3", ["Reuters", "BBC News"], "reuters"),
      ],
    );
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.articles).toBe(3);
    expect(profile.stories).toBe(3);
    // c1 and c3 carry two publications; c2 carries one.
    expect(profile.corroborated).toBe(2);
    // We lead with BBC on c1 and c2, with Reuters on c3.
    expect(profile.led).toBe(2);
  });

  it("counts a story once even when the publisher filed twice into it", () => {
    // Two wire pickups of one story are one story. Inflating `stories` with
    // the second row would overstate coverage on the rendered page.
    const data = dataset(
      [
        article("1", "bbc-news", { clusterId: "c1" }),
        article("2", "bbc-news", { clusterId: "c1" }),
      ],
      [cluster("c1", ["BBC News", "Reuters"], "bbc-news")],
    );
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.articles).toBe(2);
    expect(profile.stories).toBe(1);
    expect(profile.corroborated).toBe(1);
  });

  it("never counts an unclustered article as a story", () => {
    const data = dataset([article("1", "bbc-news")], []);
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.articles).toBe(1);
    expect(profile.stories).toBe(0);
    expect(profile.corroborated).toBe(0);
    expect(profile.mostCorroborated).toBeNull();
  });

  it("mostCorroborated stays null unless a story really has 2+ publications", () => {
    const data = dataset(
      [article("1", "bbc-news", { clusterId: "c1" })],
      [cluster("c1", ["BBC News"], "bbc-news")],
    );
    expect(sourceProfile(data, "bbc-news").mostCorroborated).toBeNull();
  });

  it("picks the widest corroborated story", () => {
    const data = dataset(
      [
        article("1", "bbc-news", { clusterId: "c1" }),
        article("2", "bbc-news", { clusterId: "c2" }),
      ],
      [
        cluster("c1", ["BBC News", "Reuters"], "bbc-news"),
        cluster("c2", ["BBC News", "Reuters", "AP", "NPR"], "bbc-news"),
      ],
    );
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.mostCorroborated).toEqual({
      title: "Story c2",
      slug: "story-c2",
      sourceCount: 4,
    });
  });

  it("never reports a publisher as its own most frequent partner", () => {
    const data = dataset(
      [
        article("1", "bbc-news", { clusterId: "c1" }),
        article("2", "bbc-news", { clusterId: "c2" }),
      ],
      [
        cluster("c1", ["BBC News", "Reuters"], "bbc-news"),
        cluster("c2", ["BBC News", "Reuters"], "bbc-news"),
      ],
    );
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.topCoPublisher).toEqual({ name: "Reuters", shared: 2 });
  });

  it("orders sections by count with a deterministic tie-break", () => {
    const data = dataset(
      [
        article("1", "bbc-news", { clusterId: "c1" }),
        article("2", "bbc-news", { clusterId: "c2" }),
        article("3", "bbc-news", { clusterId: "c3" }),
      ],
      [
        cluster("c1", ["BBC News"], "bbc-news", { category: "world" }),
        cluster("c2", ["BBC News"], "bbc-news", { category: "world" }),
        cluster("c3", ["BBC News"], "bbc-news", { category: "business" }),
      ],
    );
    expect(sourceProfile(data, "bbc-news").sections).toEqual([
      { id: "world", count: 2 },
      { id: "business", count: 1 },
    ]);
  });

  it("reports the publish window from the publisher's own rows only", () => {
    const data = dataset(
      [
        article("1", "bbc-news", {
          clusterId: "c1",
          publishedAt: "2026-08-24T06:00:00.000Z",
        }),
        article("2", "bbc-news", {
          clusterId: "c1",
          publishedAt: "2026-08-25T06:00:00.000Z",
        }),
        // Another publisher's much older row must not widen the window.
        article("9", "reuters", {
          clusterId: "c1",
          publishedAt: "2020-01-01T00:00:00.000Z",
        }),
      ],
      [cluster("c1", ["BBC News", "Reuters"], "bbc-news")],
    );
    const profile = sourceProfile(data, "bbc-news");
    expect(profile.earliest).toBe("2026-08-24T06:00:00.000Z");
    expect(profile.latest).toBe("2026-08-25T06:00:00.000Z");
  });

  it("returns an empty profile for a publisher with nothing in the window", () => {
    const profile = sourceProfile(dataset([], []), "bbc-news");
    expect(profile).toEqual({
      articles: 0,
      stories: 0,
      corroborated: 0,
      led: 0,
      sections: [],
      earliest: null,
      latest: null,
      topCoPublisher: null,
      mostCorroborated: null,
    });
  });
});

describe("windowSpanLabel", () => {
  it("describes hours below a day and a half, days above it", () => {
    expect(
      windowSpanLabel("2026-08-25T06:00:00.000Z", "2026-08-25T12:00:00.000Z"),
    ).toBe("the past 6 hours");
    expect(
      windowSpanLabel("2026-08-22T12:00:00.000Z", "2026-08-25T12:00:00.000Z"),
    ).toBe("the past 3 days");
  });

  it("singularises one hour and one day", () => {
    expect(
      windowSpanLabel("2026-08-25T11:00:00.000Z", "2026-08-25T12:00:00.000Z"),
    ).toBe("the past 1 hour");
    expect(
      windowSpanLabel("2026-08-23T12:00:00.000Z", "2026-08-25T00:00:00.000Z"),
    ).toBe("the past 2 days");
  });

  it("returns null rather than printing an empty or negative span", () => {
    expect(windowSpanLabel(null, null)).toBeNull();
    expect(windowSpanLabel("2026-08-25T12:00:00.000Z", null)).toBeNull();
    // Same instant, and a reversed pair, both describe nothing.
    expect(
      windowSpanLabel("2026-08-25T12:00:00.000Z", "2026-08-25T12:00:00.000Z"),
    ).toBeNull();
    expect(
      windowSpanLabel("2026-08-25T12:00:00.000Z", "2026-08-25T06:00:00.000Z"),
    ).toBeNull();
    expect(windowSpanLabel("nonsense", "2026-08-25T12:00:00.000Z")).toBeNull();
  });
});
