import { describe, expect, it } from "vitest";

import {
  MIN_SAMPLE_IMPRESSIONS,
  SOURCE_COUNT_BUCKETS,
  aggregateByTemplate,
  buildStorySignals,
  classifyPath,
  computeBySourceCount,
  computeEarlyDiscovery,
  finishBucket,
  missingStoryIds,
  newBucket,
  pathnameOf,
  publicationsFor,
  sampleLabel,
  sourceCountBucketKeys,
  storyIdOf,
} from "../../scripts/gsc-report-lib.mjs";

const BASE = "https://currentwire.us";

/** A GSC Search Analytics page row. */
function row(path: string, impressions: number, clicks = 0, position = 10) {
  return { keys: [`${BASE}${path}`], impressions, clicks, position, ctr: impressions ? clicks / impressions : 0 };
}

const ID_A = "c0123456789ab";
const ID_B = "cabcdefabcdef";
const ID_C = "c111111111111";
const ID_D = "c222222222222";
const ID_E = "c333333333333";
const ID_F = "c444444444444";

describe("storyIdOf", () => {
  it("returns the trailing cluster id of a story path", () => {
    expect(storyIdOf(`/story/some-headline-${ID_A}`)).toBe(ID_A);
    expect(storyIdOf("/story/x-cc5823ef92e20")).toBe("cc5823ef92e20");
  });

  it("returns null for non-story paths and paths without a well-formed id", () => {
    expect(storyIdOf("/politics")).toBeNull();
    expect(storyIdOf(`/topic/some-topic-${ID_A}`)).toBeNull();
    expect(storyIdOf("/story/no-id-here")).toBeNull();
    expect(storyIdOf("/story/too-short-c0123")).toBeNull();
    expect(storyIdOf("/story/upper-hex-C0123456789AB")).toBeNull();
    expect(storyIdOf(`/story/trailing-segment-${ID_A}/amp`)).toBeNull();
  });
});

describe("pathnameOf", () => {
  it("strips trailing slashes, keeps the root and tolerates garbage", () => {
    expect(pathnameOf(`${BASE}/politics/`)).toBe("/politics");
    expect(pathnameOf(`${BASE}/`)).toBe("/");
    expect(pathnameOf(BASE)).toBe("/");
    expect(pathnameOf("not a url")).toBe("/__unparseable__");
  });
});

describe("classifyPath", () => {
  it("maps every template family", () => {
    expect(classifyPath("/")).toBe("home");
    expect(classifyPath(`/story/headline-${ID_A}`)).toBe("story");
    expect(classifyPath("/top-10")).toBe("top-10");
    expect(classifyPath("/top-100")).toBe("top-100");
    expect(classifyPath("/briefing")).toBe("briefing");
    expect(classifyPath("/briefing/2026-08-21")).toBe("briefing");
    expect(classifyPath("/topic/inflation")).toBe("topic");
    expect(classifyPath("/source/reuters")).toBe("source");
    expect(classifyPath("/reports/2026-w34")).toBe("reports");
    expect(classifyPath("/archive/2026/08")).toBe("archive");
    expect(classifyPath("/most-covered")).toBe("most-covered");
    expect(classifyPath("/latest")).toBe("latest");
    expect(classifyPath("/us")).toBe("country");
    expect(classifyPath("/canada/news")).toBe("country");
    expect(classifyPath("/topics")).toBe("index");
    expect(classifyPath("/sources")).toBe("index");
    expect(classifyPath("/search")).toBe("index");
    expect(classifyPath("/politics")).toBe("section");
    expect(classifyPath("/politics/page/2")).toBe("section");
    expect(classifyPath("/ai")).toBe("hub");
    expect(classifyPath("/about")).toBe("other");
    expect(classifyPath("/__unparseable__")).toBe("other");
  });
});

describe("finishBucket / sufficientSample", () => {
  it("flags buckets at or above MIN_SAMPLE_IMPRESSIONS as sufficient, below as early", () => {
    expect(MIN_SAMPLE_IMPRESSIONS).toBe(100);
    const below = newBucket();
    below.urls.add("a");
    below.impressions = MIN_SAMPLE_IMPRESSIONS - 1;
    const at = newBucket();
    at.urls.add("a");
    at.impressions = MIN_SAMPLE_IMPRESSIONS;
    const empty = finishBucket(newBucket());
    expect(finishBucket(below).sufficientSample).toBe(false);
    expect(finishBucket(at).sufficientSample).toBe(true);
    expect(empty.sufficientSample).toBe(false);
    expect(sampleLabel(finishBucket(below))).toBe("early (<100 impr)");
    expect(sampleLabel(finishBucket(at))).toBe("ok");
    // The threshold is a parameter, so a future report can tighten it.
    expect(finishBucket(below, 50).sufficientSample).toBe(true);
  });

  it("stamps the flag on every template and detail bucket", () => {
    const rows = [
      row("/", 150, 10, 5),
      row("/politics", 20, 1, 12),
      row("/ai", 3, 0, 30),
      row(`/story/a-${ID_A}`, 120, 2, 15),
    ];
    const out = aggregateByTemplate(rows);
    expect(out.total.sufficientSample).toBe(true);
    expect(out.templates.home.sufficientSample).toBe(true);
    expect(out.templates.story.sufficientSample).toBe(true);
    expect(out.templates.section.sufficientSample).toBe(false);
    expect(out.templates["top-10"].sufficientSample).toBe(false);
    expect(out.detail["/politics"].sufficientSample).toBe(false);
    expect(out.detail["/ai"].sufficientSample).toBe(false);
    // Unchanged fields still there.
    expect(out.templates.home).toMatchObject({ urls: 1, impressions: 150, clicks: 10, ctr: 0.0667, avgPosition: 5 });
  });
});

describe("publicationsFor / sourceCountBucketKeys", () => {
  it("takes the highest of live, archive (stored / union / peak) and ledger counts", () => {
    const live = new Map([[ID_A, 1]]);
    const archive = new Map([
      [ID_A, { sourceCount: 1, unionPublications: 3, peakHistoryCoverage: 2 }],
      [ID_B, { sourceCount: 2, unionPublications: null, peakHistoryCoverage: 5 }],
    ]);
    const ledger = new Map([[ID_C, 2]]);
    expect(publicationsFor(ID_A, live, archive, ledger)).toBe(3);
    expect(publicationsFor(ID_B, live, archive, ledger)).toBe(5);
    expect(publicationsFor(ID_C, live, archive, ledger)).toBe(2);
    expect(publicationsFor(ID_D, live, archive, ledger)).toBeNull();
  });

  it("puts each count into its exact bucket plus the cumulative ones", () => {
    expect(sourceCountBucketKeys(null)).toEqual(["unknown"]);
    expect(sourceCountBucketKeys(0)).toEqual(["1"]);
    expect(sourceCountBucketKeys(1)).toEqual(["1"]);
    expect(sourceCountBucketKeys(2)).toEqual(["2", "2+"]);
    expect(sourceCountBucketKeys(3)).toEqual(["3", "2+", "3+"]);
    expect(sourceCountBucketKeys(4)).toEqual(["4+", "2+", "3+"]);
    expect(sourceCountBucketKeys(17)).toEqual(["4+", "2+", "3+"]);
  });
});

describe("computeBySourceCount", () => {
  const webRows = [
    row(`/story/live-one-${ID_A}`, 100, 5, 10), // live: 1
    row(`/story/archive-union-three-${ID_B}`, 40, 2, 20), // archive: stored 1, union 3
    row(`/story/archive-peak-four-${ID_C}`, 30, 3, 5), // archive: peak coverage 4
    row(`/story/ledger-two-${ID_D}`, 20, 0, 40), // ledger only: 2
    row(`/story/nobody-knows-${ID_E}`, 10, 1, 50), // unknown
    row(`/story/reslugged-${ID_A}`, 50, 0, 30), // second URL of the live story
    row("/politics", 999, 99, 1), // not a story → ignored
  ];
  const live = new Map([[ID_A, 1]]);
  const archive = new Map([
    [ID_B, { sourceCount: 1, unionPublications: 3, peakHistoryCoverage: null }],
    [ID_C, { sourceCount: 1, unionPublications: 1, peakHistoryCoverage: 4 }],
  ]);
  const ledger = [
    { id: ID_D, slug: `ledger-two-${ID_D}`, publishedAt: "2026-08-01T00:00:00.000Z", sourceCount: 2 },
    { id: ID_F, slug: `no-count-${ID_F}`, publishedAt: "2026-08-01T00:00:00.000Z" },
  ];
  const out = computeBySourceCount(webRows, live, archive, ledger);

  it("emits exactly the 1 / 2 / 3 / 4+ / 2+ / 3+ / unknown buckets in print order", () => {
    expect(Object.keys(out)).toEqual(["1", "2", "3", "4+", "2+", "3+", "unknown"]);
    expect(SOURCE_COUNT_BUCKETS).toEqual(["1", "2", "3", "4+", "2+", "3+", "unknown"]);
  });

  it("buckets by the highest recorded publication count and overlaps the cumulative rows", () => {
    expect(out["1"]).toMatchObject({ urls: 2, impressions: 150, clicks: 5 });
    expect(out["2"]).toMatchObject({ urls: 1, impressions: 20, clicks: 0 });
    expect(out["3"]).toMatchObject({ urls: 1, impressions: 40, clicks: 2 });
    expect(out["4+"]).toMatchObject({ urls: 1, impressions: 30, clicks: 3 });
    expect(out["2+"]).toMatchObject({ urls: 3, impressions: 90, clicks: 5 });
    expect(out["3+"]).toMatchObject({ urls: 2, impressions: 70, clicks: 5 });
    expect(out.unknown).toMatchObject({ urls: 1, impressions: 10, clicks: 1 });
  });

  it("carries ctr, impression-weighted avgPosition and the sample flag per bucket", () => {
    expect(out["1"].ctr).toBe(0.0333);
    // (100*10 + 50*30) / 150 = 16.7
    expect(out["1"].avgPosition).toBe(16.7);
    expect(out["1"].sufficientSample).toBe(true);
    expect(out["2+"].sufficientSample).toBe(false);
    expect(out.unknown.sufficientSample).toBe(false);
    expect(out["1"].impressionsPerUrl).toBe(75);
  });
});

describe("missingStoryIds", () => {
  it("lists story ids from all row sets that the live endpoint did not return, once each", () => {
    const web = [row(`/story/a-${ID_A}`, 1), row(`/story/b-${ID_B}`, 1), row("/politics", 1)];
    const news = [row(`/story/b-again-${ID_B}`, 1), row(`/story/c-${ID_C}`, 1)];
    expect(missingStoryIds([web, news], new Map([[ID_A, 1]])).sort()).toEqual([ID_B, ID_C].sort());
    expect(missingStoryIds([[], []], new Map())).toEqual([]);
  });
});

describe("buildStorySignals", () => {
  it("sums web + news (and re-slugged URLs) per cluster id, highest impressions first", () => {
    const web = [
      row(`/story/one-${ID_A}`, 5, 1),
      row(`/story/one-reslugged-${ID_A}`, 2, 0),
      row(`/story/two-${ID_B}`, 3, 0),
      row(`/story/zero-${ID_C}`, 0, 0),
      row("/politics", 50, 5),
    ];
    const news = [row(`/story/two-${ID_B}`, 9, 2), row(`/story/news-only-${ID_D}`, 1, 1)];
    const out = buildStorySignals(web, news);
    expect(out.stories).toEqual({ [ID_B]: [12, 2], [ID_A]: [7, 1], [ID_D]: [1, 1] });
    expect(Object.keys(out.stories)).toEqual([ID_B, ID_A, ID_D]);
    expect(out.storyCount).toBe(3);
    expect(out.truncated).toBe(false);
  });

  it("caps the list at the highest-impression stories and reports truncation", () => {
    const web = [row(`/story/a-${ID_A}`, 1), row(`/story/b-${ID_B}`, 30), row(`/story/c-${ID_C}`, 20)];
    const out = buildStorySignals(web, [], { cap: 2 });
    expect(Object.keys(out.stories)).toEqual([ID_B, ID_C]);
    expect(out.storyCount).toBe(2);
    expect(out.truncated).toBe(true);
    expect(buildStorySignals([], []).stories).toEqual({});
  });

  it("honours minImpressions", () => {
    const web = [row(`/story/a-${ID_A}`, 1), row(`/story/b-${ID_B}`, 4)];
    expect(Object.keys(buildStorySignals(web, [], { minImpressions: 2 }).stories)).toEqual([ID_B]);
  });
});

describe("computeEarlyDiscovery", () => {
  it("counts day-granular discovery as an upper bound and ignores too-young stories", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const ledger = [
      // Published 10 days ago, first impression the next day → ≤48h.
      { id: ID_A, slug: "a", publishedAt: "2026-08-11T06:00:00.000Z" },
      // Published 5 days ago, never seen.
      { id: ID_B, slug: "b", publishedAt: "2026-08-16T06:00:00.000Z" },
      // Published 1 day ago: younger than 72h, not eligible.
      { id: ID_C, slug: "c", publishedAt: "2026-08-20T06:00:00.000Z" },
    ];
    const pageDateRows = [
      { keys: [`${BASE}/story/a-${ID_A}`, "2026-08-12"], impressions: 2, clicks: 0, position: 9 },
      { keys: [`${BASE}/story/a-${ID_A}`, "2026-08-13"], impressions: 4, clicks: 0, position: 9 },
      { keys: [`${BASE}/story/c-${ID_C}`, "2026-08-20"], impressions: 1, clicks: 0, position: 9 },
    ];
    const out = computeEarlyDiscovery(ledger, pageDateRows, now);
    expect(out.eligibleStories).toBe(2);
    expect(out.discoveredStories).toBe(1);
    expect(out.discoveredPct).toBe(50);
    expect(out.within24hPct).toBe(0);
    expect(out.within48hPct).toBe(50);
    expect(out.within72hPct).toBe(50);
    // end of 2026-08-12 UTC minus 2026-08-11T06:00 = 42 h
    expect(out.medianHoursToFirstImpression).toBe(42);
  });
});
