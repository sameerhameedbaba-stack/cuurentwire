import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";

// Mocked db layer — these tests never require a real Postgres. getDb is
// swapped per-test: null (unconfigured) or a minimal chainable fake.
const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import { describeDbError } from "@/lib/database/errors";
import { persistDataset } from "@/lib/database/persist";
import { logger } from "@/lib/utils/logger";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "aaaaaaaaaaa1",
    slug: "senate-passes-rail-safety-bill-aaaaaaaaaaa1",
    title: "Senate passes bipartisan rail safety bill",
    url: "https://example-wire.com/rail-safety",
    canonicalUrl: "https://example-wire.com/rail-safety",
    source: "Example Wire",
    sourceSlug: "example-wire",
    sourceDomain: "example-wire.com",
    sourceTier: "A",
    publishedAt: "2026-08-14T08:00:00.000Z",
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
  const lead = overrides.lead ?? makeArticle();
  return {
    id: "caaaaaaaaaaa1",
    slug: "senate-passes-rail-safety-bill-caaaaaaaaaaa1",
    title: "Senate passes bipartisan rail safety bill",
    summary: "The measure now heads to the House.",
    category: "politics",
    country: "US",
    contentType: "news",
    articles: [lead],
    lead,
    sourceCount: 1,
    sourceNames: [lead.source],
    entities: ["Senate"],
    firstPublishedAt: "2026-08-14T08:00:00.000Z",
    lastPublishedAt: "2026-08-14T09:30:00.000Z",
    rankingScore: 60,
    rankingBreakdown: {
      freshness: 30, authority: 15, coverage: 5,
      geography: 5, prominence: 5, velocity: 0, total: 60,
    },
    status: null,
    isBreaking: false,
    isMock: false,
    ...overrides,
  };
}

function makeDataset(
  clusters: StoryCluster[],
  articles: Article[] = clusters.map((c) => c.lead),
): NewsDataset {
  return {
    articles,
    clusters,
    trending: [],
    generatedAt: "2026-08-14T10:00:00.000Z",
    datasetVersion: "20260814T100000Z-abc123",
    dataMode: "live",
    ingestion: {
      startedAt: "2026-08-14T10:00:00.000Z",
      finishedAt: "2026-08-14T10:00:02.000Z",
      durationMs: 2000,
      providers: [],
      articlesReceived: articles.length,
      articlesAccepted: articles.length,
      articlesRejected: 0,
      duplicatesRemoved: 0,
      clusterCount: clusters.length,
      articleAgeAtIngestMedianMs: 0,
      articleAgeAtIngestP90Ms: 0,
      highestRankingScore: 60,
      breakingCount: 0,
      nearBreakingCount: 0,
      classificationWarnings: 0,
      classificationWarningSamples: [],
    },
  } as unknown as NewsDataset;
}

interface InsertCall {
  table: string;
  rows: Record<string, unknown>[];
  conflict: "update" | "nothing" | "plain";
}

describe("persistDataset (mocked db)", () => {
  const inserts: InsertCall[] = [];
  const deletes: string[] = [];

  function fakeDb(failOnTable?: string, failWith?: unknown) {
    return {
      insert: (table: unknown) => ({
        values: (rowsIn: unknown) => {
          const rows = (Array.isArray(rowsIn) ? rowsIn : [rowsIn]) as InsertCall["rows"];
          const name = getTableName(table as Parameters<typeof getTableName>[0]);
          const settle = (conflict: InsertCall["conflict"]) => {
            inserts.push({ table: name, rows, conflict });
            return name === failOnTable
              ? Promise.reject(failWith ?? new Error("boom"))
              : Promise.resolve();
          };
          return {
            onConflictDoUpdate: () => settle("update"),
            onConflictDoNothing: () => settle("nothing"),
            // ingestion_runs / ranking_snapshots inserts are awaited bare.
            then: (
              onOk: (v: unknown) => unknown,
              onErr: (e: unknown) => unknown,
            ) => settle("plain").then(onOk, onErr),
          };
        },
      }),
      delete: (table: unknown) => ({
        where: () => {
          deletes.push(getTableName(table as Parameters<typeof getTableName>[0]));
          return Promise.resolve();
        },
      }),
    };
  }

  beforeEach(() => {
    inserts.length = 0;
    deletes.length = 0;
    getDbMock.mockReturnValue(fakeDb());
  });

  it("returns false without a configured database", async () => {
    getDbMock.mockReturnValue(null);
    await expect(persistDataset(makeDataset([makeCluster()]))).resolves.toBe(false);
  });

  it("dedupes duplicate cluster ids before the upsert (live incident regression)", async () => {
    // The 2026-08-14 incident: a split story re-minted its old cluster id, so
    // dataset.clusters carried the same id twice and the single-statement
    // ON CONFLICT DO UPDATE died with "cannot affect row a second time" on
    // every cron run. Persist must dedupe by the conflict target — keeping
    // the FIRST (higher-ranked) copy — and still succeed.
    const winner = makeCluster({
      id: "c00666c5cadf1",
      slug: "pirro-announces-arrest-c00666c5cadf1",
      rankingScore: 59.4,
    });
    const loser = makeCluster({
      id: "c00666c5cadf1",
      slug: "interior-investigating-c00666c5cadf1",
      rankingScore: 44.4,
      lead: makeArticle({
        id: "bbbbbbbbbbb2",
        canonicalUrl: "https://other.example/interior",
        url: "https://other.example/interior",
      }),
    });
    const ok = await persistDataset(makeDataset([winner, loser]));
    expect(ok).toBe(true);

    const clusterInsert = inserts.filter((c) => c.table === "story_clusters");
    expect(clusterInsert).toHaveLength(1);
    expect(clusterInsert[0].rows).toHaveLength(1);
    expect(clusterInsert[0].rows[0].slug).toBe("pirro-announces-arrest-c00666c5cadf1");

    const snapshotInsert = inserts.filter((c) => c.table === "ranking_snapshots");
    expect(snapshotInsert).toHaveLength(1);
    expect(snapshotInsert[0].rows).toHaveLength(1);
  });

  it("dedupes articles by canonical URL and id", async () => {
    const a1 = makeArticle();
    const copy = makeArticle({ id: "ccccccccccc3" }); // same canonicalUrl
    const cluster = makeCluster({ articles: [a1, copy] });
    await persistDataset(makeDataset([cluster], [a1, copy]));
    const articleInsert = inserts.filter((c) => c.table === "articles");
    expect(articleInsert).toHaveLength(1);
    expect(articleInsert[0].rows).toHaveLength(1);
    expect(articleInsert[0].rows[0].id).toBe("aaaaaaaaaaa1");
  });

  it("chunks large batches into multiple statements", async () => {
    const articles = Array.from({ length: 250 }, (_, i) =>
      makeArticle({
        id: `a${String(i).padStart(11, "0")}`,
        canonicalUrl: `https://example-wire.com/story-${i}`,
      }),
    );
    await persistDataset(makeDataset([makeCluster()], articles));
    const articleInserts = inserts.filter((c) => c.table === "articles");
    expect(articleInserts.map((c) => c.rows.length)).toEqual([100, 100, 50]);
  });

  it("caps the append-only tables after a successful persist", async () => {
    // Includes the write-only archive tables (articles, story_clusters,
    // article_cluster_members) — nothing reads them back, and uncapped they
    // alone would fill Neon's free tier in ~4 months.
    await persistDataset(makeDataset([makeCluster()]));
    expect(deletes).toEqual([
      "ranking_snapshots",
      "ingestion_runs",
      "article_cluster_members",
      "articles",
      "story_clusters",
    ]);
  });

  it("logs the compact CAUSE of a failed statement, not the SQL dump", async () => {
    const pgError = Object.assign(
      new Error("ON CONFLICT DO UPDATE command cannot affect row a second time"),
      { code: "21000" },
    );
    const wrapped = Object.assign(
      new Error(`Failed query: insert into "story_clusters" ${"x".repeat(250_000)}`),
      { cause: pgError },
    );
    getDbMock.mockReturnValue(fakeDb("story_clusters", wrapped));
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await expect(persistDataset(makeDataset([makeCluster()]))).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalledWith("database.persist_failed", {
      step: "story_clusters",
      error: expect.stringContaining("cannot affect row a second time"),
    });
    const logged = errorSpy.mock.calls[0][1] as { error: string };
    expect(logged.error).toContain("code=21000");
    expect(logged.error.length).toBeLessThanOrEqual(600);
    errorSpy.mockRestore();
  });
});

describe("describeDbError", () => {
  it("unwraps nested causes to the driver error and appends pg fields", () => {
    const pg = Object.assign(new Error("value too long for type character varying(20)"), {
      code: "22001",
      constraint: undefined,
      table: "story_clusters",
    });
    const mid = Object.assign(new Error("Failed query: insert into ..."), { cause: pg });
    const outer = Object.assign(new Error("outermost"), { cause: mid });
    const described = describeDbError(outer);
    expect(described).toContain("value too long");
    expect(described).toContain("code=22001");
    expect(described).toContain("table=story_clusters");
    expect(described).not.toContain("Failed query");
  });

  it("falls back to the error's own message and handles non-errors", () => {
    expect(describeDbError(new Error("plain failure"))).toBe("plain failure");
    expect(describeDbError("nope")).toBe("unknown");
  });

  it("truncates giant messages", () => {
    expect(describeDbError(new Error("x".repeat(10_000))).length).toBe(600);
  });
});
