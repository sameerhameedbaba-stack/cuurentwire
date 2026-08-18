import { describe, expect, it } from "vitest";
import {
  NEWS_SITEMAP_MAX_ENTRIES,
  NEWS_SITEMAP_WINDOW_HOURS,
  renderNewsSitemap,
} from "@/lib/seo/news-sitemap";
import type { Article, StoryCluster } from "@/lib/news/types";

const NOW = new Date("2026-08-14T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "a1",
    slug: "an-article",
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
    entities: [],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  const lead = makeArticle();
  return {
    id: "c1",
    slug: "a-story-c1",
    title: "A story",
    category: "politics",
    country: "US",
    articles: [lead],
    lead,
    sourceCount: 1,
    sourceNames: ["Example Wire"],
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

describe("renderNewsSitemap", () => {
  it("renders a valid empty urlset for empty input", () => {
    const xml = renderNewsSitemap([], NOW);
    expect(xml).toContain(`<?xml version="1.0" encoding="UTF-8"?>`);
    expect(xml).toContain(`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`);
    expect(xml).toContain(`xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`);
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("<url>");
  });

  it("renders loc, publication, dates and title for a fresh cluster", () => {
    const first = hoursAgo(10);
    const last = hoursAgo(1);
    const xml = renderNewsSitemap(
      [makeCluster({ slug: "big-story-c1", title: "Big story", firstPublishedAt: first, lastPublishedAt: last })],
      NOW,
    );
    expect(xml).toContain("<loc>http://localhost:3000/story/big-story-c1</loc>");
    expect(xml).toContain("<news:name>CurrentWire</news:name>");
    expect(xml).toContain("<news:language>en</news:language>");
    expect(xml).toContain(`<news:publication_date>${first}</news:publication_date>`);
    expect(xml).toContain("<news:title>Big story</news:title>");
    expect(xml).toContain(`<lastmod>${last}</lastmod>`);
  });

  it("XML-escapes & < > \" ' in titles", () => {
    const xml = renderNewsSitemap(
      [makeCluster({ title: `Bonnie & Clyde's <heist> "story"` })],
      NOW,
    );
    expect(xml).toContain(
      "<news:title>Bonnie &amp; Clyde&apos;s &lt;heist&gt; &quot;story&quot;</news:title>",
    );
    expect(xml).not.toContain(`Clyde's <heist>`);
  });

  it("excludes mock clusters", () => {
    const xml = renderNewsSitemap(
      [makeCluster({ isMock: true, slug: "mock-story-c9" })],
      NOW,
    );
    expect(xml).not.toContain("mock-story-c9");
    expect(xml).not.toContain("<url>");
  });

  it(`excludes clusters older than ${NEWS_SITEMAP_WINDOW_HOURS} hours`, () => {
    const xml = renderNewsSitemap(
      [
        makeCluster({ slug: "stale-c2", lastPublishedAt: hoursAgo(49) }),
        makeCluster({ slug: "fresh-c3", lastPublishedAt: hoursAgo(47) }),
      ],
      NOW,
    );
    expect(xml).not.toContain("stale-c2");
    expect(xml).toContain("fresh-c3");
  });

  it("sorts newest coverage first", () => {
    const xml = renderNewsSitemap(
      [
        makeCluster({ slug: "older-c4", lastPublishedAt: hoursAgo(10) }),
        makeCluster({ slug: "newer-c5", lastPublishedAt: hoursAgo(1) }),
      ],
      NOW,
    );
    expect(xml.indexOf("newer-c5")).toBeLessThan(xml.indexOf("older-c4"));
  });

  it(`caps at ${NEWS_SITEMAP_MAX_ENTRIES} entries`, () => {
    const clusters = Array.from({ length: NEWS_SITEMAP_MAX_ENTRIES + 5 }, (_, i) =>
      makeCluster({ slug: `story-${i}-c${i}`, lastPublishedAt: hoursAgo(1) }),
    );
    const xml = renderNewsSitemap(clusters, NOW);
    expect(xml.match(/<url>/g)?.length).toBe(NEWS_SITEMAP_MAX_ENTRIES);
  });

  it("never emits duplicate locs", () => {
    const xml = renderNewsSitemap(
      [
        makeCluster({ id: "c6", slug: "same-slug-c6" }),
        makeCluster({ id: "c7", slug: "same-slug-c6" }),
      ],
      NOW,
    );
    expect(xml.match(/same-slug-c6/g)?.length).toBe(1);
  });

  it("prefers archive first_seen_at as publication_date, falling back to firstPublishedAt", () => {
    const firstCoverage = hoursAgo(10);
    const firstSeen = hoursAgo(9);
    const xml = renderNewsSitemap(
      [
        makeCluster({ id: "c1", slug: "archived-c1", firstPublishedAt: firstCoverage }),
        makeCluster({ id: "c2", slug: "unarchived-c2", firstPublishedAt: firstCoverage }),
      ],
      NOW,
      new Map([["c1", firstSeen]]),
    );
    expect(xml).toContain(`<news:publication_date>${firstSeen}</news:publication_date>`);
    expect(xml).toContain(`<news:publication_date>${firstCoverage}</news:publication_date>`);
  });

  it("skips clusters with invalid dates instead of crashing", () => {
    const xml = renderNewsSitemap(
      [makeCluster({ slug: "bad-date-c8", lastPublishedAt: "not-a-date" })],
      NOW,
    );
    expect(xml).not.toContain("bad-date-c8");
    expect(xml).toContain("</urlset>");
  });

  it(`excludes clusters whose publication_date is older than ${NEWS_SITEMAP_WINDOW_HOURS} hours even when coverage is fresh`, () => {
    // A story we published 3 days ago that picked up new source coverage today:
    // Google rejects the entry because publication_date is outside the window.
    const xml = renderNewsSitemap(
      [
        makeCluster({
          slug: "old-publication-c10",
          firstPublishedAt: hoursAgo(72),
          lastPublishedAt: hoursAgo(1),
        }),
      ],
      NOW,
    );
    expect(xml).not.toContain("old-publication-c10");
    expect(xml).not.toContain("<url>");
  });

  it("excludes clusters whose archive first_seen_at is outside the window", () => {
    const xml = renderNewsSitemap(
      [
        makeCluster({
          id: "c11",
          slug: "old-first-seen-c11",
          firstPublishedAt: hoursAgo(3),
          lastPublishedAt: hoursAgo(1),
        }),
      ],
      NOW,
      new Map([["c11", hoursAgo(60)]]),
    );
    expect(xml).not.toContain("old-first-seen-c11");
  });

  it("keeps a cluster whose archive first_seen_at is fresh even if source coverage is older", () => {
    const firstSeen = hoursAgo(2);
    const xml = renderNewsSitemap(
      [
        makeCluster({
          id: "c12",
          slug: "late-discovery-c12",
          firstPublishedAt: hoursAgo(47),
          lastPublishedAt: hoursAgo(47),
        }),
      ],
      NOW,
      new Map([["c12", firstSeen]]),
    );
    expect(xml).toContain("late-discovery-c12");
    expect(xml).toContain(`<news:publication_date>${firstSeen}</news:publication_date>`);
  });

  it("skips clusters with an unparseable publication_date", () => {
    const xml = renderNewsSitemap(
      [
        makeCluster({
          id: "c13",
          slug: "bad-publication-c13",
          firstPublishedAt: "not-a-date",
        }),
      ],
      NOW,
    );
    expect(xml).not.toContain("bad-publication-c13");
    expect(xml).toContain("</urlset>");
  });
});
