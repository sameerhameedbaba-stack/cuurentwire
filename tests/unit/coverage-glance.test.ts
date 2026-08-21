import { describe, expect, it } from "vitest";
import {
  coverageCounts,
  coverageGlance,
  coverageGrowth,
  coverageSpanMs,
  firstObserved,
  formatCoverageCounts,
  formatCoverageGrowth,
  formatDuration,
  type GlanceArticle,
} from "@/lib/news/coverage-glance";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";

function article(overrides: Partial<GlanceArticle> = {}): GlanceArticle {
  return {
    source: "Example Wire",
    sourceDomain: "example-wire.com",
    publishedAt: "2026-08-21T12:00:00.000Z",
    contentType: "news",
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("formats minutes, hours and days in whole units", () => {
    expect(formatDuration(47 * 60_000)).toBe("47 min");
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration((3 * 60 + 18) * 60_000)).toBe("3h 18m");
    expect(formatDuration((2 * 24 + 3) * 3_600_000 + 59 * 60_000)).toBe("2d 3h");
  });

  it("never renders a negative or NaN duration", () => {
    expect(formatDuration(-5_000)).toBe("0 min");
    expect(formatDuration(Number.NaN)).toBe("0 min");
  });
});

describe("firstObserved", () => {
  it("picks the earliest publisher timestamp, keeping member order on ties", () => {
    const articles = [
      article({ source: "Lead Paper", publishedAt: "2026-08-21T12:30:00.000Z" }),
      article({ source: "Early Bird", publishedAt: "2026-08-21T12:00:00.000Z" }),
      article({ source: "Same Minute", publishedAt: "2026-08-21T12:00:00.000Z" }),
    ];
    expect(firstObserved(articles)?.source).toBe("Early Bird");
  });

  it("ignores unparseable timestamps and returns null when none parse", () => {
    expect(
      firstObserved([
        article({ source: "Broken", publishedAt: "not a date" }),
        article({ source: "Valid", publishedAt: "2026-08-21T12:00:00.000Z" }),
      ])?.source,
    ).toBe("Valid");
    expect(firstObserved([article({ publishedAt: "nope" })])).toBeNull();
  });
});

describe("coverageSpanMs", () => {
  it("measures earliest to latest and is 0 for a single timestamp", () => {
    expect(
      coverageSpanMs([
        article({ publishedAt: "2026-08-21T12:00:00.000Z" }),
        article({ publishedAt: "2026-08-21T15:18:00.000Z" }),
        article({ publishedAt: "2026-08-21T13:00:00.000Z" }),
      ]),
    ).toBe((3 * 60 + 18) * 60_000);
    expect(coverageSpanMs([article(), article()])).toBe(0);
  });
});

describe("coverageCounts", () => {
  it("counts reports, independent publications, press releases and opinion pieces", () => {
    const counts = coverageCounts([
      article({ source: "Reuters", sourceDomain: "reuters.com" }),
      article({ source: "Reuters", sourceDomain: "reuters.com" }),
      article({ source: "CBC News", sourceDomain: "cbc.ca", contentType: "opinion" }),
      article({ source: "PR Newswire", sourceDomain: "prnewswire.com", contentType: "press_release" }),
    ]);
    expect(counts).toEqual({
      reports: 4,
      independentPublications: 2,
      pressReleases: 1,
      opinionPieces: 1,
    });
    expect(formatCoverageCounts(counts)).toBe(
      "4 reports from 2 independent publications, 1 press release, 1 opinion piece",
    );
  });

  it("does not count a press-release issuer as an independent publication", () => {
    const counts = coverageCounts([
      article({ source: "Acme Corp", contentType: "press_release" }),
      article({ source: "Acme Corp", contentType: "press_release" }),
    ]);
    expect(counts.independentPublications).toBe(0);
    expect(formatCoverageCounts(counts)).toBe(
      "2 reports from 0 independent publications, 2 press releases",
    );
  });
});

describe("coverageGrowth", () => {
  const history: StoryUpdateEvent[] = [
    { kind: "source_added", at: "2026-08-21T12:20:00.000Z", version: "v2", source: "CBC News" },
    { kind: "coverage_change", at: "2026-08-21T12:20:00.000Z", version: "v2", from: 1, to: 2 },
    { kind: "coverage_change", at: "2026-08-21T12:47:00.000Z", version: "v3", from: 2, to: 3 },
  ];

  it("reads first.from to last.to and times it from first coverage", () => {
    const growth = coverageGrowth(history, "2026-08-21T12:00:00.000Z");
    expect(growth).toEqual({ from: 1, to: 3, minutes: 47 });
    expect(formatCoverageGrowth(growth!)).toBe("1 → 3 publications in 47 min");
  });

  it("omits the duration when first coverage is unknown", () => {
    const growth = coverageGrowth(history, undefined);
    expect(growth).toEqual({ from: 1, to: 3, minutes: null });
    expect(formatCoverageGrowth(growth!)).toBe("1 → 3 publications");
  });

  it("is null without coverage_change events or when coverage did not grow", () => {
    expect(coverageGrowth([], "2026-08-21T12:00:00.000Z")).toBeNull();
    expect(
      coverageGrowth(
        [
          { kind: "coverage_change", at: "2026-08-21T12:20:00.000Z", version: "v2", from: 2, to: 1 },
          { kind: "coverage_change", at: "2026-08-21T12:47:00.000Z", version: "v3", from: 1, to: 2 },
        ],
        "2026-08-21T12:00:00.000Z",
      ),
    ).toBeNull();
  });
});

describe("coverageGlance", () => {
  it("renders no lines for a single report", () => {
    expect(
      coverageGlance({
        articles: [article()],
        history: [
          { kind: "headline_updated", at: "2026-08-21T13:00:00.000Z", version: "v2", from: "a", to: "b" },
        ],
        firstSeenAt: "2026-08-21T12:05:00.000Z",
      }),
    ).toEqual([]);
  });

  it("emits first-observed, span, counts and growth lines in order", () => {
    const lines = coverageGlance({
      articles: [
        article({ source: "Lead Paper", publishedAt: "2026-08-21T13:00:00.000Z" }),
        article({ source: "Early Bird", publishedAt: "2026-08-21T12:00:00.000Z" }),
        article({ source: "Third Outlet", publishedAt: "2026-08-21T15:18:00.000Z" }),
      ],
      history: [
        { kind: "coverage_change", at: "2026-08-21T12:47:00.000Z", version: "v2", from: 1, to: 3 },
      ],
      firstSeenAt: "2026-08-21T12:00:00.000Z",
    });
    expect(lines.map((line) => line.kind)).toEqual(["first-observed", "span", "counts", "growth"]);
    expect(lines[0].label).toBe("First observed by CurrentWire");
    expect(lines[0].value).toMatch(/^Early Bird · .*ET$/);
    expect(lines[1].value).toBe("3h 18m");
    expect(lines[2].value).toBe("3 reports from 3 independent publications");
    expect(lines[3].value).toBe("1 → 3 publications in 47 min");
  });

  it("drops the span line when every report carries the same minute and growth without history", () => {
    const lines = coverageGlance({
      articles: [article({ source: "A" }), article({ source: "B" })],
      history: [],
    });
    expect(lines.map((line) => line.kind)).toEqual(["first-observed", "counts"]);
  });

  it("never says '<number> sources'", () => {
    const lines = coverageGlance({
      articles: [article({ source: "A" }), article({ source: "B" })],
      history: [],
    });
    for (const line of lines) {
      expect(`${line.label}: ${line.value}`).not.toMatch(/\d+ sources/);
    }
  });
});
