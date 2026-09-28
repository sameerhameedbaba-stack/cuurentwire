import { describe, expect, it } from "vitest";
import {
  accessBreakdown,
  assessEligibility,
  LAUNCH_CATEGORIES,
  MIN_FREE_SOURCES,
  MIN_INDEPENDENT_DOMAINS,
} from "@/lib/editorial/eligibility";
import type { Article, StoryCluster } from "@/lib/news/types";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "a1",
    slug: "chipmaker-ships-new-accelerator",
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

/**
 * Two free, independent, tech sources — the baseline "clean" story.
 *
 * The second outlet has its OWN headline. Two outlets carrying one identical
 * headline is the signature of wire syndication, which the gate (correctly)
 * counts as a single report — see the syndication tests below.
 */
function cleanArticles(): Article[] {
  return [
    makeArticle(),
    makeArticle({
      id: "a2",
      title: "Inside the new AI chip built for data centres",
      source: "The Verge",
      sourceSlug: "the-verge",
      sourceDomain: "theverge.com",
      url: "https://theverge.com/tech",
      canonicalUrl: "https://theverge.com/tech",
    }),
  ];
}

function makeCluster(
  articles: Article[],
  overrides: Partial<Pick<StoryCluster, "title" | "category" | "summary">> = {},
): Pick<StoryCluster, "articles" | "title" | "category" | "summary"> {
  return {
    articles,
    title: "Chipmaker ships new AI accelerator",
    category: "technology",
    ...overrides,
  };
}

describe("assessEligibility — free-range sourcing", () => {
  it("clears a story with two free, independent sources in a launch category", () => {
    const verdict = assessEligibility(makeCluster(cleanArticles()));
    expect(verdict.eligible).toBe(true);
    expect(verdict.autoPublish).toBe(true);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.independentDomains).toBe(2);
    expect(verdict.freeSources).toBe(2);
  });

  it("rejects a single-source story", () => {
    const verdict = assessEligibility(makeCluster([makeArticle()]));
    expect(verdict.eligible).toBe(false);
    expect(verdict.reasons).toContain("single-source");
  });

  it("does not count two articles from the same domain as two sources", () => {
    const verdict = assessEligibility(
      makeCluster([makeArticle(), makeArticle({ id: "a2", url: "https://apnews.com/other" })]),
    );
    expect(verdict.independentDomains).toBe(1);
    expect(verdict.reasons).toContain("single-source");
  });

  it("rejects a story carried only by paywalled sources", () => {
    const verdict = assessEligibility(
      makeCluster([
        makeArticle({
          source: "The Wall Street Journal",
          sourceDomain: "wsj.com",
          url: "https://wsj.com/tech",
          canonicalUrl: "https://wsj.com/tech",
        }),
        makeArticle({
          id: "a2",
          source: "Bloomberg",
          sourceDomain: "bloomberg.com",
          url: "https://bloomberg.com/tech",
          canonicalUrl: "https://bloomberg.com/tech",
        }),
      ]),
    );
    expect(verdict.eligible).toBe(false);
    expect(verdict.reasons).toContain("not-enough-free-sources");
    expect(verdict.freeSources).toBe(0);
    // Corroboration itself is fine — it is specifically the access that fails.
    expect(verdict.independentDomains).toBe(2);
  });

  it("rejects when free sources are present but below the floor", () => {
    const verdict = assessEligibility(
      makeCluster([
        makeArticle(),
        makeArticle({
          id: "a2",
          source: "The New York Times",
          sourceDomain: "nytimes.com",
          url: "https://nytimes.com/tech",
          canonicalUrl: "https://nytimes.com/tech",
        }),
      ]),
    );
    expect(verdict.freeSources).toBe(1);
    expect(verdict.reasons).toContain("not-enough-free-sources");
  });

  it("treats an unknown domain as NOT free — the filter fails closed", () => {
    const verdict = assessEligibility(
      makeCluster([
        makeArticle(),
        makeArticle({
          id: "a2",
          source: "Some Blog Nobody Reviewed",
          sourceDomain: "unknown-outlet.example",
          url: "https://unknown-outlet.example/tech",
          canonicalUrl: "https://unknown-outlet.example/tech",
        }),
      ]),
    );
    expect(verdict.freeSources).toBe(1);
    expect(verdict.eligible).toBe(false);
    expect(verdict.reasons).toContain("not-enough-free-sources");
  });

  it("rejects a press-release-only cluster", () => {
    const verdict = assessEligibility(
      makeCluster([
        makeArticle({ contentType: "press_release" }),
        makeArticle({ id: "a2", contentType: "press_release", sourceDomain: "theverge.com" }),
      ]),
    );
    expect(verdict.eligible).toBe(false);
    expect(verdict.reasons).toContain("press-release-only");
  });

  it("does not count a press release toward corroboration", () => {
    const verdict = assessEligibility(
      makeCluster([
        makeArticle(),
        makeArticle({
          id: "a2",
          contentType: "press_release",
          source: "The Verge",
          sourceDomain: "theverge.com",
        }),
      ]),
    );
    expect(verdict.independentDomains).toBe(1);
    expect(verdict.reasons).toContain("single-source");
  });
});

describe("assessEligibility — owner review gate", () => {
  it("holds a crime story for the owner even when sourcing is clean", () => {
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), {
        title: "Former executive charged with fraud over chip sales",
      }),
    );
    // Sourcing is fine, so it stays in the pool...
    expect(verdict.eligible).toBe(true);
    // ...but it must not publish unattended.
    expect(verdict.autoPublish).toBe(false);
    expect(verdict.reasons).toContain("sensitive-crime-or-courts");
  });

  it("detects a crime context that appears only in a member headline", () => {
    const articles = cleanArticles();
    articles[1] = { ...articles[1], title: "Executive arrested after chip sale probe" };
    const verdict = assessEligibility(makeCluster(articles));
    expect(verdict.autoPublish).toBe(false);
    expect(verdict.reasons).toContain("sensitive-crime-or-courts");
  });

  it("holds money advice", () => {
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), {
        title: "Three stocks to buy before the chip rally",
        category: "business",
      }),
    );
    expect(verdict.autoPublish).toBe(false);
    expect(verdict.reasons).toContain("sensitive-money-advice");
  });

  it("holds every health story regardless of wording", () => {
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), {
        title: "New imaging technique maps blood flow",
        category: "health",
      }),
    );
    expect(verdict.autoPublish).toBe(false);
    expect(verdict.reasons).toContain("sensitive-health");
  });

  it("holds a story outside the launch categories", () => {
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), { category: "sports" }),
    );
    expect(verdict.eligible).toBe(true);
    expect(verdict.autoPublish).toBe(false);
    expect(verdict.reasons).toContain("outside-launch-categories");
  });

  it("respects a caller-supplied launch scope", () => {
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), { category: "sports" }),
      ["sports"],
    );
    expect(verdict.autoPublish).toBe(true);
  });

  it("never auto-publishes an ineligible story", () => {
    const verdict = assessEligibility(makeCluster([makeArticle()]));
    expect(verdict.eligible).toBe(false);
    expect(verdict.autoPublish).toBe(false);
  });

  it("does not fire on substrings of sensitive words", () => {
    // "probe" must not match "problem"; "court" must not match "courtesy".
    const verdict = assessEligibility(
      makeCluster(cleanArticles(), {
        title: "Courtesy shuttle solves a parking problem at the chip plant",
      }),
    );
    expect(verdict.reasons).not.toContain("sensitive-crime-or-courts");
    expect(verdict.autoPublish).toBe(true);
  });
});

describe("accessBreakdown", () => {
  it("groups independent sources by how a reader can reach them", () => {
    const breakdown = accessBreakdown({
      articles: [
        makeArticle(),
        makeArticle({ id: "a2", source: "Reuters", sourceDomain: "reuters.com" }),
        makeArticle({ id: "a3", source: "The Wall Street Journal", sourceDomain: "wsj.com" }),
      ],
    });
    expect(breakdown.free).toEqual(["Associated Press"]);
    expect(breakdown.metered).toEqual(["Reuters"]);
    expect(breakdown.paywalled).toEqual(["The Wall Street Journal"]);
  });
});

describe("policy constants", () => {
  it("keeps the recorded floors", () => {
    expect(MIN_INDEPENDENT_DOMAINS).toBe(2);
    expect(MIN_FREE_SOURCES).toBe(2);
  });

  it("launches only into the low-risk verticals", () => {
    expect([...LAUNCH_CATEGORIES].sort()).toEqual(["business", "science", "technology"]);
  });
});


describe("assessEligibility — syndication: one report on several sites is ONE source", () => {
  /** The real 2026-09-28 case: one AP story carried by NPR, Global News, ABC. */
  function syndicatedOpenAiStory(): Article[] {
    const headline =
      "OpenAI says its models engaged with US government websites in new model misbehavior disclosure";
    return [
      makeArticle({
        id: "npr", source: "NPR", sourceDomain: "npr.org", title: headline,
        url: "https://www.npr.org/2026/09/26/openai", canonicalUrl: "https://www.npr.org/2026/09/26/openai",
      }),
      makeArticle({
        id: "global", source: "Global News", sourceDomain: "globalnews.ca", title: headline,
        url: "https://globalnews.ca/news/1/openai", canonicalUrl: "https://globalnews.ca/news/1/openai",
      }),
      makeArticle({
        id: "abc", source: "ABC News", sourceDomain: "abcnews.go.com", title: headline,
        url: "https://abcnews.com/Technology/wireStory/openai-1", canonicalUrl: "https://abcnews.com/Technology/wireStory/openai-1",
      }),
    ];
  }

  it("rejects three domains carrying one identical wire headline", () => {
    const verdict = assessEligibility(makeCluster(syndicatedOpenAiStory(), { title: "OpenAI disclosure" }));
    expect(verdict.independentDomains).toBe(3);
    expect(verdict.independentReports).toBe(1);
    expect(verdict.syndicatedCopies).toBe(2);
    expect(verdict.eligible).toBe(false);
    expect(verdict.reasons).toContain("single-source");
    expect(verdict.reasons).toContain("syndicated-copies");
  });

  it("treats an ABC /wireStory/ page as the wire's report even when re-headlined", () => {
    const articles = [
      makeArticle({
        id: "tc", source: "TechCrunch", sourceDomain: "techcrunch.com",
        title: "Nvidia launches new platform for reining in rogue AI agents",
        url: "https://techcrunch.com/nvidia", canonicalUrl: "https://techcrunch.com/nvidia",
      }),
      makeArticle({
        id: "abc", source: "ABC News", sourceDomain: "abcnews.go.com",
        title: "Nvidia unveils security platform to stop AI agents from going rogue",
        url: "https://abcnews.com/Technology/wireStory/nvidia-1", canonicalUrl: "https://abcnews.com/Technology/wireStory/nvidia-1",
      }),
      makeArticle({
        id: "abc2", source: "ABC News", sourceDomain: "abcnews.go.com",
        title: "Something else entirely about Nvidia",
        url: "https://abcnews.com/Business/wireStory/nvidia-2", canonicalUrl: "https://abcnews.com/Business/wireStory/nvidia-2",
      }),
    ];
    const verdict = assessEligibility(makeCluster(articles, { title: "Nvidia platform" }));
    // TechCrunch + the wire = two genuinely separate reports.
    expect(verdict.independentReports).toBe(2);
    expect(verdict.eligible).toBe(true);
  });

  it("does NOT merge genuinely independent reports with similar headlines", () => {
    // Real pair, similarity 0.667 — two separate newsrooms.
    const articles = [
      makeArticle({
        id: "cbc", source: "CBC News", sourceDomain: "cbc.ca",
        title: "SpaceX sends giant Starship into orbit for the first time but ends the flight early",
        url: "https://www.cbc.ca/starship", canonicalUrl: "https://www.cbc.ca/starship",
      }),
      makeArticle({
        id: "pbs", source: "PBS NewsHour", sourceDomain: "pbs.org",
        title: "SpaceX's supersized Starship launches into orbit for the first time but flight ends early",
        url: "https://www.pbs.org/starship", canonicalUrl: "https://www.pbs.org/starship",
      }),
    ];
    const verdict = assessEligibility(makeCluster(articles, { category: "science", title: "Starship" }));
    expect(verdict.independentReports).toBe(2);
    expect(verdict.eligible).toBe(true);
  });

  it("counts a report as free when any carrier of it is free", () => {
    const headline = "Identical wire headline carried by two outlets";
    const articles = [
      makeArticle({
        id: "wsj", source: "The Wall Street Journal", sourceDomain: "wsj.com", title: headline,
        url: "https://wsj.com/a", canonicalUrl: "https://wsj.com/a",
      }),
      makeArticle({ id: "ap", title: headline, url: "https://apnews.com/a", canonicalUrl: "https://apnews.com/a" }),
      makeArticle({
        id: "verge", source: "The Verge", sourceDomain: "theverge.com",
        title: "A different newsroom's own account of it",
        url: "https://theverge.com/a", canonicalUrl: "https://theverge.com/a",
      }),
    ];
    const verdict = assessEligibility(makeCluster(articles));
    expect(verdict.independentReports).toBe(2);
    expect(verdict.freeSources).toBe(2);
  });
});
