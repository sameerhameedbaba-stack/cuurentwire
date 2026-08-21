import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_IDS } from "@/config/categories";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";

// Mocked db layer — these tests never touch Postgres. getDb is swapped per
// test: null (unconfigured) or a minimal chainable fake.
const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import {
  CONTENT_TYPE_BUCKETS,
  MOST_COVERED_LIMIT,
  aggregateCoverageWeek,
  categoryDisplayLabel,
  contentTypeBucket,
  describeCoverageReport,
  getCoverageReport,
  loadWeekRows,
  publicationsEver,
  type WeekRow,
} from "@/lib/reports/coverage-report";

const T0 = "2026-08-18T12:00:00.000Z";

function plusMinutes(minutes: number, from: string = T0): string {
  return new Date(new Date(from).getTime() + minutes * 60_000).toISOString();
}

function change(atMinutes: number, from: number, to: number): StoryUpdateEvent {
  return { kind: "coverage_change", at: plusMinutes(atMinutes), version: "v", from, to };
}

function src(name: string, publishedAt: string = T0) {
  return { name, publishedAt };
}

function row(overrides: Partial<WeekRow> & { slug: string }): WeekRow {
  return {
    clusterId: overrides.slug,
    title: `Story ${overrides.slug}`,
    category: "politics",
    geography: "US",
    contentType: null,
    firstSeenAt: T0,
    lastPublishedAt: T0,
    sourceCount: 1,
    sources: [src("Reuters")],
    history: [],
    ...overrides,
  };
}

function sumPct(mix: { pct: number }[]): number {
  return mix.reduce((acc, entry) => acc + entry.pct, 0);
}

describe("aggregateCoverageWeek: empty week", () => {
  const report = aggregateCoverageWeek([], null, "2026-W33");

  it("reports zeros and empty lists, never NaN", () => {
    expect(report.totalStories).toBe(0);
    expect(report.distinctPublishers).toBe(0);
    expect(report.mostCovered).toEqual([]);
    expect(report.velocity).toEqual({ fastestTo2: null, fastestTo3: null, biggest24hPickup: null });
    expect(report.publisherParticipation).toEqual([]);
    expect(report.publishersFirstObserved).toEqual([]);
    expect(report.publishersMultiSourceJoins).toEqual([]);
    expect(report.concentration).toEqual({
      singleSourcePct: 0,
      twoSourcePct: 0,
      threePlusPct: 0,
      fourPlusPct: 0,
      multiSourcePct: 0,
      medianIndependentPublications: 0,
      meanIndependentPublications: 0,
    });
    expect(report.weekOverWeek).toBeNull();
  });

  it("still lists the full category / content-type vocabulary at zero", () => {
    expect(report.categoryMix.map((m) => m.id).sort()).toEqual([...CATEGORY_IDS].sort());
    expect(report.categoryMix.every((m) => m.count === 0 && m.pct === 0)).toBe(true);
    expect(report.contentTypeMix.map((m) => m.id)).toEqual([...CONTENT_TYPE_BUCKETS]);
    expect(report.geographyMix).toHaveLength(5);
  });
});

describe("aggregateCoverageWeek: mixes and concentration", () => {
  const rows: WeekRow[] = [
    row({ slug: "a", sourceCount: 1, category: "politics", geography: "US" }),
    row({ slug: "b", sourceCount: 1, category: "politics", geography: "CA", contentType: "opinion" }),
    row({ slug: "c", sourceCount: 2, category: "business", geography: "US", contentType: "analysis" }),
    row({ slug: "d", sourceCount: 3, category: "business", geography: "GLOBAL", contentType: "live" }),
    row({ slug: "e", sourceCount: 4, category: "general", geography: "US_CA", contentType: "press_release" }),
    row({ slug: "f", sourceCount: 6, category: "weirdo", geography: "MARS" }),
  ];
  const report = aggregateCoverageWeek(rows, null, "2026-W34");

  it("counts every story exactly once per mix and the percentages sum to ~100", () => {
    for (const mix of [report.categoryMix, report.geographyMix, report.contentTypeMix]) {
      expect(mix.reduce((acc, m) => acc + m.count, 0)).toBe(rows.length);
      expect(Math.abs(sumPct(mix) - 100)).toBeLessThan(0.3);
    }
  });

  it("sorts mixes by count, includes general, and appends unknown ids", () => {
    expect(report.categoryMix[0]).toEqual({ id: "politics", count: 2, pct: 33.3 });
    expect(report.categoryMix[1]).toEqual({ id: "business", count: 2, pct: 33.3 });
    expect(report.categoryMix.find((m) => m.id === "general")?.count).toBe(1);
    expect(report.categoryMix.find((m) => m.id === "weirdo")?.count).toBe(1);
    expect(report.geographyMix.find((m) => m.id === "MARS")?.count).toBe(1);
  });

  it("buckets content types: null → news, analysis/live → other", () => {
    const byId = Object.fromEntries(report.contentTypeMix.map((m) => [m.id, m.count]));
    expect(byId).toEqual({ news: 2, opinion: 1, press_release: 1, other: 2 });
    expect(contentTypeBucket(null)).toBe("news");
    expect(contentTypeBucket("news")).toBe("news");
    expect(contentTypeBucket("analysis")).toBe("other");
    expect(contentTypeBucket("live")).toBe("other");
    expect(contentTypeBucket("opinion")).toBe("opinion");
    expect(contentTypeBucket("press_release")).toBe("press_release");
  });

  it("computes the concentration shares on source_count", () => {
    // counts: 1,1,2,3,4,6
    expect(report.concentration).toEqual({
      singleSourcePct: 33.3,
      twoSourcePct: 16.7,
      threePlusPct: 50,
      fourPlusPct: 33.3,
      multiSourcePct: 66.7,
      medianIndependentPublications: 2.5,
      meanIndependentPublications: 2.8,
    });
    expect(
      Math.abs(
        report.concentration.singleSourcePct +
          report.concentration.twoSourcePct +
          report.concentration.threePlusPct -
          100,
      ),
    ).toBeLessThan(0.3);
  });
});

describe("aggregateCoverageWeek: most covered", () => {
  it("ranks by source_count, breaks ties on ranking score, and caps the list", () => {
    const rows: WeekRow[] = [];
    for (let i = 0; i < 20; i++) {
      rows.push(row({ slug: `s${i}`, sourceCount: 1 + (i % 5), rankingScore: i }));
    }
    rows.push(row({ slug: "tie-low", sourceCount: 5, rankingScore: 1 }));
    rows.push(row({ slug: "tie-high", sourceCount: 5, rankingScore: 99 }));
    const report = aggregateCoverageWeek(rows, null, "2026-W34");
    expect(report.mostCovered).toHaveLength(MOST_COVERED_LIMIT);
    expect(report.mostCovered[0].slug).toBe("tie-high");
    expect(report.mostCovered[0].independentPublications).toBe(5);
    const counts = report.mostCovered.map((m) => m.independentPublications);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("excludes press releases from the curated table but keeps them in the totals", () => {
    const rows = [
      row({ slug: "pr", sourceCount: 9, contentType: "press_release" }),
      row({ slug: "news", sourceCount: 2 }),
    ];
    const report = aggregateCoverageWeek(rows, null, "2026-W34");
    expect(report.totalStories).toBe(2);
    expect(report.mostCovered.map((m) => m.slug)).toEqual(["news"]);
  });

  it("reports coverage growth as first .from → last .to", () => {
    const rows = [
      row({ slug: "g", sourceCount: 4, history: [change(30, 1, 2), change(60, 2, 1), change(120, 1, 4)] }),
      row({ slug: "flat", sourceCount: 2 }),
    ];
    const report = aggregateCoverageWeek(rows, null, "2026-W34");
    expect(report.mostCovered[0].coverageGrowth).toEqual({ from: 1, to: 4 });
    expect(report.mostCovered[1].coverageGrowth).toBeNull();
  });
});

describe("aggregateCoverageWeek: velocity from history events", () => {
  const a = row({
    slug: "a",
    sourceCount: 3,
    history: [change(30, 1, 2), change(90, 2, 3)],
  });
  // Already at 2 when first observed: time-to-2 is unknown, time-to-3 known.
  const b = row({ slug: "b", sourceCount: 3, history: [change(10, 2, 3)] });
  // 1 → 4 inside the first day, then 4 → 9 after it (ignored for the pickup).
  const c = row({
    slug: "c",
    sourceCount: 9,
    history: [change(60, 1, 4), change(25 * 60, 4, 9)],
  });
  const quiet = row({ slug: "quiet", sourceCount: 1 });
  const report = aggregateCoverageWeek([a, b, c, quiet], null, "2026-W34");

  it("measures minutes to 2 and 3 only when the story was observed below the target", () => {
    const byId = Object.fromEntries(report.mostCovered.map((m) => [m.slug, m]));
    expect(byId.a.minutesTo2).toBe(30);
    expect(byId.a.minutesTo3).toBe(90);
    expect(byId.b.minutesTo2).toBeNull();
    expect(byId.b.minutesTo3).toBe(10);
    expect(byId.c.minutesTo2).toBe(60);
    expect(byId.c.minutesTo3).toBe(60);
    expect(byId.quiet.minutesTo2).toBeNull();
  });

  it("picks the fastest story for each threshold", () => {
    expect(report.velocity.fastestTo2).toEqual({ slug: "a", title: "Story a", minutes: 30 });
    expect(report.velocity.fastestTo3).toEqual({ slug: "b", title: "Story b", minutes: 10 });
  });

  it("reports the biggest net pickup inside 24 hours of first observation", () => {
    expect(report.velocity.biggest24hPickup).toEqual({
      slug: "c",
      title: "Story c",
      from: 1,
      to: 4,
      gained: 3,
      withinMinutes: 60,
    });
  });

  it("never reports negative minutes and ignores press releases", () => {
    const skewed = row({ slug: "skew", sourceCount: 2, history: [change(-5, 1, 2)] });
    const pr = row({
      slug: "pr",
      sourceCount: 5,
      contentType: "press_release",
      history: [change(1, 1, 5)],
    });
    const r = aggregateCoverageWeek([skewed, pr], null, "2026-W34");
    expect(r.velocity.fastestTo2).toEqual({ slug: "skew", title: "Story skew", minutes: 0 });
    expect(r.velocity.biggest24hPickup?.slug).toBe("skew");
  });
});

describe("aggregateCoverageWeek: publishers", () => {
  const rows: WeekRow[] = [
    row({
      slug: "multi",
      sourceCount: 3,
      sources: [
        src("CBC News", plusMinutes(30)),
        src("Reuters", plusMinutes(0)),
        src("AP News", plusMinutes(15)),
        src("Reuters", plusMinutes(45)), // second Reuters article: counted once
      ],
    }),
    row({ slug: "solo", sourceCount: 1, sources: [src("CBC News", plusMinutes(-60))] }),
    row({
      slug: "pr",
      sourceCount: 2,
      contentType: "press_release",
      sources: [src("PR Newswire", plusMinutes(0)), src("CBC News", plusMinutes(5))],
    }),
    row({ slug: "pair", sourceCount: 2, sources: [src("AP News", T0), src("CBC News", T0)] }),
  ];
  const report = aggregateCoverageWeek(rows, null, "2026-W34");

  it("counts participation as distinct stories joined", () => {
    expect(report.distinctPublishers).toBe(4);
    // Ties sort alphabetically so the table is stable between renders.
    expect(report.publisherParticipation).toEqual([
      { name: "CBC News", stories: 4 },
      { name: "AP News", stories: 2 },
      { name: "PR Newswire", stories: 1 },
      { name: "Reuters", stories: 1 },
    ]);
  });

  it("credits the earliest-published source on multi-publication curated stories only", () => {
    // "multi": Reuters (T0) beats AP (+15) and CBC (+30). "solo" is single
    // source, "pr" is a press release; "pair" ties at T0 → array order (AP).
    expect(report.publishersFirstObserved).toEqual([
      { name: "AP News", stories: 1 },
      { name: "Reuters", stories: 1 },
    ]);
  });

  it("counts multi-source joins over stories with 2+ publications", () => {
    expect(report.publishersMultiSourceJoins).toEqual([
      { name: "CBC News", stories: 3 },
      { name: "AP News", stories: 2 },
      { name: "PR Newswire", stories: 1 },
      { name: "Reuters", stories: 1 },
    ]);
  });
});

describe("aggregateCoverageWeek: week over week", () => {
  const previous = [
    row({ slug: "p1", sourceCount: 1, category: "business" }),
    row({ slug: "p2", sourceCount: 1, category: "business" }),
  ];
  const current = [
    row({ slug: "c1", sourceCount: 1 }),
    row({ slug: "c2", sourceCount: 2 }),
    row({ slug: "c3", sourceCount: 3 }),
  ];

  it("computes deltas against the previous week", () => {
    const report = aggregateCoverageWeek(current, previous, "2026-W34");
    expect(report.weekOverWeek).toEqual({
      previousWeekId: "2026-W33",
      stories: { previous: 2, current: 3, delta: 1 },
      multiSourcePct: { previous: 0, current: 66.7, delta: 66.7 },
      medianIndependent: { previous: 1, current: 2, delta: 1 },
      topCategory: { previous: "business", current: "politics" },
    });
  });

  it("is null without a previous week or with an empty one", () => {
    expect(aggregateCoverageWeek(current, null, "2026-W34").weekOverWeek).toBeNull();
    expect(aggregateCoverageWeek(current, [], "2026-W34").weekOverWeek).toBeNull();
  });
});

describe("describeCoverageReport", () => {
  it("builds a deterministic description from the numbers and never says 'N sources'", () => {
    const rows = [
      row({ slug: "a", sourceCount: 1, sources: [src("Reuters")] }),
      row({ slug: "b", sourceCount: 2, sources: [src("Reuters"), src("AP News")] }),
      row({ slug: "c", sourceCount: 3, category: "business", sources: [src("CBC News")] }),
    ];
    const report = aggregateCoverageWeek(rows, null, "2026-W34");
    const description = describeCoverageReport(report, "Aug 17–23, 2026");
    expect(description).toBe(
      "CurrentWire's media coverage report for Aug 17–23, 2026: 3 stories across 3 publications; 66.7% covered by 2+ independent publications; top category Politics.",
    );
    expect(description).not.toMatch(/\d+\s*sources\b/);
    expect(describeCoverageReport(aggregateCoverageWeek([], null, "2026-W34"), "x")).toBe(
      "CurrentWire's media coverage report for x: 0 stories across 0 publications; 0% covered by 2+ independent publications.",
    );
  });

  it("labels known categories from the taxonomy and falls back for unknown ids", () => {
    expect(categoryDisplayLabel("politics")).toBe("Politics");
    expect(categoryDisplayLabel("retired-id")).toBe("Retired-id");
  });
});

/* ---------------------------------------------------------------------- */
/* Database readers (fake db)                                              */
/* ---------------------------------------------------------------------- */

/**
 * Chainable fake: every query-builder method returns the chain, awaiting
 * the chain yields `result`. `execute` (used by ensureArchiveSchema) always
 * rejects, so the reader takes its no-history branch.
 */
function fakeDb(result: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "from", "where", "orderBy", "limit"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    result().then(resolve, reject);
  chain.execute = () => Promise.reject(new Error("schema probe refused"));
  return chain;
}

const NOW_W34 = new Date("2026-08-22T15:00:00.000Z");
const NOW_W35 = new Date("2026-08-26T15:00:00.000Z");

describe("publicationsEver — the permanent publication count", () => {
  it("is the stored active count when nothing else recorded more", () => {
    expect(publicationsEver(row({ slug: "a", sourceCount: 1 }))).toBe(1);
    expect(publicationsEver(row({ slug: "b", sourceCount: 3 }))).toBe(3);
  });

  it("rises to the permanent source union when the active count shrank back to 1", () => {
    // The W33 pattern measured on 2026-08-22: feeds rotated the story out,
    // the last archive write stored source_count = 1, but the union kept
    // every publication that ever covered it.
    const shrunk = row({
      slug: "shrunk",
      sourceCount: 1,
      sources: [src("Reuters"), src("AP News"), src("CBC News")],
    });
    expect(publicationsEver(shrunk)).toBe(3);
  });

  it("rises to the peak recorded coverage_change when the union is shorter", () => {
    const peaked = row({
      slug: "peaked",
      sourceCount: 1,
      sources: [src("Reuters")],
      history: [change(30, 1, 4), change(90, 4, 1)],
    });
    expect(publicationsEver(peaked)).toBe(4);
  });

  it("ignores blank and duplicate publication names in the union", () => {
    const messy = row({
      slug: "messy",
      sourceCount: 1,
      sources: [src("Reuters"), src(" Reuters "), src("  ")],
    });
    expect(publicationsEver(messy)).toBe(1);
  });

  it("drives concentration, multi-source joins and the most-covered table", () => {
    const rows = [
      row({ slug: "solo", sourceCount: 1 }),
      row({
        slug: "shrunk",
        sourceCount: 1,
        sources: [src("Reuters"), src("AP News")],
        history: [change(10, 1, 2), change(200, 2, 1)],
      }),
    ];
    const report = aggregateCoverageWeek(rows, null, "2026-W34");
    expect(report.concentration.multiSourcePct).toBe(50);
    expect(report.concentration.singleSourcePct).toBe(50);
    expect(report.mostCovered[0]).toMatchObject({ slug: "shrunk", independentPublications: 2 });
    expect(report.publishersMultiSourceJoins).toEqual([
      { name: "AP News", stories: 1 },
      { name: "Reuters", stories: 1 },
    ]);
  });
});

describe("getCoverageReport / loadWeekRows", () => {
  beforeEach(() => {
    getDbMock.mockReset();
    getDbMock.mockReturnValue(null);
  });

  it("is null without a database and for malformed ids", async () => {
    expect(await loadWeekRows("2026-W33")).toEqual([]);
    expect(await getCoverageReport("2026-W33", NOW_W34)).toBeNull();
    expect(await getCoverageReport("2026-W3", NOW_W34)).toBeNull();
  });

  it("maps archive rows (Date columns, compact sources) and aggregates them", async () => {
    getDbMock.mockReturnValue(
      fakeDb(async () => [
        {
          clusterId: "c1",
          slug: "story-one-c1",
          title: "Story one",
          category: "politics",
          geography: "US",
          contentType: null,
          firstSeenAt: new Date("2026-08-11T12:00:00.000Z"),
          lastPublishedAt: new Date("2026-08-11T13:00:00.000Z"),
          rankingScore: 70,
          sourceCount: 2,
          sources: [
            { name: "Reuters", publishedAt: "2026-08-11T11:00:00.000Z" },
            { name: "AP News", publishedAt: "2026-08-11T11:30:00.000Z" },
            { name: null, publishedAt: null }, // malformed entry is dropped
          ],
          history: [],
        },
      ]),
    );
    const report = await getCoverageReport("2026-W33", NOW_W34);
    expect(report?.totalStories).toBe(1);
    expect(report?.distinctPublishers).toBe(2);
    expect(report?.mostCovered[0]).toMatchObject({
      slug: "story-one-c1",
      independentPublications: 2,
      firstSeen: "2026-08-11T12:00:00.000Z",
    });
    expect(report?.publishersFirstObserved).toEqual([{ name: "Reuters", stories: 1 }]);
    // W33 is the first report week: no previous week to compare against.
    expect(report?.weekOverWeek).toBeNull();
  });

  it("is null (not an error) for a week with zero rows", async () => {
    getDbMock.mockReturnValue(fakeDb(async () => []));
    expect(await getCoverageReport("2026-W33", NOW_W34)).toBeNull();
  });

  it("fails soft for the current week and loud for a past week", async () => {
    getDbMock.mockReturnValue(fakeDb(() => Promise.reject(new Error("neon down"))));
    await expect(getCoverageReport("2026-W34", NOW_W34)).resolves.toBeNull();
    await expect(getCoverageReport("2026-W34", NOW_W35)).rejects.toThrow("neon down");
  });
});
