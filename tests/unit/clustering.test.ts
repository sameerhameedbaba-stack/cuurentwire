import { beforeEach, describe, expect, it } from "vitest";
import {
  clusterArticles,
  pickCategory,
  pickCountry,
  pickLead,
} from "@/lib/news/clustering/cluster";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import {
  clearPreviousDataset,
  setPreviousDataset,
} from "@/lib/news/previous";
import type { Article, NewsDataset, RawArticle } from "@/lib/news/types";
import { stableId } from "@/lib/utils/text";
import { MISSIONARY_QUAD } from "../fixtures/cluster-pairs";

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

  it("clusters all four live missionary variants as one event (validation must not evict any)", () => {
    const domains = ["abc.example", "npr.example", "bbc.example", "cbs.example"];
    const articles = MISSIONARY_QUAD.map((title, i) =>
      makeArticle(title, domains[i], 30 + i * 15, { providerCategory: undefined }),
    );
    const clusters = clusterArticles(articles, NOW);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].sourceCount).toBe(4);
  });

  it("cluster category is stable across lead changes (no World→General flapping)", () => {
    const domains = ["abc.example", "npr.example", "bbc.example", "cbs.example"];
    for (const rotation of [0, 1, 2, 3]) {
      const articles = MISSIONARY_QUAD.map((title, i) =>
        makeArticle(title, domains[i], 30 + ((i + rotation) % 4) * 15, {
          providerCategory: undefined,
          // Vary completeness so different rotations pick different leads.
          imageUrl: i === rotation ? "https://img.example/a.jpg" : undefined,
        }),
      );
      const clusters = clusterArticles(articles, NOW);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].category).toBe("world");
    }
  });

  it("pickCategory: majority vote, general never outvotes evidence, deterministic ties", () => {
    const world = (id: string) =>
      ({ ...makeArticle("Sanctions imposed after diplomatic summit collapses", `${id}.example`, 30), category: "world" as const });
    const general = (id: string) =>
      ({ ...makeArticle("Five things to know before the weekend arrives", `${id}.example`, 30), category: "general" as const });
    const politics = (id: string) =>
      ({ ...makeArticle("Senate passes sweeping bill after marathon session", `${id}.example`, 30), category: "politics" as const });

    // 3 world + 1 general, general lead: world wins.
    const g = general("g1");
    expect(pickCategory([world("w1"), world("w2"), world("w3"), g], g)).toBe("world");
    // All general: general.
    expect(pickCategory([general("g2"), general("g3")], general("g2"))).toBe("general");
    // Tie politics/world with a politics lead: lead's category wins the tie.
    const p = politics("p1");
    expect(pickCategory([p, world("w4")], p)).toBe("politics");
    // Tie with a general lead: alphabetical, deterministic.
    const g2 = general("g4");
    expect(pickCategory([politics("p2"), world("w5"), g2], g2)).toBe("politics");
  });

  it("pickCountry: majority wins unless the minority is a real fraction", () => {
    const withCountry = (country: Article["country"], id: string) => ({
      ...makeArticle("Border officials outline new crossing procedures today", `${id}.example`, 30),
      country,
    });
    const us = (id: string) => withCountry("US", id);
    const ca = (id: string) => withCountry("CA", id);

    // One dissenting member out of five is noise, not a cross-border story.
    expect(pickCountry([us("u1"), us("u2"), us("u3"), us("u4"), ca("c1")])).toBe("US");
    expect(pickCountry([ca("c2"), ca("c3"), ca("c4"), ca("c5"), us("u5")])).toBe("CA");
    // Two members on the minority side is real cross-border coverage.
    expect(pickCountry([us("u6"), us("u7"), ca("c6"), ca("c7")])).toBe("US_CA");
    // A 1/2 minority share qualifies even with a single member.
    expect(pickCountry([us("u8"), ca("c8")])).toBe("US_CA");
    // A 1/3 share qualifies too.
    expect(pickCountry([us("u9"), us("u10"), ca("c9")])).toBe("US_CA");
    // Non-US/CA majorities pass through untouched.
    expect(pickCountry([withCountry("GLOBAL", "g1"), withCountry("GLOBAL", "g2")])).toBe("GLOBAL");
    // A single US_CA member votes on both sides.
    expect(pickCountry([withCountry("US_CA", "b1")])).toBe("US_CA");
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

  it("never mints duplicate ids when a story splits (2026-08-14 live incident)", () => {
    // Run 1: one cluster of A (earliest — its canonical URL mints the id)
    // and B. Run 2: the same two articles no longer merge (B was re-titled),
    // and B's fragment wins the greedy claim on the previous id. A's
    // fragment must NOT re-derive that exact id from A's URL — that
    // duplicate id broke every story_clusters upsert for a day.
    const articleA = makeArticle(
      "Federal Reserve holds benchmark interest rate steady after policy meeting",
      "outlet-a.com",
      90,
    );
    const articleB = makeArticle(
      "Federal Reserve keeps benchmark interest rate unchanged at policy meeting",
      "outlet-b.com",
      25,
    );
    const firstRun = clusterArticles([articleA, articleB], NOW);
    expect(firstRun).toHaveLength(1);
    const mintedFromA = `c${stableId(`cluster:${articleA.canonicalUrl}`)}`;
    expect(firstRun[0].id).toBe(mintedFromA);
    setPreviousDataset({
      articles: firstRun[0].articles,
      clusters: firstRun,
    } as unknown as NewsDataset);

    // B re-titled to an unrelated story (same URL), listed FIRST so its
    // singleton group wins the overlap tie and takes the previous id.
    const retitledB = makeArticle(
      "Wildfire crews respond to active fires across the provincial interior",
      "outlet-b.com",
      25,
    );
    const splitRun = clusterArticles([retitledB, articleA], NOW);
    expect(splitRun).toHaveLength(2);

    const ids = splitRun.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const winner = splitRun.find((c) => c.lead.canonicalUrl === retitledB.canonicalUrl);
    const loser = splitRun.find((c) => c.lead.canonicalUrl === articleA.canonicalUrl);
    expect(winner?.id).toBe(mintedFromA);
    expect(loser?.id).toBe(`c${stableId(`cluster:${articleA.canonicalUrl}#2`)}`);
    expect(loser?.slug.endsWith(loser!.id)).toBe(true);
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
