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
  STORY_HISTORY_LIMIT,
  appendStoryHistory,
  diffStoryForHistory,
  type StoryUpdateEvent,
  type StoryUpdateSnapshot,
} from "@/lib/news/story-updates";
import {
  archiveDataset,
  ensureArchiveSchema,
  findEarlierCoverage,
  getStoryHistory,
} from "@/lib/database/archive";
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
});

describe("findEarlierCoverage", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
  });

  const dbRow = {
    clusterId: "clearlier01",
    slug: "earlier-take-clearlier01",
    title: "Earlier take on the rail bill",
    lastPublishedAt: new Date("2026-08-10T09:00:00.000Z"),
    sourceCount: 3,
  };

  function coverageDb(rows: unknown[]) {
    return {
      execute: vi.fn(async () => ({ rows: [{ ok: 1 }] })),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async (n: number) => rows.slice(0, n) }),
          }),
        }),
      })),
    };
  }

  it("returns [] without a database", async () => {
    await expect(findEarlierCoverage(["Senate"], "cl4b2n8x1")).resolves.toEqual([]);
  });

  it("returns [] without querying when no usable entities are given", async () => {
    const db = coverageDb([dbRow]);
    getDbMock.mockReturnValue(db);
    await expect(findEarlierCoverage([], "cl4b2n8x1")).resolves.toEqual([]);
    await expect(findEarlierCoverage(["", ""], "cl4b2n8x1")).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("maps rows to items with ISO timestamps", async () => {
    getDbMock.mockReturnValue(coverageDb([dbRow]));
    await expect(findEarlierCoverage(["Senate"], "cl4b2n8x1")).resolves.toEqual([
      {
        clusterId: "clearlier01",
        slug: "earlier-take-clearlier01",
        title: "Earlier take on the rail bill",
        lastPublishedAt: "2026-08-10T09:00:00.000Z",
        sourceCount: 3,
      },
    ]);
  });

  it("defaults to at most 5 items", async () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      ...dbRow,
      clusterId: `clearlier0${i}`,
      slug: `earlier-${i}-clearlier0${i}`,
    }));
    getDbMock.mockReturnValue(coverageDb(rows));
    await expect(findEarlierCoverage(["Senate"], "cl4b2n8x1")).resolves.toHaveLength(5);
  });

  it("still queries when the schema migration failed (entities predate it)", async () => {
    const db = coverageDb([dbRow]);
    db.execute.mockRejectedValue(new Error("permission denied"));
    getDbMock.mockReturnValue(db);
    await expect(findEarlierCoverage(["Senate"], "cl4b2n8x1")).resolves.toHaveLength(1);
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
    await expect(findEarlierCoverage(["Senate"], "cl4b2n8x1")).resolves.toEqual([]);
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
});
