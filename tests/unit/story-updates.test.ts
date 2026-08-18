import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

// Mocked db layer — these tests never require a real Postgres. getDb is
// swapped per-test: null (unconfigured) or a minimal chainable fake.
const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import {
  DISPLAY_UPDATE_LIMIT,
  STORY_HISTORY_LIMIT,
  appendStoryHistory,
  diffStoryForHistory,
  displayableUpdates,
  type StoryUpdateEvent,
  type StoryUpdateSnapshot,
} from "@/lib/news/story-updates";
import {
  archiveDataset,
  ensureArchiveSchema,
  findEarlierCoverage,
  getStoryArchiveExtras,
  getStoryHistory,
} from "@/lib/database/archive";
import type { ArchivedSourceRef } from "@/lib/database/schema";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

const NOW = new Date("2026-08-15T12:00:00.000Z");
const VERSION = "20260815T120000Z-test01";
const AT = NOW.toISOString();

function snap(overrides: Partial<StoryUpdateSnapshot> = {}): StoryUpdateSnapshot {
  return {
    title: "Senate passes bipartisan rail safety bill",
    sourceCount: 2,
    category: "politics",
    sourceNames: ["Example Wire", "Northern Post"],
    ...overrides,
  };
}

function sourceEvent(source: string): StoryUpdateEvent {
  return { kind: "source_added", at: AT, version: VERSION, source };
}

describe("diffStoryForHistory", () => {
  it("returns no events for a story never archived before", () => {
    expect(diffStoryForHistory(null, snap(), VERSION, AT)).toEqual([]);
  });

  it("returns no events when nothing changed", () => {
    expect(diffStoryForHistory(snap(), snap(), VERSION, AT)).toEqual([]);
  });

  it("emits headline_updated with from/to and the snapshot stamp", () => {
    const events = diffStoryForHistory(
      snap({ title: "Old headline" }),
      snap(),
      VERSION,
      AT,
    );
    expect(events).toEqual([
      {
        kind: "headline_updated",
        at: AT,
        version: VERSION,
        from: "Old headline",
        to: "Senate passes bipartisan rail safety bill",
      },
    ]);
  });

  it("emits source_added per newly appearing source, in next order", () => {
    const events = diffStoryForHistory(
      snap({ sourceNames: ["Example Wire"] }),
      snap({ sourceNames: ["Example Wire", "Northern Post", "Third Wire"] }),
      VERSION,
      AT,
    );
    expect(events).toEqual([
      { kind: "source_added", at: AT, version: VERSION, source: "Northern Post" },
      { kind: "source_added", at: AT, version: VERSION, source: "Third Wire" },
    ]);
  });

  it("emits a duplicated new source name only once", () => {
    const events = diffStoryForHistory(
      snap({ sourceNames: ["Example Wire"] }),
      snap({ sourceNames: ["Example Wire", "Northern Post", "Northern Post"] }),
      VERSION,
      AT,
    );
    expect(events).toEqual([
      { kind: "source_added", at: AT, version: VERSION, source: "Northern Post" },
    ]);
  });

  it("emits no event for a source that disappeared", () => {
    const events = diffStoryForHistory(
      snap({ sourceNames: ["Example Wire", "Northern Post"] }),
      snap({ sourceNames: ["Example Wire"] }),
      VERSION,
      AT,
    );
    expect(events).toEqual([]);
  });

  it("emits coverage_change when the source count moved", () => {
    const events = diffStoryForHistory(snap({ sourceCount: 1 }), snap(), VERSION, AT);
    expect(events).toEqual([
      { kind: "coverage_change", at: AT, version: VERSION, from: 1, to: 2 },
    ]);
  });

  it("emits category_changed when the category moved", () => {
    const events = diffStoryForHistory(snap({ category: "world" }), snap(), VERSION, AT);
    expect(events).toEqual([
      { kind: "category_changed", at: AT, version: VERSION, from: "world", to: "politics" },
    ]);
  });

  it("orders combined changes stably: headline, sources, coverage, category", () => {
    const events = diffStoryForHistory(
      snap({
        title: "Old headline",
        sourceCount: 1,
        category: "world",
        sourceNames: ["Example Wire"],
      }),
      snap(),
      VERSION,
      AT,
    );
    expect(events.map((e) => e.kind)).toEqual([
      "headline_updated",
      "source_added",
      "coverage_change",
      "category_changed",
    ]);
    // Every event carries the snapshot stamp.
    for (const e of events) {
      expect(e.at).toBe(AT);
      expect(e.version).toBe(VERSION);
    }
  });

  it("is deterministic for identical inputs", () => {
    const previous = snap({ title: "Old", sourceNames: [] });
    expect(diffStoryForHistory(previous, snap(), VERSION, AT)).toEqual(
      diffStoryForHistory(previous, snap(), VERSION, AT),
    );
  });
});

describe("appendStoryHistory", () => {
  const older: StoryUpdateEvent = {
    kind: "coverage_change",
    at: AT,
    version: VERSION,
    from: 1,
    to: 2,
  };

  it("appends new events after the stored ones (oldest-to-newest)", () => {
    const added = sourceEvent("Northern Post");
    expect(appendStoryHistory([older], [added])).toEqual([older, added]);
  });

  it("returns the stored history unchanged when nothing was appended", () => {
    expect(appendStoryHistory([older], [])).toEqual([older]);
  });

  it("caps at STORY_HISTORY_LIMIT by dropping the oldest entries", () => {
    const stored = Array.from({ length: STORY_HISTORY_LIMIT }, (_, i) =>
      sourceEvent(`Source ${i}`),
    );
    const fresh = [sourceEvent("Newest A"), sourceEvent("Newest B")];
    const capped = appendStoryHistory(stored, fresh);
    expect(capped).toHaveLength(STORY_HISTORY_LIMIT);
    // The two oldest fell off; the newest are at the tail.
    expect(capped[0]).toEqual(stored[2]);
    expect(capped.slice(-2)).toEqual(fresh);
  });

  it("honors a custom limit", () => {
    const stored = [sourceEvent("A"), sourceEvent("B")];
    const capped = appendStoryHistory(stored, [sourceEvent("C")], 2);
    expect(capped.map((e) => (e.kind === "source_added" ? e.source : ""))).toEqual(["B", "C"]);
  });
});

describe("displayableUpdates", () => {
  // Pure DISPLAY filter: the stored history keeps everything for ops; this
  // decides what a reader sees. Live regression it guards: "Coverage went
  // from 2 to 1 / 1 to 2 / 2 to 1 sources" plus "Reclassified from world to
  // politics / politics to world / world to politics" within one hour.
  const T0 = "2026-08-18T00:00:00.000Z";
  function atOffset(hours: number): string {
    return new Date(Date.parse(T0) + hours * 3_600_000).toISOString();
  }
  function coverage(from: number, to: number, at: string): StoryUpdateEvent {
    return { kind: "coverage_change", at, version: VERSION, from, to };
  }
  function reclass(from: string, to: string, at: string): StoryUpdateEvent {
    return { kind: "category_changed", at, version: VERSION, from, to };
  }
  function joined(source: string, at: string): StoryUpdateEvent {
    return { kind: "source_added", at, version: VERSION, source };
  }

  it("returns an empty history unchanged", () => {
    expect(displayableUpdates([])).toEqual([]);
  });

  it("drops a coverage pair that nets to zero within 24h", () => {
    expect(
      displayableUpdates([coverage(2, 1, atOffset(0)), coverage(1, 2, atOffset(1))]),
    ).toEqual([]);
  });

  it("collapses the live oscillation chain to its net movement", () => {
    // 2→1, 1→2, 2→1 inside one hour: the first pair cancels, the survivor
    // truthfully reports the net 2→1 movement.
    const events = [
      coverage(2, 1, atOffset(0)),
      coverage(1, 2, atOffset(0.5)),
      coverage(2, 1, atOffset(1)),
    ];
    expect(displayableUpdates(events)).toEqual([coverage(2, 1, atOffset(1))]);
  });

  it("keeps genuine growth", () => {
    const events = [coverage(1, 2, atOffset(0)), coverage(2, 4, atOffset(2))];
    expect(displayableUpdates(events)).toEqual(events);
  });

  it("keeps growth that follows cancelled churn", () => {
    const events = [
      coverage(1, 2, atOffset(0)),
      coverage(2, 1, atOffset(1)),
      coverage(1, 2, atOffset(2)),
    ];
    expect(displayableUpdates(events)).toEqual([coverage(1, 2, atOffset(2))]);
  });

  it("does not pair a shrink with non-mirror growth", () => {
    // 4→2 then 2→3 does not return to the starting count — both are real.
    const events = [coverage(4, 2, atOffset(0)), coverage(2, 3, atOffset(1))];
    expect(displayableUpdates(events)).toEqual(events);
  });

  it("keeps a reversal slower than the 24h window", () => {
    // A story genuinely losing coverage and regaining it a day later is
    // news, not feed rotation.
    const events = [coverage(2, 1, atOffset(0)), coverage(1, 2, atOffset(25))];
    expect(displayableUpdates(events)).toEqual(events);
  });

  it("cancels churn across intervening non-coverage events", () => {
    const kept = joined("Northern Post", atOffset(0.5));
    const events = [coverage(1, 2, atOffset(0)), kept, coverage(2, 1, atOffset(1))];
    expect(displayableUpdates(events)).toEqual([kept]);
  });

  it("hides category_changed from public display entirely", () => {
    // Reclassification stays in the STORED history for ops; the reader
    // never sees a world → politics → world flap.
    const events = [
      reclass("world", "politics", atOffset(0)),
      joined("Northern Post", atOffset(1)),
      reclass("politics", "world", atOffset(2)),
    ];
    expect(displayableUpdates(events)).toEqual([joined("Northern Post", atOffset(1))]);
  });

  it("caps at the most recent survivors", () => {
    const events = Array.from({ length: DISPLAY_UPDATE_LIMIT + 3 }, (_, i) =>
      joined(`Source ${i}`, atOffset(i)),
    );
    const visible = displayableUpdates(events);
    expect(visible).toHaveLength(DISPLAY_UPDATE_LIMIT);
    expect(visible).toEqual(events.slice(3));
  });

  it("returns survivors oldest-to-newest even from unsorted input", () => {
    const a = joined("A", atOffset(0));
    const b = joined("B", atOffset(1));
    const c = joined("C", atOffset(2));
    expect(displayableUpdates([c, a, b])).toEqual([a, b, c]);
  });

  it("preserves stored order for events stamped with the same time", () => {
    // A refresh stamps its whole batch with one `at`.
    const batch = [joined("A", T0), joined("B", T0), coverage(1, 3, T0)];
    expect(displayableUpdates(batch)).toEqual(batch);
  });
});

describe("ensureArchiveSchema", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
  });

  it("resolves false without a database", async () => {
    await expect(ensureArchiveSchema()).resolves.toBe(false);
  });

  it("skips DDL when column and index already exist, and memoizes per db", async () => {
    const execute = vi.fn(async () => ({ rows: [{ ok: 1 }] }));
    getDbMock.mockReturnValue({ execute });
    await expect(ensureArchiveSchema()).resolves.toBe(true);
    // One existence check for the column, one for the index — no DDL.
    expect(execute).toHaveBeenCalledTimes(2);
    await expect(ensureArchiveSchema()).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("issues the ALTER and CREATE INDEX when the checks find nothing", async () => {
    const execute = vi.fn(async () => ({ rows: [] }));
    getDbMock.mockReturnValue({ execute });
    await expect(ensureArchiveSchema()).resolves.toBe(true);
    // check + alter + check + create index.
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("resolves false on failure and stays disabled for that db", async () => {
    const execute = vi.fn(async () => {
      throw new Error("permission denied");
    });
    getDbMock.mockReturnValue({ execute });
    await expect(ensureArchiveSchema()).resolves.toBe(false);
    await expect(ensureArchiveSchema()).resolves.toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("getStoryHistory", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
  });

  function historyReadDb(result: unknown[]) {
    return {
      execute: vi.fn(async () => ({ rows: [{ ok: 1 }] })),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({ limit: async () => result }),
        }),
      })),
    };
  }

  it("returns [] without a database", async () => {
    await expect(getStoryHistory("cl4b2n8x1")).resolves.toEqual([]);
  });

  it("returns the stored events exactly as stored", async () => {
    const stored: StoryUpdateEvent[] = [
      { kind: "source_added", at: AT, version: VERSION, source: "Northern Post" },
      { kind: "coverage_change", at: AT, version: VERSION, from: 1, to: 2 },
    ];
    getDbMock.mockReturnValue(historyReadDb([{ history: stored }]));
    await expect(getStoryHistory("cl4b2n8x1")).resolves.toEqual(stored);
  });

  it("returns [] for an unknown cluster or malformed jsonb", async () => {
    getDbMock.mockReturnValue(historyReadDb([]));
    await expect(getStoryHistory("clunknown0")).resolves.toEqual([]);
    getDbMock.mockReturnValue(historyReadDb([{ history: "corrupt" }]));
    await expect(getStoryHistory("cl4b2n8x1")).resolves.toEqual([]);
  });

  it("returns [] without querying when the schema migration failed", async () => {
    const db = historyReadDb([{ history: [] }]);
    db.execute.mockRejectedValue(new Error("permission denied"));
    getDbMock.mockReturnValue(db);
    await expect(getStoryHistory("cl4b2n8x1")).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("swallows query failures", async () => {
    getDbMock.mockReturnValue({
      execute: async () => ({ rows: [{ ok: 1 }] }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.reject(new Error("timeout")) }),
        }),
      }),
    });
    await expect(getStoryHistory("cl4b2n8x1")).resolves.toEqual([]);
  });

  it("reads the history and the all-time source union in ONE query", async () => {
    const stored: StoryUpdateEvent[] = [
      { kind: "source_added", at: AT, version: VERSION, source: "Northern Post" },
    ];
    const sources: ArchivedSourceRef[] = [
      {
        name: "Example Wire",
        domain: "example-wire.com",
        tier: "A",
        url: "https://example-wire.com/rail-safety",
        publishedAt: "2026-08-15T08:00:00.000Z",
        title: "Senate passes bipartisan rail safety bill",
        firstSeenAt: AT,
        lastSeenAt: AT,
      },
    ];
    const db = historyReadDb([{ history: stored, sources }]);
    getDbMock.mockReturnValue(db);
    await expect(getStoryArchiveExtras("cl4b2n8x1")).resolves.toEqual({
      history: stored,
      sources,
    });
    // Neon free tier: the page must not pay a second round-trip for this.
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("returns empty history and sources for unknown ids or malformed jsonb", async () => {
    getDbMock.mockReturnValue(historyReadDb([]));
    await expect(getStoryArchiveExtras("clunknown0")).resolves.toEqual({
      history: [],
      sources: [],
    });
    getDbMock.mockReturnValue(historyReadDb([{ history: "corrupt", sources: "corrupt" }]));
    await expect(getStoryArchiveExtras("cl4b2n8x1")).resolves.toEqual({
      history: [],
      sources: [],
    });
  });
});

describe("findEarlierCoverage", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
  });

  const dialect = new PgDialect();

  const story = {
    id: "cl4b2n8x1",
    title: "Senate passes bipartisan rail safety bill",
    entities: ["United States", "Rail Safety"],
    firstPublishedAt: "2026-08-15T08:00:00.000Z",
  };

  const dbRow = {
    clusterId: "clearlier01",
    slug: "earlier-take-clearlier01",
    title: "Rail safety bill clears committee",
    lastPublishedAt: new Date("2026-08-10T09:00:00.000Z"),
    sourceCount: 3,
    entities: ["United States", "Rail Safety"],
  };

  /** The live regression: overlap on "United States" and nothing else. */
  const junkRow = {
    clusterId: "cljunk0001",
    slug: "brixton-metals-cljunk0001",
    title: "Brixton Metals Announces Closing of First Tranche of Private Placement",
    lastPublishedAt: new Date("2026-08-14T23:00:00.000Z"),
    sourceCount: 1,
    entities: ["United States", "Private Placement"],
  };

  function coverageDb(rows: unknown[], captured: { where?: SQL } = {}) {
    return {
      execute: vi.fn(async () => ({ rows: [{ ok: 1 }] })),
      select: vi.fn(() => ({
        from: () => ({
          where: (condition: SQL) => {
            captured.where = condition;
            return {
              orderBy: () => ({ limit: async (n: number) => rows.slice(0, n) }),
            };
          },
        }),
      })),
    };
  }

  it("returns [] without a database", async () => {
    await expect(findEarlierCoverage(story)).resolves.toEqual([]);
  });

  it("returns [] without querying when the story has no specific entities", async () => {
    const db = coverageDb([dbRow]);
    getDbMock.mockReturnValue(db);
    // The live missionary story: one generic country plus nothing usable.
    await expect(
      findEarlierCoverage({ ...story, entities: ["United States"] }),
    ).resolves.toEqual([]);
    await expect(findEarlierCoverage({ ...story, entities: [] })).resolves.toEqual([]);
    await expect(findEarlierCoverage({ ...story, entities: ["", " "] })).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("prefilters on specific entities only, and on strictly earlier stories", async () => {
    const captured: { where?: SQL } = {};
    getDbMock.mockReturnValue(coverageDb([dbRow], captured));
    await findEarlierCoverage(story);
    const query = dialect.sqlToQuery(captured.where as SQL);
    expect(query.params).toContain("Rail Safety");
    // "United States" would match ~13% of the archive — never in the filter.
    expect(query.params).not.toContain("United States");
    // Earlier means earlier: bounded by this story's first coverage.
    expect(query.params).toContain(story.firstPublishedAt);
    expect(query.sql).toContain("last_published_at");
  });

  it("maps surviving rows to items with ISO timestamps", async () => {
    getDbMock.mockReturnValue(coverageDb([dbRow]));
    await expect(findEarlierCoverage(story)).resolves.toEqual([
      {
        clusterId: "clearlier01",
        slug: "earlier-take-clearlier01",
        title: "Rail safety bill clears committee",
        lastPublishedAt: "2026-08-10T09:00:00.000Z",
        sourceCount: 3,
      },
    ]);
  });

  it("drops candidates that share only a generic entity", async () => {
    // The junk row is the NEWEST candidate: pure recency would rank it first.
    getDbMock.mockReturnValue(coverageDb([junkRow, dbRow]));
    await expect(findEarlierCoverage(story)).resolves.toEqual([
      expect.objectContaining({ clusterId: "clearlier01" }),
    ]);
  });

  it("returns [] when every candidate fails the relevance gate", async () => {
    getDbMock.mockReturnValue(coverageDb([junkRow]));
    await expect(findEarlierCoverage(story)).resolves.toEqual([]);
  });

  it("ranks by relatedness first and recency second", async () => {
    const weaker = {
      ...dbRow,
      clusterId: "clweaker01",
      slug: "weaker-clweaker01",
      // One shared specific entity plus a thinner headline overlap.
      title: "Rail safety review ordered by regulator",
      lastPublishedAt: new Date("2026-08-14T09:00:00.000Z"),
    };
    const stronger = {
      ...dbRow,
      clusterId: "clstrong01",
      slug: "stronger-clstrong01",
      entities: ["Rail Safety", "Senate"],
      title: "Senate advances bipartisan rail safety bill",
      lastPublishedAt: new Date("2026-08-09T09:00:00.000Z"),
    };
    getDbMock.mockReturnValue(coverageDb([weaker, stronger]));
    const items = await findEarlierCoverage({ ...story, entities: ["Rail Safety", "Senate"] });
    expect(items.map((i) => i.clusterId)).toEqual(["clstrong01", "clweaker01"]);
  });

  it("defaults to at most 5 items", async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      ...dbRow,
      clusterId: `clearlier0${i}`,
      slug: `earlier-${i}-clearlier0${i}`,
    }));
    getDbMock.mockReturnValue(coverageDb(rows));
    await expect(findEarlierCoverage(story)).resolves.toHaveLength(5);
  });

  it("still queries when the schema migration failed (entities predate it)", async () => {
    const db = coverageDb([dbRow]);
    db.execute.mockRejectedValue(new Error("permission denied"));
    getDbMock.mockReturnValue(db);
    await expect(findEarlierCoverage(story)).resolves.toHaveLength(1);
  });

  it("swallows query failures", async () => {
    getDbMock.mockReturnValue({
      execute: async () => ({ rows: [{ ok: 1 }] }),
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.reject(new Error("timeout")) }),
          }),
        }),
      }),
    });
    await expect(findEarlierCoverage(story)).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// archiveDataset history integration (mocked db, same pattern as the
// story-archive suite).
// ---------------------------------------------------------------------------

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
    publishedAt: "2026-08-15T08:00:00.000Z",
    country: "US",
    category: "politics",
    categories: ["politics"],
    entities: ["Senate"],
    provider: "rss",
    isMock: false,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<StoryCluster> = {}): StoryCluster {
  const lead = makeArticle();
  const second = makeArticle({
    id: "a2",
    source: "Northern Post",
    sourceSlug: "northern-post",
    sourceDomain: "northernpost.example",
    sourceTier: "B",
    url: "https://northernpost.example/rail-bill",
    canonicalUrl: "https://northernpost.example/rail-bill",
    title: "Rail safety bill clears the Senate",
    publishedAt: "2026-08-15T09:30:00.000Z",
  });
  return {
    id: "cl4b2n8x1",
    slug: "senate-passes-rail-safety-bill-cl4b2n8x1",
    title: "Senate passes bipartisan rail safety bill",
    summary: "The measure now heads to the House.",
    category: "politics",
    country: "US",
    contentType: "news",
    imageUrl: "https://example-wire.com/rail.jpg",
    articles: [lead, second],
    lead,
    sourceCount: 2,
    sourceNames: ["Example Wire", "Northern Post"],
    entities: ["Senate", "Rail Safety"],
    firstPublishedAt: "2026-08-15T08:00:00.000Z",
    lastPublishedAt: "2026-08-15T09:30:00.000Z",
    rankingScore: 72.5,
    rankingBreakdown: {
      freshness: 30, authority: 15, coverage: 12, geography: 8,
      prominence: 5, velocity: 2.5, total: 72.5,
    },
    status: "developing",
    isBreaking: false,
    isMock: false,
    ...overrides,
  };
}

function makeDataset(clusters: StoryCluster[]): NewsDataset {
  return {
    articles: [],
    clusters,
    trending: [],
    generatedAt: AT,
    datasetVersion: VERSION,
    dataMode: "live",
    ingestion: {} as NewsDataset["ingestion"],
  };
}

describe("archiveDataset story history (mocked db)", () => {
  interface UpsertCall {
    rows: Record<string, unknown>[];
    config: { set: Record<string, unknown>; setWhere?: unknown };
  }
  const upserts: UpsertCall[] = [];
  const dialect = new PgDialect();

  /**
   * Fake db: execute answers the schema checks, select answers from a FIFO
   * queue (history lookup first, then the merge scan), insert records the
   * upserts. Queue entries are thunks so individual calls can reject.
   */
  function fakeDb(options: {
    execute?: () => Promise<{ rows: unknown[] }>;
    selectResults?: Array<() => Promise<unknown[]>>;
  } = {}) {
    const queue = [...(options.selectResults ?? [])];
    return {
      execute: options.execute ?? (async () => ({ rows: [{ ok: 1 }] })),
      select: () => ({
        from: () => ({
          where: () => (queue.shift() ?? (async () => []))(),
        }),
      }),
      insert: () => ({
        values: (rows: Record<string, unknown>[]) => ({
          onConflictDoUpdate: (config: UpsertCall["config"]) => {
            upserts.push({ rows, config });
            return Promise.resolve();
          },
        }),
      }),
    };
  }

  function renderedSetWhere(call: UpsertCall): string {
    return dialect.sqlToQuery(call.config.setWhere as SQL).sql;
  }

  const priorEvent: StoryUpdateEvent = {
    kind: "coverage_change",
    at: "2026-08-14T10:00:00.000Z",
    version: "20260814T100000Z-prev01",
    from: 1,
    to: 2,
  };

  const previousRow = {
    clusterId: "cl4b2n8x1",
    title: "Old headline",
    sourceCount: 1,
    category: "world",
    sources: [
      {
        name: "Example Wire",
        domain: "example-wire.com",
        tier: "A",
        url: "https://example-wire.com/rail-safety",
        publishedAt: "2026-08-14T08:00:00.000Z",
        title: "Old headline",
      },
    ],
    history: [priorEvent],
  };

  beforeEach(() => {
    upserts.length = 0;
    getDbMock.mockReturnValue(null);
  });

  it("appends diffed events to the previous history and upserts them", async () => {
    getDbMock.mockReturnValue(
      fakeDb({ selectResults: [async () => [previousRow]] }),
    );
    await expect(archiveDataset(makeDataset([makeCluster()]))).resolves.toBe(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].rows[0].history).toEqual([
      priorEvent,
      {
        kind: "headline_updated",
        at: AT,
        version: VERSION,
        from: "Old headline",
        to: "Senate passes bipartisan rail safety bill",
      },
      { kind: "source_added", at: AT, version: VERSION, source: "Northern Post" },
      { kind: "coverage_change", at: AT, version: VERSION, from: 1, to: 2 },
      { kind: "category_changed", at: AT, version: VERSION, from: "world", to: "politics" },
    ]);
    expect(Object.keys(upserts[0].config.set)).toContain("history");
  });

  it("gives brand-new stories an empty history (no synthetic events)", async () => {
    getDbMock.mockReturnValue(fakeDb({ selectResults: [async () => []] }));
    await archiveDataset(makeDataset([makeCluster()]));
    expect(upserts[0].rows[0].history).toEqual([]);
  });

  it("carries an unchanged story's history through the upsert untouched", async () => {
    const unchanged = {
      ...previousRow,
      title: "Senate passes bipartisan rail safety bill",
      sourceCount: 2,
      category: "politics",
      sources: [
        ...previousRow.sources,
        {
          name: "Northern Post",
          domain: "northernpost.example",
          tier: "B",
          url: "https://northernpost.example/rail-bill",
          publishedAt: "2026-08-14T09:30:00.000Z",
          title: "Rail safety bill clears the Senate",
        },
      ],
    };
    getDbMock.mockReturnValue(fakeDb({ selectResults: [async () => [unchanged]] }));
    await archiveDataset(makeDataset([makeCluster()]));
    expect(upserts[0].rows[0].history).toEqual([priorEvent]);
  });

  it("updates rows on label-only changes: setWhere covers category, geography, content_type and history", async () => {
    getDbMock.mockReturnValue(
      fakeDb({ selectResults: [async () => [previousRow]] }),
    );
    await archiveDataset(makeDataset([makeCluster()]));
    const where = renderedSetWhere(upserts[0]);
    expect(where).toContain("excluded.category");
    expect(where).toContain("excluded.geography");
    expect(where).toContain("excluded.content_type");
    expect(where).toContain("excluded.history");
  });

  it("archives without history when the schema migration failed", async () => {
    getDbMock.mockReturnValue(
      fakeDb({
        execute: () => Promise.reject(new Error("permission denied")),
        selectResults: [async () => [previousRow]],
      }),
    );
    await expect(archiveDataset(makeDataset([makeCluster()]))).resolves.toBe(1);
    expect(upserts).toHaveLength(1);
    expect("history" in upserts[0].rows[0]).toBe(false);
    expect(Object.keys(upserts[0].config.set)).not.toContain("history");
    const where = renderedSetWhere(upserts[0]);
    // Label columns exist since the table shipped — always in the predicate.
    expect(where).toContain("excluded.category");
    expect(where).not.toContain("excluded.history");
  });

  it("archives without history when the diff lookup fails", async () => {
    getDbMock.mockReturnValue(
      fakeDb({
        selectResults: [() => Promise.reject(new Error("timeout"))],
      }),
    );
    await expect(archiveDataset(makeDataset([makeCluster()]))).resolves.toBe(1);
    expect(upserts).toHaveLength(1);
    expect("history" in upserts[0].rows[0]).toBe(false);
    expect(Object.keys(upserts[0].config.set)).not.toContain("history");
  });

  // -------------------------------------------------------------------------
  // Permanent source union: feed rotation drops sources from the ACTIVE list
  // within hours (live: 4 sources → 2 in 2.5h), but the archived record of
  // who covered the story must only ever grow.
  // -------------------------------------------------------------------------

  const cbsRef: ArchivedSourceRef = {
    name: "CBS News",
    domain: "cbsnews.example",
    tier: "A",
    url: "https://cbsnews.example/rail-bill",
    publishedAt: "2026-08-14T07:00:00.000Z",
    title: "Rail safety bill advances",
    firstSeenAt: "2026-08-14T07:30:00.000Z",
    lastSeenAt: "2026-08-14T10:00:00.000Z",
  };

  it("unions rotated-out sources with the active ones and stamps first/last seen", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      getDbMock.mockReturnValue(
        fakeDb({
          selectResults: [
            async () => [{ ...previousRow, sources: [...previousRow.sources, cbsRef] }],
          ],
        }),
      );
      await archiveDataset(makeDataset([makeCluster()]));
      expect(upserts[0].rows[0].sources).toEqual([
        {
          name: "Example Wire",
          domain: "example-wire.com",
          tier: "A",
          url: "https://example-wire.com/rail-safety",
          publishedAt: "2026-08-15T08:00:00.000Z",
          title: "Senate passes bipartisan rail safety bill",
          // No stored stamp (row predates the union) → stamped now.
          firstSeenAt: AT,
          lastSeenAt: AT,
        },
        {
          name: "Northern Post",
          domain: "northernpost.example",
          tier: "B",
          url: "https://northernpost.example/rail-bill",
          publishedAt: "2026-08-15T09:30:00.000Z",
          title: "Rail safety bill clears the Senate",
          firstSeenAt: AT,
          lastSeenAt: AT,
        },
        // Rotated out of the feeds: kept verbatim, stamps untouched.
        cbsRef,
      ]);
      expect(Object.keys(upserts[0].config.set)).toContain("sources");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a stored firstSeenAt when the source is active again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const stamped = {
        ...previousRow,
        sources: [{ ...previousRow.sources[0], firstSeenAt: "2026-08-01T00:00:00.000Z" }],
      };
      getDbMock.mockReturnValue(fakeDb({ selectResults: [async () => [stamped]] }));
      await archiveDataset(makeDataset([makeCluster()]));
      const written = upserts[0].rows[0].sources as ArchivedSourceRef[];
      expect(written[0].firstSeenAt).toBe("2026-08-01T00:00:00.000Z");
      expect(written[0].lastSeenAt).toBe(AT);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never re-emits source_added for a source that rotated out and returned", async () => {
    // Stored: both sources in the union, but only one was active last time.
    const rotated = {
      clusterId: "cl4b2n8x1",
      title: "Senate passes bipartisan rail safety bill",
      sourceCount: 1,
      category: "politics",
      sources: [
        previousRow.sources[0],
        {
          name: "Northern Post",
          domain: "northernpost.example",
          tier: "B",
          url: "https://northernpost.example/rail-bill",
          publishedAt: "2026-08-15T09:30:00.000Z",
          title: "Rail safety bill clears the Senate",
        },
      ],
      history: [],
    };
    getDbMock.mockReturnValue(fakeDb({ selectResults: [async () => [rotated]] }));
    await archiveDataset(makeDataset([makeCluster()]));
    // Union-derived source names suppress the duplicate join event, while
    // coverage_change still compares the ACTIVE counts.
    expect(upserts[0].rows[0].history).toEqual([
      { kind: "coverage_change", at: AT, version: VERSION, from: 1, to: 2 },
    ]);
  });

  it("writes the union when it grew even if nothing else about the story moved", async () => {
    getDbMock.mockReturnValue(
      fakeDb({ selectResults: [async () => [previousRow]] }),
    );
    await archiveDataset(makeDataset([makeCluster()]));
    // Length, not equality: lastSeenAt is re-stamped every refresh and must
    // not make every row dirty on every run.
    expect(renderedSetWhere(upserts[0])).toContain("jsonb_array_length");
  });

  it("omits the sources column when the previous rows could not be read", async () => {
    getDbMock.mockReturnValue(
      fakeDb({ selectResults: [() => Promise.reject(new Error("timeout"))] }),
    );
    await archiveDataset(makeDataset([makeCluster()]));
    // Fail-safe: a stored union must never be overwritten by the (possibly
    // shrunken) active list.
    expect(Object.keys(upserts[0].config.set)).not.toContain("sources");
    expect(renderedSetWhere(upserts[0])).not.toContain("jsonb_array_length");
  });
});
