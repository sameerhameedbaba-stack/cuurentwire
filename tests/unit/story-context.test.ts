import { describe, expect, it } from "vitest";
import { RANKING_WEIGHTS } from "@/lib/news/ranking/score";
import {
  buildStoryContext,
  COVERAGE_EXCERPT_MAX_CHARS,
  coverageExcerpt,
  formatDelay,
  pickupDelayMinutes,
  RANKING_SIGNAL_LABELS,
} from "@/lib/news/story-context";
import { topicKey } from "@/lib/news/topics";
import type { Article, RankingBreakdown, StoryCluster } from "@/lib/news/types";

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
    sourceTier: "B",
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

const LIVE_BREAKDOWN: RankingBreakdown = {
  freshness: 31.5,
  authority: 14,
  coverage: 4,
  geography: 10,
  prominence: 7,
  velocity: 0,
  total: 66.5,
};

// archivedStoryToCluster zeroes every component and keeps only `total`.
const ARCHIVE_BREAKDOWN: RankingBreakdown = {
  freshness: 0,
  authority: 0,
  coverage: 0,
  geography: 0,
  prominence: 0,
  velocity: 0,
  total: 41.2,
};

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  const lead = overrides.lead ?? makeArticle();
  return {
    id: "c1",
    slug: "senate-passes-bipartisan-rail-safety-bill-c1",
    title: "Senate passes bipartisan rail safety bill",
    category: "politics",
    country: "US",
    contentType: "news",
    articles: [lead],
    lead,
    sourceCount: 1,
    sourceNames: [lead.source],
    entities: ["Senate"],
    firstPublishedAt: lead.publishedAt,
    lastPublishedAt: lead.publishedAt,
    rankingScore: LIVE_BREAKDOWN.total,
    rankingBreakdown: LIVE_BREAKDOWN,
    status: null,
    isBreaking: false,
    isMock: false,
    ...overrides,
  };
}

describe("buildStoryContext", () => {
  it("emits the six signals in documented order with the real maxima", () => {
    const facts = buildStoryContext(makeCluster());
    expect(facts.signals.map((s) => s.key)).toEqual([
      "freshness",
      "authority",
      "coverage",
      "geography",
      "prominence",
      "velocity",
    ]);
    expect(facts.signals.map((s) => s.max)).toEqual([
      RANKING_WEIGHTS.freshness,
      RANKING_WEIGHTS.authority,
      RANKING_WEIGHTS.coverage,
      RANKING_WEIGHTS.geography,
      RANKING_WEIGHTS.prominence,
      RANKING_WEIGHTS.velocity,
    ]);
    expect(facts.score).toBe(LIVE_BREAKDOWN.total);
    expect(facts.signals.map((s) => s.points)).toEqual([
      LIVE_BREAKDOWN.freshness,
      LIVE_BREAKDOWN.authority,
      LIVE_BREAKDOWN.coverage,
      LIVE_BREAKDOWN.geography,
      LIVE_BREAKDOWN.prominence,
      LIVE_BREAKDOWN.velocity,
    ]);
  });

  it("names the signal closest to its OWN maximum, not the one with most points", () => {
    // freshness scores 31.5 points to geography's 10, but geography is at
    // 100% of its maximum and freshness is at 90%.
    expect(buildStoryContext(makeCluster()).strongest?.key).toBe("geography");
    expect(RANKING_SIGNAL_LABELS.geography).toBe("Geographic relevance");
  });

  it("emits no signals and no score for an archive-rebuilt cluster", () => {
    const facts = buildStoryContext(
      makeCluster({
        rankingBreakdown: ARCHIVE_BREAKDOWN,
        rankingScore: ARCHIVE_BREAKDOWN.total,
      }),
    );
    expect(facts.signals).toEqual([]);
    expect(facts.score).toBeUndefined();
    expect(facts.strongest).toBeUndefined();
  });

  it("counts publications from the rendered list, not sourceCount", () => {
    const lead = makeArticle({ id: "a1", source: "Example Wire" });
    const facts = buildStoryContext(
      makeCluster({
        lead,
        articles: [
          lead,
          makeArticle({ id: "a2", source: "Example Wire" }),
          makeArticle({ id: "a3", source: "Second Paper", sourceDomain: "second.example" }),
        ],
        sourceCount: 9,
      }),
    );
    expect(facts.publicationCount).toBe(2);
  });

  it("reports the lead publisher's identity, tier and classification", () => {
    const facts = buildStoryContext(makeCluster());
    expect(facts.leadSource).toBe("Example Wire");
    expect(facts.leadDomain).toBe("example-wire.com");
    expect(facts.leadTier).toBe("B");
    expect(facts.categoryLabel).toBe("Politics");
    expect(facts.categoryPath).toBe("/politics");
    expect(facts.countryLabel).toBe("United States");
    expect(facts.contentTypeLabel).toBe("News");
  });

  it("discounts the story's own contribution to its live topic counts", () => {
    const counts = new Map([[topicKey("Senate"), 5]]);
    expect(buildStoryContext(makeCluster(), { topicCounts: counts }).topics).toEqual([
      { name: "Senate", others: 4 },
    ]);
    // An archived story is absent from the live dataset, so nothing to subtract.
    expect(
      buildStoryContext(makeCluster(), { topicCounts: counts, isArchived: true }).topics,
    ).toEqual([{ name: "Senate", others: 5 }]);
  });

  it("reports zero others when the story is the only one mentioning a topic", () => {
    const facts = buildStoryContext(makeCluster(), {
      topicCounts: new Map([[topicKey("Senate"), 1]]),
    });
    expect(facts.topics).toEqual([{ name: "Senate", others: 0 }]);
  });

  it("omits counts entirely when the caller passed none — never guesses", () => {
    expect(buildStoryContext(makeCluster()).topics).toEqual([{ name: "Senate" }]);
  });

  it("collapses topic variants onto one row, keeping the first name seen", () => {
    // topicKey folds the place-type suffix, so these are one topic and must
    // not be listed twice with the same count.
    const facts = buildStoryContext(
      makeCluster({ entities: ["Big Bend", "Big Bend National Park", "Texas"] }),
      { topicCounts: new Map([[topicKey("Big Bend"), 3]]) },
    );
    expect(facts.topics).toEqual([
      { name: "Big Bend", others: 2 },
      { name: "Texas", others: 0 },
    ]);
  });

  it("caps the topic list at the entity-extraction limit", () => {
    const entities = Array.from({ length: 12 }, (_, i) => `Topic ${i}`);
    expect(buildStoryContext(makeCluster({ entities })).topics).toHaveLength(8);
  });
});

describe("pickupDelayMinutes", () => {
  it("measures earliest coverage to our publication", () => {
    expect(
      pickupDelayMinutes("2026-08-14T08:00:00.000Z", "2026-08-14T08:43:00.000Z"),
    ).toBe(43);
  });

  it("drops a negative gap, which happens when an earlier report rotates out", () => {
    // Observed live 2026-08-19 on
    // /story/bill-rasmussen-co-founder-of-espn-dies-at-93-c88309129ec2c:
    // page live 12:35 PM ET, earliest SURVIVING report 7:47 PM ET.
    expect(
      pickupDelayMinutes("2026-08-18T23:47:00.000Z", "2026-08-18T16:35:00.000Z"),
    ).toBeUndefined();
  });

  it("drops gaps outside the 72h window and unusable input", () => {
    expect(
      pickupDelayMinutes("2026-08-10T08:00:00.000Z", "2026-08-14T08:00:00.000Z"),
    ).toBeUndefined();
    expect(pickupDelayMinutes("not-a-date", "2026-08-14T08:00:00.000Z")).toBeUndefined();
    expect(pickupDelayMinutes("2026-08-14T08:00:00.000Z", undefined)).toBeUndefined();
  });

  it("flows into the facts as a formatted delay, or not at all", () => {
    expect(
      buildStoryContext(makeCluster(), { publishedByUsAt: "2026-08-14T08:43:00.000Z" })
        .pickupDelay,
    ).toBe("43 minutes");
    // publishedByUsAt is still reported even when the gap is unusable.
    const negative = buildStoryContext(makeCluster(), {
      publishedByUsAt: "2026-08-14T07:00:00.000Z",
    });
    expect(negative.publishedByUsAt).toBe("2026-08-14T07:00:00.000Z");
    expect(negative.pickupDelay).toBeUndefined();
  });
});

describe("formatDelay", () => {
  it("uses whole units and singular forms", () => {
    expect(formatDelay(1)).toBe("1 minute");
    expect(formatDelay(43)).toBe("43 minutes");
    expect(formatDelay(60)).toBe("1 hour");
    expect(formatDelay(200)).toBe("3 hours");
  });
});

describe("coverageExcerpt", () => {
  const dek =
    "The Senate voted 68-30 on Thursday to pass a rail safety package that has stalled since the East Palestine derailment.";

  it("caps a long publisher description at the copyright limit", () => {
    const excerpt = coverageExcerpt("word ".repeat(200), undefined);
    expect(excerpt).toBeDefined();
    // truncate() appends the ellipsis after slicing, so one char over is fine.
    expect(excerpt?.length ?? 0).toBeLessThanOrEqual(COVERAGE_EXCERPT_MAX_CHARS + 1);
  });

  it("renders nothing for the lead, whose description is already the dek", () => {
    expect(coverageExcerpt(dek, dek)).toBeUndefined();
    // The dek is a truncated form of the description on long summaries: the
    // prefix test catches that too, in both directions.
    expect(coverageExcerpt(dek, dek.slice(0, 60))).toBeUndefined();
    expect(coverageExcerpt(dek.slice(0, 60), dek)).toBeUndefined();
  });

  it("renders a second publisher's description unchanged when short enough", () => {
    const other =
      "The bill now moves to the House, where leadership has not scheduled a vote before the recess.";
    expect(coverageExcerpt(other, dek)).toBe(other);
  });

  it("ignores missing and stub descriptions", () => {
    expect(coverageExcerpt(undefined, dek)).toBeUndefined();
    expect(coverageExcerpt("Read more.", dek)).toBeUndefined();
  });
});
