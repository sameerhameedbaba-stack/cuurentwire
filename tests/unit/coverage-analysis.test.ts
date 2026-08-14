import { describe, expect, it } from "vitest";
import {
  corroboratedDetails,
  describeUpdateEvent,
  extractNumericPhrases,
  isPressReleaseMember,
  scoreArchiveRelatedness,
  sourceMix,
  titleSimilarity,
} from "@/lib/news/coverage-analysis";
import type { Article, StoryCluster } from "@/lib/news/types";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "a1",
    slug: "senate-passes-rail-safety-bill",
    title: "Senate passes bipartisan rail safety bill",
    url: "https://example-wire.com/rail-safety",
    canonicalUrl: "https://example-wire.com/rail-safety",
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example-wire.com",
    sourceTier: "A",
    publishedAt: "2026-08-14T08:00:00.000Z",
    country: "US",
    category: "politics",
    categories: ["politics"],
    contentType: "news",
    entities: ["Senate"],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

function makeCluster(
  articles: Article[],
  entities: string[] = [],
): Pick<StoryCluster, "articles" | "entities"> {
  return { articles, entities };
}

describe("isPressReleaseMember", () => {
  it("flags explicit press_release content type", () => {
    expect(isPressReleaseMember(makeArticle({ contentType: "press_release" }))).toBe(true);
  });

  it("flags distributor domains even without a content type (archive case)", () => {
    expect(
      isPressReleaseMember(
        makeArticle({ contentType: undefined, sourceDomain: "prnewswire.com" }),
      ),
    ).toBe(true);
  });

  it("treats plain editorial articles as non-press-release", () => {
    expect(isPressReleaseMember(makeArticle())).toBe(false);
    expect(isPressReleaseMember(makeArticle({ contentType: undefined }))).toBe(false);
  });
});

describe("sourceMix", () => {
  it("counts distinct independent domains, press releases and opinion pieces", () => {
    const cluster = makeCluster([
      makeArticle({ id: "a1", sourceDomain: "a.example" }),
      // Same domain as a1 — one more article, not another independent domain.
      makeArticle({ id: "a2", sourceDomain: "a.example" }),
      makeArticle({ id: "a3", sourceDomain: "b.example" }),
      makeArticle({ id: "a4", sourceDomain: "c.example", contentType: "opinion" }),
      makeArticle({ id: "a5", sourceDomain: "globenewswire.com", contentType: "press_release" }),
    ]);
    expect(sourceMix(cluster)).toEqual({
      independentDomains: 3,
      pressReleases: 1,
      opinionOrAnalysis: 1,
      total: 5,
    });
  });

  it("reports 0 independent domains for an all-press-release cluster", () => {
    const cluster = makeCluster([
      makeArticle({ id: "a1", sourceDomain: "globenewswire.com", contentType: "press_release" }),
      makeArticle({ id: "a2", sourceDomain: "syndicated.example", contentType: "press_release" }),
    ]);
    expect(sourceMix(cluster)).toEqual({
      independentDomains: 0,
      pressReleases: 2,
      opinionOrAnalysis: 0,
      total: 2,
    });
  });

  it("excludes untyped distributor-domain members from independence", () => {
    const cluster = makeCluster([
      makeArticle({ id: "a1", sourceDomain: "a.example" }),
      makeArticle({ id: "a2", sourceDomain: "prnewswire.com", contentType: undefined }),
    ]);
    expect(sourceMix(cluster)).toEqual({
      independentDomains: 1,
      pressReleases: 1,
      opinionOrAnalysis: 0,
      total: 2,
    });
  });

  it("counts analysis pieces alongside opinion", () => {
    const cluster = makeCluster([
      makeArticle({ id: "a1", sourceDomain: "a.example", contentType: "analysis" }),
      makeArticle({ id: "a2", sourceDomain: "b.example" }),
    ]);
    expect(sourceMix(cluster).opinionOrAnalysis).toBe(1);
  });
});

describe("extractNumericPhrases", () => {
  it("extracts money, counts, ages and percentages verbatim", () => {
    expect(extractNumericPhrases("Company fined $2 billion by regulator")).toContain("$2 billion");
    expect(extractNumericPhrases("Deal valued at US$40m closes")).toContain("US$40m");
    expect(extractNumericPhrases("Star suspended 8 games for betting")).toContain("8 games");
    expect(extractNumericPhrases("An 18-year-old was arrested")).toContain("18-year-old");
    expect(extractNumericPhrases("Rates fell 2.5 percent overnight")).toContain("2.5 percent");
  });

  it("does not emit count fragments of money figures or bare years", () => {
    expect(extractNumericPhrases("Company fined $2 billion by regulator")).not.toContain("2 billion");
    expect(extractNumericPhrases("The 2026 season begins")).toEqual([]);
  });

  it("skips number-plus-function-word pairs", () => {
    expect(extractNumericPhrases("At least 3 of the victims recovered")).toEqual([]);
  });
});

describe("corroboratedDetails", () => {
  it("corroborates an entity appearing on two distinct independent domains", () => {
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example", source: "Example Wire" }),
        makeArticle({
          id: "a2",
          sourceDomain: "b.example",
          source: "Northern Post",
          title: "Rail safety bill clears the Senate",
        }),
      ],
      ["Senate"],
    );
    expect(corroboratedDetails(cluster)).toEqual([
      { phrase: "Senate", sources: ["Example Wire", "Northern Post"] },
    ]);
  });

  it("ignores phrases repeated only within a single domain", () => {
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example", title: "Fine of $2 billion issued" }),
        makeArticle({ id: "a2", sourceDomain: "a.example", title: "Regulator's $2 billion penalty" }),
        makeArticle({ id: "a3", sourceDomain: "b.example", title: "Regulator acts against bank" }),
      ],
      [],
    );
    expect(corroboratedDetails(cluster)).toEqual([]);
  });

  it("never counts press-release members as corroboration", () => {
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example", title: "Fine of $2 billion issued" }),
        makeArticle({
          id: "a2",
          sourceDomain: "globenewswire.com",
          contentType: "press_release",
          title: "Company responds to $2 billion fine",
        }),
        makeArticle({ id: "a3", sourceDomain: "b.example", title: "Regulator acts against bank" }),
      ],
      [],
    );
    expect(corroboratedDetails(cluster)).toEqual([]);
  });

  it("matches numeric phrases case-insensitively across domains", () => {
    const cluster = makeCluster(
      [
        makeArticle({
          id: "a1",
          sourceDomain: "a.example",
          source: "Example Wire",
          title: "Star Suspended 8 Games After Probe",
        }),
        makeArticle({
          id: "a2",
          sourceDomain: "b.example",
          source: "Northern Post",
          title: "League suspends star for 8 games",
        }),
      ],
      [],
    );
    const details = corroboratedDetails(cluster);
    expect(details).toHaveLength(1);
    expect(details[0].phrase.toLowerCase()).toBe("8 games");
    expect(details[0].sources).toEqual(["Example Wire", "Northern Post"]);
  });

  it("corroborates ages and money amounts from descriptions too", () => {
    const cluster = makeCluster(
      [
        makeArticle({
          id: "a1",
          sourceDomain: "a.example",
          title: "Teen arrested after chase",
          description: "Police say the 18-year-old fled on foot.",
        }),
        makeArticle({
          id: "a2",
          sourceDomain: "b.example",
          title: "18-year-old in custody after pursuit",
        }),
      ],
      [],
    );
    expect(corroboratedDetails(cluster).map((d) => d.phrase.toLowerCase())).toContain(
      "18-year-old",
    );
  });

  it("returns nothing when no phrase spans two independent domains", () => {
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example", title: "Storm hits the coast" }),
        makeArticle({ id: "a2", sourceDomain: "b.example", title: "Cleanup begins inland" }),
      ],
      ["Hurricane Board"],
    );
    expect(corroboratedDetails(cluster)).toEqual([]);
  });

  it("returns nothing with fewer than two independent members", () => {
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example" }),
        makeArticle({
          id: "a2",
          sourceDomain: "globenewswire.com",
          contentType: "press_release",
        }),
      ],
      ["Senate"],
    );
    expect(corroboratedDetails(cluster)).toEqual([]);
  });

  it("caps output at 6 details, entities first, in stable order", () => {
    const entities = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf"];
    const text = `Report on ${entities.join(", ")} today`;
    const cluster = makeCluster(
      [
        makeArticle({ id: "a1", sourceDomain: "a.example", title: text }),
        makeArticle({ id: "a2", sourceDomain: "b.example", title: text }),
      ],
      entities,
    );
    const details = corroboratedDetails(cluster);
    expect(details).toHaveLength(6);
    expect(details.map((d) => d.phrase)).toEqual(entities.slice(0, 6));
  });
});

describe("titleSimilarity", () => {
  it("is 1 for the same headline and 0 for unrelated ones", () => {
    const title = "Senate passes bipartisan rail safety bill";
    expect(titleSimilarity(title, title)).toBe(1);
    expect(titleSimilarity(title, "Storm warnings issued along the Gulf coast")).toBe(0);
  });

  it("matches across -ed/-ing/-s inflections", () => {
    expect(
      titleSimilarity("Missionary kidnap suspect charged", "Missionary kidnapped, suspect charged"),
    ).toBe(1);
    expect(
      titleSimilarity("Crews report wildfire", "Crews reporting wildfires"),
    ).toBe(1);
  });

  it("stems only s/ed/ing — an -e base form is left alone", () => {
    // Deliberate: "battle"/"battling" stay distinct rather than risk
    // over-stemming unrelated words together.
    expect(titleSimilarity("Crews battle blaze", "Crews battling blaze")).toBeLessThan(1);
  });

  it("ignores stopwords and short tokens", () => {
    // Only "rail"/"bill" carry signal; the filler must not dilute the score.
    expect(
      titleSimilarity("The rail bill", "A rail bill, in the US"),
    ).toBe(1);
  });

  it("is 0 when a headline has no scoreable words", () => {
    expect(titleSimilarity("It is what it is", "Senate passes rail bill")).toBe(0);
  });
});

describe("scoreArchiveRelatedness", () => {
  // The live regression: story cf2ba91727374, whose only entities are one
  // generic country and one specific phrase, was recommended five archived
  // stories that shared nothing but "United States".
  const missionary = {
    title: "US missionary released following kidnap in Niger, Christian group says",
    entities: ["United States", "Niger Christian"],
  };

  const junkCandidates = [
    {
      title: "Navy names replacement for USS Abraham Lincoln in the Pacific",
      entities: ["United States", "USS Abraham Lincoln"],
    },
    {
      title: "Army grounds its Apache helicopter fleet after a crash",
      entities: ["United States", "Apache Helicopter"],
    },
    {
      title: "Luigi Mangione trial date set in health executive killing",
      entities: ["United States", "Luigi Mangione"],
    },
    {
      title: "Brixton Metals Announces Closing of First Tranche of Private Placement",
      entities: ["United States", "Private Placement"],
    },
    {
      title: "USS Abraham Lincoln returns home after a nine-month deployment",
      entities: ["United States", "USS Abraham Lincoln"],
    },
  ];

  it("rejects every candidate that shares only a generic entity", () => {
    for (const candidate of junkCandidates) {
      const result = scoreArchiveRelatedness(missionary, candidate);
      expect(result.passes).toBe(false);
      expect(result.sharedSpecific).toEqual([]);
      expect(result.sharedGeneric).toEqual(["United States"]);
      // Generic overlap contributes nothing to the score.
      expect(result.score).toBe(result.titleSimilarity);
    }
  });

  it("passes a pair sharing two specific entities even with unlike headlines", () => {
    const result = scoreArchiveRelatedness(
      {
        title: "Luigi Mangione pleads not guilty in Brian Thompson killing",
        entities: ["Luigi Mangione", "Brian Thompson", "New York"],
      },
      {
        title: "Suspect charged over UnitedHealth executive shooting",
        entities: ["Luigi Mangione", "Brian Thompson"],
      },
    );
    expect(result.sharedSpecific).toEqual(["Luigi Mangione", "Brian Thompson"]);
    // The entity evidence alone carries it — the headlines barely overlap.
    expect(result.titleSimilarity).toBeLessThan(0.2);
    expect(result.passes).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("passes one specific entity when the headlines describe the same event", () => {
    const result = scoreArchiveRelatedness(missionary, {
      title: "American missionary kidnapped in Niger is released, group says",
      entities: ["United States", "Niger Christian"],
    });
    expect(result.sharedSpecific).toEqual(["Niger Christian"]);
    expect(result.titleSimilarity).toBeGreaterThanOrEqual(0.2);
    expect(result.passes).toBe(true);
  });

  it("rejects one specific entity when the headlines have nothing in common", () => {
    const result = scoreArchiveRelatedness(missionary, {
      title: "Aid budget debate reopens in parliament",
      entities: ["Niger Christian"],
    });
    expect(result.sharedSpecific).toEqual(["Niger Christian"]);
    expect(result.titleSimilarity).toBeLessThan(0.2);
    expect(result.passes).toBe(false);
  });

  it("compares entities case-insensitively and dedupes repeats", () => {
    const result = scoreArchiveRelatedness(
      { title: "A", entities: ["Luigi Mangione", "luigi mangione", "Brian Thompson"] },
      { title: "B", entities: ["LUIGI MANGIONE", "brian thompson"] },
    );
    expect(result.sharedSpecific).toEqual(["Luigi Mangione", "Brian Thompson"]);
    expect(result.passes).toBe(true);
  });

  it("takes an injected generic test so callers can override the dictionary", () => {
    const result = scoreArchiveRelatedness(
      { title: "A", entities: ["Rail Safety", "Senate"] },
      { title: "B", entities: ["Rail Safety", "Senate"] },
      (entity) => entity === "Rail Safety",
    );
    expect(result.sharedGeneric).toEqual(["Rail Safety"]);
    expect(result.sharedSpecific).toEqual(["Senate"]);
  });

  it("passes nothing when either side has no entities", () => {
    expect(scoreArchiveRelatedness(missionary, { title: "x", entities: [] }).passes).toBe(
      false,
    );
    expect(
      scoreArchiveRelatedness({ title: missionary.title, entities: [] }, junkCandidates[0])
        .passes,
    ).toBe(false);
  });
});

describe("describeUpdateEvent", () => {
  it("renders each event kind in human phrasing", () => {
    const at = "2026-08-14T12:00:00.000Z";
    const version = "20260814T120000Z-ab39f2";
    expect(
      describeUpdateEvent({ kind: "source_added", at, version, source: "Northern Post" }),
    ).toBe("Northern Post joined coverage");
    expect(
      describeUpdateEvent({ kind: "headline_updated", at, version, from: "Old", to: "New" }),
    ).toBe("Headline updated");
    expect(
      describeUpdateEvent({ kind: "coverage_change", at, version, from: 3, to: 5 }),
    ).toBe("Coverage went from 3 to 5 sources");
    expect(
      describeUpdateEvent({ kind: "category_changed", at, version, from: "world", to: "politics" }),
    ).toBe("Reclassified from world to politics");
  });
});
