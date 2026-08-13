import { beforeEach, describe, expect, it } from "vitest";
import { clusterArticles, pickLead } from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import {
  clearPreviousDataset,
  setPreviousDataset,
} from "@/lib/news/previous";
import type { Article, NewsDataset, RawArticle } from "@/lib/news/types";

const NOW = new Date("2026-08-13T12:00:00Z");

// The previous-run registry is global state — every test starts cold.
beforeEach(() => clearPreviousDataset());

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

describe("clusterArticles category decoupling", () => {
  it("merges the same event across different primary categories", () => {
    // One outlet's copy classifies as politics, the other as business —
    // category must be a soft signal, not a wall.
    const a = makeArticle(
      "Senate approves sweeping tariff bill on steel imports after late vote",
      "outlet-a.com",
      30,
      { providerCategory: "politics" },
    );
    const b = makeArticle(
      "Senate approves sweeping tariff bill on steel imports in late vote",
      "outlet-b.com",
      20,
      { providerCategory: "business" },
    );
    expect(a.category).not.toBe(b.category);
    const clusters = clusterArticles([a, b], NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sourceCount).toBe(2);
  });
});

describe("clusterArticles anti-chaining validation", () => {
  it("evicts members far from the cluster lead into singletons", () => {
    // A and C each resemble bridge B, but A and C barely resemble each other.
    // Transitive union-find alone would chain all three together.
    const articles = [
      makeArticle(
        "Federal Reserve holds benchmark interest rate steady after policy meeting",
        "outlet-a.com",
        30,
      ),
      makeArticle(
        "Federal Reserve interest rate decision sparks housing market debate",
        "outlet-b.com",
        25,
      ),
      makeArticle(
        "Housing market debate intensifies as mortgage costs squeeze buyers",
        "outlet-c.com",
        20,
      ),
    ];
    const clusters = clusterArticles(articles, NOW);
    // Whatever merges, no cluster may contain both the rate story and the
    // mortgage story — they are far below the similarity floor.
    for (const cluster of clusters) {
      const titles = cluster.articles.map((a) => a.title);
      expect(
        titles.some((t) => t.includes("policy meeting")) &&
          titles.some((t) => t.includes("mortgage costs")),
      ).toBe(false);
    }
  });
});

describe("clusterArticles previous-run id continuity", () => {
  const buildRun = () =>
    clusterArticles(
      [
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
      ],
      NOW,
    );

  it("reuses the previous cluster id when members overlap", () => {
    const firstRun = buildRun();
    expect(firstRun).toHaveLength(1);
    const previousId = "c0123456789ab";
    const previous = {
      articles: firstRun[0].articles,
      clusters: [{ ...firstRun[0], id: previousId }],
    } as unknown as NewsDataset;
    setPreviousDataset(previous);

    // Same event, now with an extra (earlier) member — without the registry
    // the id would re-derive from the new earliest article.
    const grown = clusterArticles(
      [
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
          90,
        ),
      ],
      NOW,
    );
    expect(grown).toHaveLength(1);
    expect(grown[0].id).toBe(previousId);
    expect(grown[0].slug.endsWith(previousId)).toBe(true);
  });

  it("is deterministic and unchanged when the registry is empty", () => {
    const first = buildRun();
    const second = buildRun();
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).toMatch(/^c[0-9a-f]{12}$/);
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
