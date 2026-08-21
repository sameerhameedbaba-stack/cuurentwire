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
  FRESH_STORY_HOURS,
  readThinStoryNoindexSwitch,
  storyIndexDecision,
  type StoryIndexInput,
} from "@/lib/seo/story-indexing";

/** A mature single report with nothing CurrentWire adds — the noindex case. */
const THIN_80H: StoryIndexInput = {
  ageHours: 80,
  independentPublications: 1,
  historyEvents: 0,
  corroboratedDetails: 0,
  relatedCoverage: 0,
  hasSummary: true,
};

describe("storyIndexDecision", () => {
  it("indexes a fresh single-source story regardless of depth", () => {
    const decision = storyIndexDecision({ ...THIN_80H, ageHours: 5 }, { enabled: true });
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("fresh");
  });

  it("treats exactly 72h as still fresh", () => {
    expect(
      storyIndexDecision({ ...THIN_80H, ageHours: FRESH_STORY_HOURS }, { enabled: true }).index,
    ).toBe(true);
  });

  it("never noindexes on an unknown age (NaN from a bad timestamp counts as fresh)", () => {
    const decision = storyIndexDecision({ ...THIN_80H, ageHours: Number.NaN }, { enabled: true });
    expect(decision.index).toBe(true);
    expect(decision.reason).toContain("unknown");
  });

  it("noindexes an 80h single-source story with no CurrentWire-specific value", () => {
    const decision = storyIndexDecision(THIN_80H, { enabled: true });
    expect(decision.index).toBe(false);
    expect(decision.reason).toContain("single-source");
  });

  it("keeps an 80h story indexed with two independent publications", () => {
    expect(
      storyIndexDecision({ ...THIN_80H, independentPublications: 2 }, { enabled: true }).index,
    ).toBe(true);
  });

  it("keeps an 80h story indexed with one headline update in its history", () => {
    expect(storyIndexDecision({ ...THIN_80H, historyEvents: 1 }, { enabled: true }).index).toBe(
      true,
    );
  });

  it("keeps an 80h story indexed with a corroborated detail or related coverage", () => {
    expect(
      storyIndexDecision({ ...THIN_80H, corroboratedDetails: 1 }, { enabled: true }).index,
    ).toBe(true);
    expect(storyIndexDecision({ ...THIN_80H, relatedCoverage: 1 }, { enabled: true }).index).toBe(
      true,
    );
  });

  it("always indexes when the switch is off", () => {
    const decision = storyIndexDecision(THIN_80H, { enabled: false });
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
  it("renders the documented predicate: fresh OR source_count >= 2 OR history non-empty", () => {
    const { sql, params } = new PgDialect().sqlToQuery(archiveSitemapIndexableSql());
    expect(sql).toContain(`"first_seen_at" > now() - interval '${FRESH_STORY_HOURS} hours'`);
    expect(sql).toContain(`"source_count" >= 2`);
    expect(sql).toMatch(/jsonb_array_length\("[a-z_".]*history"\) > 0/);
    // A pure predicate — no bound parameters, so it is safe to compose.
    expect(params).toEqual([]);
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
    expect(briefingMetaTitle("August 21, 2026")).toBe("US & Canada News Briefing — August 21, 2026");
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
