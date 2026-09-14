import { describe, expect, it } from "vitest";
import { AI_DISCLOSURE, buildBrief, renderBrief, WRITING_RULES } from "@/lib/editorial/brief";
import { assessEligibility } from "@/lib/editorial/eligibility";
import type { GscQueryRow } from "@/lib/editorial/keywords";
import type { Article, StoryCluster } from "@/lib/news/types";

let seq = 0;

function makeArticle(overrides: Partial<Article> = {}): Article {
  seq += 1;
  return {
    id: `a${seq}`,
    slug: `story-${seq}`,
    title: "Chipmaker ships new AI accelerator",
    description: "The company said the accelerator costs $40,000 per unit.",
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
    entities: ["Nvidia"],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<StoryCluster> = {}, articles?: Article[]): StoryCluster {
  seq += 1;
  const members = articles ?? [
    makeArticle(),
    makeArticle({
      source: "The Verge",
      sourceSlug: "the-verge",
      sourceDomain: "theverge.com",
      url: "https://theverge.com/tech",
      canonicalUrl: "https://theverge.com/tech",
      title: "Nvidia's new accelerator lands at $40,000 per unit",
      description: "Nvidia confirmed the $40,000 price.",
    }),
  ];
  return {
    id: `c${seq}`,
    slug: "chipmaker-ships-new-ai-accelerator",
    title: "Chipmaker ships new AI accelerator",
    category: "technology",
    country: "US",
    articles: members,
    lead: members[0],
    sourceCount: members.length,
    sourceNames: members.map((a) => a.source),
    entities: ["Nvidia"],
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

function briefFor(cluster: StoryCluster, webQueries: GscQueryRow[] = []) {
  return buildBrief(cluster, assessEligibility(cluster), { webQueries });
}

describe("buildBrief — what it carries", () => {
  it("carries facts two publications both state, with who confirmed them", () => {
    const brief = briefFor(makeCluster());
    const prices = brief.facts.find((f) => f.phrase.includes("40,000"));
    expect(prices).toBeDefined();
    expect(prices!.confirmedBy.length).toBeGreaterThanOrEqual(2);
  });

  it("lists every independent publication with how a reader reaches it", () => {
    const brief = briefFor(makeCluster());
    expect(brief.sources.map((s) => s.name)).toEqual(["Associated Press", "The Verge"]);
    expect(brief.sources.every((s) => s.access === "free")).toBe(true);
    expect(brief.readableSources).toEqual(["Associated Press", "The Verge"]);
  });

  it("marks a paywalled source as such rather than hiding it", () => {
    const brief = briefFor(
      makeCluster({}, [
        makeArticle(),
        makeArticle({
          source: "The Verge", sourceDomain: "theverge.com",
          url: "https://theverge.com/a", canonicalUrl: "https://theverge.com/a",
        }),
        makeArticle({
          source: "Bloomberg", sourceDomain: "bloomberg.com",
          url: "https://bloomberg.com/a", canonicalUrl: "https://bloomberg.com/a",
        }),
      ]),
    );
    const bloomberg = brief.sources.find((s) => s.name === "Bloomberg");
    expect(bloomberg?.access).toBe("paywalled");
    expect(brief.readableSources).not.toContain("Bloomberg");
  });

  it("records a publisher's reuse licence when one exists", () => {
    const brief = briefFor(
      makeCluster({}, [
        makeArticle({
          source: "NASA", sourceDomain: "nasa.gov",
          url: "https://nasa.gov/a", canonicalUrl: "https://nasa.gov/a",
        }),
        makeArticle({
          source: "The Texas Tribune", sourceDomain: "texastribune.org",
          url: "https://texastribune.org/a", canonicalUrl: "https://texastribune.org/a",
        }),
      ]),
    );
    expect(brief.sources.find((s) => s.name === "NASA")?.license).toBe("public-domain");
    expect(brief.sources.find((s) => s.name === "The Texas Tribune")?.license).toBe("cc-by");
  });

  it("flags a held story with the reason, and a clean one without", () => {
    const held = briefFor(makeCluster({ title: "Executive charged with fraud" }));
    expect(held.reviewRequired).toBe(true);
    expect(held.reviewReasons).toContain("sensitive-crime-or-courts");

    const clean = briefFor(makeCluster());
    expect(clean.reviewRequired).toBe(false);
    expect(clean.reviewReasons).toEqual([]);
  });

  it("names the headline keyword only when search evidence backs it", () => {
    const withEvidence = briefFor(makeCluster(), [
      { query: "new ai accelerator", impressions: 14, clicks: 0, position: 11 },
    ]);
    expect(withEvidence.headlineKeyword).toBe("new ai accelerator");

    // No GSC history — the brief must NOT invent a phrase to build around.
    expect(briefFor(makeCluster()).headlineKeyword).toBeUndefined();
  });

  it("always carries the rules and the disclosure", () => {
    const brief = briefFor(makeCluster());
    expect(brief.rules).toEqual([...WRITING_RULES]);
    expect(brief.disclosure).toBe(AI_DISCLOSURE);
  });
});

describe("buildBrief — what it must NOT carry", () => {
  /**
   * The anti-plagiarism guarantee is structural: a writer cannot reproduce
   * prose it was never handed. If this test ever fails, the brief has started
   * shipping source copy and the whole originality argument collapses.
   */
  it("never includes a source article's body text", () => {
    const body =
      "In a statement released Tuesday, the company described the launch as a " +
      "turning point for inference workloads across the industry.";
    const cluster = makeCluster({}, [
      makeArticle({ description: body }),
      makeArticle({
        source: "The Verge", sourceDomain: "theverge.com",
        url: "https://theverge.com/a", canonicalUrl: "https://theverge.com/a",
        description: body,
      }),
    ]);
    const serialized = JSON.stringify(briefFor(cluster));
    expect(serialized).not.toContain("turning point for inference workloads");
    expect(serialized).not.toContain("In a statement released Tuesday");
  });

  it("carries headlines but not descriptions", () => {
    const brief = briefFor(makeCluster());
    // Headlines identify which report is which; they are facts about the
    // coverage, and the reader sees them in the source list.
    expect(brief.sources[0].headline).toBe("Chipmaker ships new AI accelerator");
    expect(JSON.stringify(brief)).not.toContain("The company said the accelerator costs");
  });
});

describe("renderBrief", () => {
  it("renders the parts a writer needs", () => {
    const markdown = renderBrief(
      briefFor(makeCluster(), [
        { query: "new ai accelerator", impressions: 14, clicks: 0, position: 11 },
      ]),
    );
    expect(markdown).toContain("# Brief: Chipmaker ships new AI accelerator");
    expect(markdown).toContain("Facts confirmed by two or more publications");
    expect(markdown).toContain("[Associated Press](https://apnews.com/tech)");
    expect(markdown).toContain("free to read");
    expect(markdown).toContain('**Headline should serve:** "new ai accelerator"');
    expect(markdown).toContain(AI_DISCLOSURE);
  });

  it("tells the writer NOT to force a keyword when there is no evidence", () => {
    const markdown = renderBrief(briefFor(makeCluster()));
    expect(markdown).toContain("do not force a phrase");
  });

  it("puts the hold notice where the owner cannot miss it", () => {
    const markdown = renderBrief(briefFor(makeCluster({ title: "Executive charged with fraud" })));
    expect(markdown).toContain("HOLD FOR OWNER APPROVAL");
  });
});
