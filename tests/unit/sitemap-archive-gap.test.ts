import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PERSIST_MIN_INTERVAL_MS } from "../../lib/database/persist-gate";
import {
  CLUSTER_ID_RE,
  GRACE_MS,
  HISTORY_CAP,
  advertisedStories,
  appendHistory,
  classifyGap,
  formatGapReport,
  mergeAdvertised,
  storyIdFrom,
} from "../../scripts/sitemap-archive-gap-lib.mjs";

const urlBlock = (loc: string, extra = "") => `<url><loc>${loc}</loc>${extra}</url>`;
const STORY = "https://currentwire.us/story/some-headline-here-c0123456789ab";

describe("storyIdFrom", () => {
  it("reads the cluster id off a published story slug", () => {
    expect(storyIdFrom(STORY)).toBe("c0123456789ab");
  });

  it("returns null for a section page, so hubs are never counted as stories", () => {
    expect(storyIdFrom("https://currentwire.us/politics")).toBeNull();
  });

  it("returns null when the trailing token is not a well-formed cluster id", () => {
    // Uppercase hex and a wrong length are both rejected: the id token is
    // lowercase and exactly 12 hex characters after the leading `c`.
    expect(storyIdFrom("https://currentwire.us/story/a-headline-cABCDEF123456")).toBeNull();
    expect(storyIdFrom("https://currentwire.us/story/a-headline-c0123")).toBeNull();
  });
});

describe("advertisedStories", () => {
  it("prefers news:publication_date over lastmod as advertised-since", () => {
    // publication_date IS the archive's first_seen_at (2026-08-27 incident);
    // a lastmod is a MODIFICATION date. Reading the wrong one is the mistake
    // that produced two wrong sharding deadlines.
    const xml = urlBlock(
      STORY,
      "<lastmod>2026-09-11T10:00:00.000Z</lastmod>" +
        "<news:publication_date>2026-09-11T09:00:00.000Z</news:publication_date>",
    );
    expect(advertisedStories(xml, "news-sitemap.xml")[0].advertisedSince).toBe(
      "2026-09-11T09:00:00.000Z",
    );
  });

  it("falls back to lastmod when there is no publication_date", () => {
    const xml = urlBlock(STORY, "<lastmod>2026-09-11T10:00:00.000Z</lastmod>");
    expect(advertisedStories(xml, "sitemap.xml")[0].advertisedSince).toBe(
      "2026-09-11T10:00:00.000Z",
    );
  });

  it("skips non-story URLs and keeps the surface label", () => {
    const xml = urlBlock("https://currentwire.us/") + urlBlock(STORY);
    const rows = advertisedStories(xml, "sitemap.xml");
    expect(rows).toHaveLength(1);
    expect(rows[0].surface).toBe("sitemap.xml");
  });

  it("returns nothing for empty or unparseable input rather than throwing", () => {
    expect(advertisedStories("", "sitemap.xml")).toEqual([]);
    expect(advertisedStories(null, "sitemap.xml")).toEqual([]);
  });
});

describe("mergeAdvertised", () => {
  it("keeps the earliest advertised-since across surfaces and records both", () => {
    // How long crawlers could see it AT ALL is the question, so the earliest
    // sighting wins regardless of which sitemap carried it.
    const merged = mergeAdvertised(
      advertisedStories(urlBlock(STORY, "<lastmod>2026-09-11T10:00:00.000Z</lastmod>"), "sitemap.xml"),
      advertisedStories(
        urlBlock(STORY, "<news:publication_date>2026-09-11T08:00:00.000Z</news:publication_date>"),
        "news-sitemap.xml",
      ),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].advertisedSince).toBe("2026-09-11T08:00:00.000Z");
    expect(merged[0].surfaces.sort()).toEqual(["news-sitemap.xml", "sitemap.xml"]);
  });
});

describe("classifyGap", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");
  const entry = (id: string, minutesAgo: number) => ({
    id,
    loc: `https://currentwire.us/story/headline-${id}`,
    surfaces: ["sitemap.xml"],
    advertisedSince: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  });

  it("counts a story the archive holds as archived, whatever its age", () => {
    const summary = classifyGap([entry("c0123456789ab", 600)], ["c0123456789ab"], now);
    expect(summary.archived).toBe(1);
    expect(summary.overdue).toBe(0);
  });

  it("counts a brand-new unarchived story as pending, NOT overdue", () => {
    // This is the healthy steady state: sitemap.xml is force-dynamic over the
    // live dataset and writes are batched, so new stories are ALWAYS
    // advertised before they are archived. Flagging these would make the
    // instrument useless.
    const summary = classifyGap([entry("c0123456789ab", 5)], [], now);
    expect(summary.pending).toBe(1);
    expect(summary.overdue).toBe(0);
  });

  it("counts an unarchived story past the grace window as overdue", () => {
    const summary = classifyGap([entry("c0123456789ab", 200)], [], now);
    expect(summary.overdue).toBe(1);
    expect(summary.overdueEntries[0].ageMinutes).toBe(200);
  });

  it("puts the boundary strictly past the grace window, not at it", () => {
    const graceMinutes = GRACE_MS / 60_000;
    expect(classifyGap([entry("c0123456789ab", graceMinutes)], [], now).overdue).toBe(0);
    expect(classifyGap([entry("c0123456789ab", graceMinutes + 1)], [], now).overdue).toBe(1);
  });

  it("treats an unreadable timestamp as pending, never as overdue", () => {
    // An unknown must not be laundered into a defect — the same rule the
    // crawl-freshness evaluator holds for an unparseable sitemap timestamp.
    const summary = classifyGap(
      [{ id: "c0123456789ab", loc: STORY, surfaces: ["sitemap.xml"], advertisedSince: "not a date" }],
      [],
      now,
    );
    expect(summary.overdue).toBe(0);
    expect(summary.pending).toBe(1);
    expect(summary.undated).toBe(1);
  });

  it("reports oldest orphan candidate first", () => {
    const summary = classifyGap([entry("c0000000000aa", 120), entry("c0000000000bb", 400)], [], now);
    expect(summary.overdueEntries.map((row: { id: string }) => row.id)).toEqual([
      "c0000000000bb",
      "c0000000000aa",
    ]);
  });

  it("breaks the unarchived count down by surface", () => {
    // The whole point of the 2026-09-11 measurement: news-sitemap.xml is
    // archive-gated and must read 0 unarchived, while sitemap.xml legitimately
    // carries the persist window. A regression that lets an unarchived story
    // into the news sitemap has to be visible as a number.
    const summary = classifyGap(
      [
        { ...entry("c0000000000aa", 5), surfaces: ["sitemap.xml"] },
        { ...entry("c0000000000bb", 5), surfaces: ["news-sitemap.xml"] },
      ],
      ["c0000000000bb"],
      now,
    );
    const bySurface = summary.bySurface as Record<string, { advertised: number; unarchived: number }>;
    expect(bySurface["sitemap.xml"]).toEqual({ advertised: 1, unarchived: 1 });
    expect(bySurface["news-sitemap.xml"]).toEqual({ advertised: 1, unarchived: 0 });
  });
});

describe("the grace window against the write cadence it is derived from", () => {
  it("stays comfortably clear of the real worst-case persist delay", () => {
    // GRACE_MS is only defensible relative to the batching it must not flag.
    // The cold window reaches minute 15 of each 30, so worst case is the
    // interval plus that window. If persist-gate's cadence is ever widened,
    // this fails and the threshold gets re-derived instead of silently
    // turning normal batching into "orphan candidates".
    const worstCaseMs = PERSIST_MIN_INTERVAL_MS + 15 * 60_000;
    expect(GRACE_MS).toBeGreaterThanOrEqual(worstCaseMs * 2);
  });
});

describe("appendHistory", () => {
  const summary = {
    measuredAt: "2026-09-11T12:00:00.000Z",
    graceMinutes: 90,
    advertised: 760,
    archived: 741,
    pending: 19,
    overdue: 0,
    undated: 0,
    bySurface: { "sitemap.xml": { advertised: 200, unarchived: 19 } },
    overdueEntries: [],
  };

  it("appends newest last and records which ids were overdue", () => {
    const rows = appendHistory([], {
      ...summary,
      overdue: 1,
      overdueEntries: [{ id: "c0123456789ab", loc: STORY, surfaces: [], advertisedSince: "", ageMinutes: 200 }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].overdueIds).toEqual(["c0123456789ab"]);
  });

  it("caps the series", () => {
    let rows: unknown[] = [];
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) rows = appendHistory(rows, summary);
    expect(rows).toHaveLength(HISTORY_CAP);
  });

  it("survives a missing or corrupt history file", () => {
    expect(appendHistory(null, summary)).toHaveLength(1);
  });
});

describe("formatGapReport", () => {
  const base = {
    measuredAt: "2026-09-11T12:00:00.000Z",
    graceMinutes: 90,
    advertised: 760,
    archived: 741,
    pending: 19,
    overdue: 0,
    undated: 0,
    bySurface: { "sitemap.xml": { advertised: 200, unarchived: 19 } },
    overdueEntries: [],
  };

  it("says plainly that a clean reading is clean", () => {
    expect(formatGapReport(base)).toContain("No orphan candidates");
  });

  it("names each orphan candidate and what it will become", () => {
    const text = formatGapReport({
      ...base,
      overdue: 1,
      overdueEntries: [
        { id: "c0123456789ab", loc: STORY, surfaces: ["sitemap.xml"], advertisedSince: "", ageMinutes: 200 },
      ],
    });
    expect(text).toContain("c0123456789ab");
    expect(text).toContain("permanent 500");
  });
});

describe("the runner's failure discipline", () => {
  const runner = readFileSync("scripts/sitemap-archive-gap.mjs", "utf8");

  it("aborts when the archive cannot be ASKED, rather than reporting everything unarchived", () => {
    // A non-200 from archive-sources means no answer; an empty rows array
    // means "no record". Conflating them would report the entire corpus as
    // orphaned during an archive outage — a false alarm on the worst day.
    expect(runner).toContain("answered ${res.status}");
    expect(runner).toMatch(/rows array/);
  });

  it("never exits non-zero for a high overdue count", () => {
    // The only exit(1) in the file is the could-not-measure handler.
    expect(runner.match(/process\.exit\(1\)/g)).toHaveLength(1);
    expect(runner).toContain("could not measure");
  });
});

describe("CLUSTER_ID_RE", () => {
  it("matches the token shape the rest of the repo relies on", () => {
    expect(CLUSTER_ID_RE.test("-c0123456789ab")).toBe(true);
    expect(CLUSTER_ID_RE.test("-c0123456789abc")).toBe(false);
  });
});
