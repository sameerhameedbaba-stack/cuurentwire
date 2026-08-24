import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import { NOINDEX_FOLLOW } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  applyStoryIndexDecision,
  archiveSitemapIndexableSql,
  BRIEFING_DESCRIPTION_MAX_CHARS,
  briefingMetaDescription,
  briefingMetaTitle,
  countStoryValueEvents,
  EVALUATION_WINDOW_HOURS,
  readThinStoryNoindexSwitch,
  storyIndexDecision,
  type StoryIndexInput,
} from "@/lib/seo/story-indexing";

/**
 * A 20-day-old single report with nothing CurrentWire adds, that a FRESH
 * Search Console report showed to nobody — the only noindex case.
 */
const THIN_20D: StoryIndexInput = {
  ageHours: 20 * 24,
  independentPublications: 1,
  historyEvents: 0,
  corroboratedDetails: 0,
  relatedCoverage: 0,
  hasSummary: true,
  gsc: { available: true, impressions: 0, clicks: 0 },
};

describe("storyIndexDecision", () => {
  it("uses a 14-day (336h) evaluation window", () => {
    expect(EVALUATION_WINDOW_HOURS).toBe(336);
  });

  it("indexes a single-source story inside the evaluation window regardless of depth", () => {
    const decision = storyIndexDecision({ ...THIN_20D, ageHours: 5 }, { enabled: true });
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("evaluation window");
    // 80h — the old 72h policy's noindex case — is now well inside the window.
    expect(storyIndexDecision({ ...THIN_20D, ageHours: 80 }, { enabled: true }).index).toBe(true);
  });

  it("treats exactly 336h as still inside the window, and 337h as past it", () => {
    expect(
      storyIndexDecision({ ...THIN_20D, ageHours: EVALUATION_WINDOW_HOURS }, { enabled: true })
        .index,
    ).toBe(true);
    expect(
      storyIndexDecision(
        { ...THIN_20D, ageHours: EVALUATION_WINDOW_HOURS + 1 },
        { enabled: true },
      ).index,
    ).toBe(false);
  });

  it("never noindexes on an unknown age (NaN from a bad timestamp counts as inside the window)", () => {
    const decision = storyIndexDecision({ ...THIN_20D, ageHours: Number.NaN }, { enabled: true });
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("unknown");
  });

  it("noindexes a 20-day single-source story with no value and 0 impressions in a fresh report", () => {
    const decision = storyIndexDecision(THIN_20D, { enabled: true });
    expect(decision.index).toBe(false);
    expect(decision.reason).toContain("single-source");
    expect(decision.reason).toContain("0 Search Console impressions");
  });

  it("records a missing summary in the noindex reason without changing the decision", () => {
    const decision = storyIndexDecision({ ...THIN_20D, hasSummary: false }, { enabled: true });
    expect(decision.index).toBe(false);
    expect(decision.reason).toContain("no summary");
  });

  it("keeps the same story indexed with a single Search Console impression", () => {
    const decision = storyIndexDecision(
      { ...THIN_20D, gsc: { available: true, impressions: 1, clicks: 0 } },
      { enabled: true },
    );
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("1 Search Console impression");
  });

  it("keeps the same story indexed with a click even if impressions were not recorded", () => {
    const decision = storyIndexDecision(
      { ...THIN_20D, gsc: { available: true, impressions: 0, clicks: 1 } },
      { enabled: true },
    );
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("click");
  });

  it("never noindexes when no fresh Search Console report exists", () => {
    const decision = storyIndexDecision(
      { ...THIN_20D, gsc: { available: false, impressions: 0, clicks: 0 } },
      { enabled: true },
    );
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("no fresh Search Console data");
  });

  it("keeps a mature story indexed with two independent publications", () => {
    expect(
      storyIndexDecision({ ...THIN_20D, independentPublications: 2 }, { enabled: true }).index,
    ).toBe(true);
  });

  it("keeps a mature story indexed with one headline update in its history", () => {
    expect(storyIndexDecision({ ...THIN_20D, historyEvents: 1 }, { enabled: true }).index).toBe(
      true,
    );
  });

  it("keeps a mature story indexed with a corroborated detail or related coverage", () => {
    expect(
      storyIndexDecision({ ...THIN_20D, corroboratedDetails: 1 }, { enabled: true }).index,
    ).toBe(true);
    expect(storyIndexDecision({ ...THIN_20D, relatedCoverage: 1 }, { enabled: true }).index).toBe(
      true,
    );
  });

  it("checks CurrentWire value before Search Console data (reason names the earlier signal)", () => {
    const decision = storyIndexDecision(
      {
        ...THIN_20D,
        independentPublications: 3,
        gsc: { available: true, impressions: 50, clicks: 2 },
      },
      { enabled: true },
    );
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("3 independent publications");
  });

  it("always indexes when the switch is off", () => {
    const decision = storyIndexDecision(THIN_20D, { enabled: false });
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("THIN_STORY_NOINDEX=off");
  });
});

describe("readThinStoryNoindexSwitch", () => {
  it("is on unless THIN_STORY_NOINDEX is exactly off", () => {
    expect(readThinStoryNoindexSwitch(undefined)).toBe(true);
    expect(readThinStoryNoindexSwitch("")).toBe(true);
    expect(readThinStoryNoindexSwitch("on")).toBe(true);
    expect(readThinStoryNoindexSwitch("off")).toBe(false);
    expect(readThinStoryNoindexSwitch(" OFF ")).toBe(false);
  });
});

describe("countStoryValueEvents", () => {
  it("counts headline, coverage and source events and ignores reclassification", () => {
    const history: StoryUpdateEvent[] = [
      { kind: "headline_updated", at: "2026-08-20T10:00:00Z", version: "v1", from: "a", to: "b" },
      { kind: "coverage_change", at: "2026-08-20T10:00:00Z", version: "v1", from: 1, to: 2 },
      { kind: "source_added", at: "2026-08-20T10:00:00Z", version: "v1", source: "Reuters" },
      { kind: "category_changed", at: "2026-08-20T10:00:00Z", version: "v1", from: "us", to: "politics" },
    ];
    expect(countStoryValueEvents(history)).toBe(3);
    expect(countStoryValueEvents([])).toBe(0);
  });
});

describe("applyStoryIndexDecision", () => {
  const base = pageMetadata({ title: "T", description: "D", path: "/story/x" });

  it("replaces robots with noindex,follow on a noindex decision", () => {
    const applied = applyStoryIndexDecision(base, { index: false, reason: "thin" });
    expect(applied.robots).toEqual(NOINDEX_FOLLOW);
    expect(applied.robots).toMatchObject({ index: false, follow: true });
    // Everything else — title, canonical, OG — is untouched.
    expect(applied.title).toBe(base.title);
    expect(applied.alternates).toEqual(base.alternates);
  });

  it("returns the metadata unchanged on an index decision", () => {
    expect(applyStoryIndexDecision(base, { index: true, reason: "fresh" })).toBe(base);
  });
});

describe("archiveSitemapIndexableSql", () => {
  it("renders the documented predicate: window OR source_count OR sources OR history OR protected", () => {
    const protectedIds = ["c0123456789ab", "cfedcba987654"];
    const { sql, params } = new PgDialect().sqlToQuery(archiveSitemapIndexableSql(protectedIds));
    expect(sql).toContain(`"first_seen_at" > now() - interval '336 hours'`);
    expect(sql).toContain(`interval '${EVALUATION_WINDOW_HOURS} hours'`);
    expect(sql).toContain(`"source_count" >= 2`);
    expect(sql).toMatch(/jsonb_array_length\("[a-z_".]*sources"\) >= 2/);
    expect(sql).toMatch(/jsonb_array_length\("[a-z_".]*history"\) > 0/);
    // The protected set is ONE text[] parameter, never inlined.
    expect(sql).toMatch(/"cluster_id" = any\(\$1::text\[\]\)/);
    expect(params).toEqual([protectedIds]);
    for (const id of protectedIds) expect(sql).not.toContain(id);
  });

  it("still renders valid SQL with an empty protected set", () => {
    const { sql, params } = new PgDialect().sqlToQuery(archiveSitemapIndexableSql([]));
    expect(sql).toMatch(/= any\(\$1::text\[\]\)/);
    expect(params).toEqual([[]]);
  });
});

describe("briefing metadata", () => {
  const items = [
    { title: "Senate passes bipartisan rail safety bill", sourceCount: 5 },
    { title: "Bank of Canada holds rate at 2.75%", sourceCount: 3 },
    { title: "Wildfire evacuations expand in British Columbia interior", sourceCount: 4 },
    { title: "Fourth story that must not appear", sourceCount: 2 },
  ];

  it("titles a briefing with the region and the day", () => {
    // Retitled 2026-08-24 (seo/STRATEGY.md Sprint 1): dated pages target
    // the "news summary" query family, deliberately WITHOUT "today" so an
    // archived day never fakes freshness.
    expect(briefingMetaTitle("August 21, 2026")).toBe("News Summary: August 21, 2026 — Top US & Canada Stories");
  });

  it("describes today's briefing from its top three headlines and total reports", () => {
    const description = briefingMetaDescription(items);
    expect(description).toBe(
      "Today's US and Canada news briefing covers Senate passes bipartisan rail safety bill, Bank of Canada holds rate at 2.75% and Wildfire evacuations expand in British Columbia interior — 4 stories ranked from 14 publisher reports.",
    );
  });

  it("dates a past day's briefing instead of calling it today's", () => {
    const description = briefingMetaDescription(items.slice(0, 1), { dayLabel: "August 20, 2026" });
    expect(description).toBe(
      "The August 20, 2026 US and Canada news briefing covers Senate passes bipartisan rail safety bill — 1 story ranked from 5 publisher reports.",
    );
  });

  it("truncates long headlines at a word boundary and stays under the ceiling", () => {
    const long = Array.from({ length: 10 }, (_, i) => ({
      title: `Headline ${i} ${"word ".repeat(30)}ends here with an unusually long final clause`,
      sourceCount: 7,
    }));
    const description = briefingMetaDescription(long);
    expect(description.length).toBeLessThanOrEqual(BRIEFING_DESCRIPTION_MAX_CHARS);
    expect(description).toContain("Headline 0 word");
    expect(description).toContain("…");
    expect(description).toMatch(/10 stories ranked from 70 publisher reports\.$/);
  });

  it("joins two headlines with 'and' and yields nothing for no items", () => {
    expect(briefingMetaDescription(items.slice(0, 2))).toContain(
      "covers Senate passes bipartisan rail safety bill and Bank of Canada holds rate at 2.75% —",
    );
    expect(briefingMetaDescription([])).toBe("");
  });
});
