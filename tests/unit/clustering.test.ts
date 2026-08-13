import { describe, expect, it } from "vitest";
import { clusterArticles, pickLead } from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import type { Article, RawArticle } from "@/lib/news/types";

const NOW = new Date("2026-08-13T12:00:00Z");

function makeArticle(
  title: string,
  domain: string,
  minutesAgo: number,
  overrides: Partial<RawArticle> = {},
): Article {
  const article = normalizeArticle(
    {
      title,
      description: "Shared description for clustering tests of this event.",
      url: `https://${domain}/story-${Math.abs(minutesAgo)}`,
      source: domain,
      publishedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
      provider: "test",
      providerCategory: "business",
      ...overrides,
    },
    NOW,
  );
  if (!article) throw new Error("test article failed to normalize");
  return article;
}

describe("clusterArticles", () => {
  it("groups reworded headlines about the same event", () => {
    const articles = [
      makeArticle(
        "Federal Reserve holds benchmark interest rate steady after policy meeting",
        "outlet-a.com",
        30,
      ),
      makeArticle(
        "Federal Reserve keeps benchmark interest rate unchanged at policy meeting",
        "outlet-b.com",
        25,
      ),
      makeArticle(
        "Fed holds benchmark interest rate steady after latest policy meeting",
        "outlet-c.com",
        20,
      ),
    ];
    const clusters = clusterArticles(articles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sourceCount).toBe(3);
    expect(clusters[0].articles.every((a) => a.clusterId === clusters[0].id)).toBe(true);
  });

  it("keeps unrelated stories separate", () => {
    const articles = [
      makeArticle(
        "Federal Reserve holds benchmark interest rate steady after meeting",
        "outlet-a.com",
        30,
      ),
      makeArticle(
        "Wildfire crews respond to active fires across the provincial interior",
        "outlet-b.com",
        25,
        { providerCategory: "climate" },
      ),
    ];
    const clusters = clusterArticles(articles, NOW);
    expect(clusters).toHaveLength(2);
  });

  it("does not merge same-headline stories published days apart", () => {
    const articles = [
      makeArticle("Monthly jobs report shows hiring pace moderating", "outlet-a.com", 60),
      makeArticle(
        "Monthly jobs report shows hiring pace moderating",
        "outlet-b.com",
        60 * 60, // 60 hours earlier — outside the 48h window
      ),
    ];
    const clusters = clusterArticles(articles, NOW);
    expect(clusters).toHaveLength(2);
  });

  it("builds cluster metadata from members", () => {
    const clusters = clusterArticles(
      [
        makeArticle("Federal Reserve holds interest rate steady after meeting", "outlet-a.com", 45),
        makeArticle("Federal Reserve holds interest rate steady, officials say", "outlet-b.com", 10),
      ],
      NOW,
    );
    expect(clusters).toHaveLength(1);
    const cluster = clusters[0];
    expect(new Date(cluster.firstPublishedAt).getTime()).toBeLessThan(
      new Date(cluster.lastPublishedAt).getTime(),
    );
    expect(cluster.slug.endsWith(cluster.id)).toBe(true);
  });
});

describe("pickLead", () => {
  it("prefers the highest-tier, most complete article", () => {
    const tierC = makeArticle("Rate decision holds steady says small outlet", "tiny.example.net", 5);
    const tierA = makeArticle(
      "Rate decision holds steady says wire service",
      "reuters.com",
      50,
      { source: "Reuters" },
    );
    expect(pickLead([tierC, tierA]).source).toBe("Reuters");
  });
});
