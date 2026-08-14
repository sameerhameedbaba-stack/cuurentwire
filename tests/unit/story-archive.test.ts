import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked db layer — these tests never require a real Postgres. getDb is
// swapped per-test: null (unconfigured) or a minimal chainable fake.
const getDbMock = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/database/client", () => ({
  getDb: () => getDbMock(),
  isDatabaseConfigured: () => getDbMock() !== null,
}));

import {
  archiveDataset,
  archivedStoryToCluster,
  clusterToArchiveRow,
  findArchivedStory,
  getArchiveFirstSeen,
  idTokenFromSlug,
  rowToArchivedStory,
  type ArchivedStory,
} from "@/lib/database/archive";
import {
  resolveStoryRequest,
  type StoryLookups,
} from "@/lib/news/story-resolution";
import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

const NOW = new Date("2026-08-14T12:00:00.000Z");

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
    publishedAt: "2026-08-14T09:30:00.000Z",
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
    firstPublishedAt: "2026-08-14T08:00:00.000Z",
    lastPublishedAt: "2026-08-14T09:30:00.000Z",
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

function makeArchivedStory(overrides: Partial<ArchivedStory> = {}): ArchivedStory {
  return {
    clusterId: "cl4b2n8x1",
    slug: "senate-passes-rail-safety-bill-cl4b2n8x1",
    title: "Senate passes bipartisan rail safety bill",
    summary: "The measure now heads to the House.",
    category: "politics",
    geography: "US",
    contentType: "news",
    imageUrl: "https://example-wire.com/rail.jpg",
    firstPublishedAt: "2026-08-14T08:00:00.000Z",
    lastPublishedAt: "2026-08-14T09:30:00.000Z",
    firstSeenAt: "2026-08-14T08:05:00.000Z",
    lastModifiedAt: "2026-08-14T09:35:00.000Z",
    rankingScore: 72.5,
    sourceCount: 2,
    sources: [
      {
        name: "Example Wire",
        domain: "example-wire.com",
        tier: "A",
        url: "https://example-wire.com/rail-safety",
        publishedAt: "2026-08-14T08:00:00.000Z",
        title: "Senate passes bipartisan rail safety bill",
      },
      {
        name: "Northern Post",
        domain: "northernpost.example",
        tier: "B",
        url: "https://northernpost.example/rail-bill",
        publishedAt: "2026-08-14T09:30:00.000Z",
        title: "Rail safety bill clears the Senate",
      },
    ],
    entities: ["Senate", "Rail Safety"],
    ...overrides,
  };
}

describe("clusterToArchiveRow", () => {
  it("maps every archived field and never sets first_seen_at", () => {
    const row = clusterToArchiveRow(makeCluster(), NOW);
    expect(row).toMatchObject({
      clusterId: "cl4b2n8x1",
      slug: "senate-passes-rail-safety-bill-cl4b2n8x1",
      title: "Senate passes bipartisan rail safety bill",
      summary: "The measure now heads to the House.",
      category: "politics",
      geography: "US",
      contentType: "news",
      imageUrl: "https://example-wire.com/rail.jpg",
      rankingScore: 72.5,
      sourceCount: 2,
      entities: ["Senate", "Rail Safety"],
    });
    expect(row.firstPublishedAt.toISOString()).toBe("2026-08-14T08:00:00.000Z");
    expect(row.lastPublishedAt.toISOString()).toBe("2026-08-14T09:30:00.000Z");
    expect(row.lastModifiedAt).toBe(NOW);
    expect(row.updatedAt).toBe(NOW);
    // first_seen_at must come from the DB default on first insert and never
    // be overwritten by the upsert.
    expect("firstSeenAt" in row).toBe(false);
    expect(row.sources).toEqual([
      {
        name: "Example Wire",
        domain: "example-wire.com",
        tier: "A",
        url: "https://example-wire.com/rail-safety",
        publishedAt: "2026-08-14T08:00:00.000Z",
        title: "Senate passes bipartisan rail safety bill",
      },
      {
        name: "Northern Post",
        domain: "northernpost.example",
        tier: "B",
        url: "https://northernpost.example/rail-bill",
        publishedAt: "2026-08-14T09:30:00.000Z",
        title: "Rail safety bill clears the Senate",
      },
    ]);
  });

  it("maps missing optionals to null", () => {
    const row = clusterToArchiveRow(
      makeCluster({ summary: undefined, imageUrl: undefined, contentType: undefined }),
      NOW,
    );
    expect(row.summary).toBeNull();
    expect(row.imageUrl).toBeNull();
    expect(row.contentType).toBeNull();
  });
});

describe("rowToArchivedStory", () => {
  it("converts Date columns to ISO strings and guards malformed jsonb", () => {
    const story = rowToArchivedStory({
      clusterId: "cl4b2n8x1",
      slug: "s-cl4b2n8x1",
      title: "T",
      summary: null,
      category: "politics",
      geography: "US",
      contentType: null,
      imageUrl: null,
      firstPublishedAt: new Date("2026-08-14T08:00:00.000Z"),
      lastPublishedAt: new Date("2026-08-14T09:30:00.000Z"),
      firstSeenAt: new Date("2026-08-14T08:05:00.000Z"),
      lastModifiedAt: new Date("2026-08-14T09:35:00.000Z"),
      rankingScore: 10,
      sourceCount: 1,
      sources: null as never,
      entities: null as never,
      updatedAt: new Date("2026-08-14T09:35:00.000Z"),
    });
    expect(story.firstSeenAt).toBe("2026-08-14T08:05:00.000Z");
    expect(story.firstPublishedAt).toBe("2026-08-14T08:00:00.000Z");
    expect(story.sources).toEqual([]);
    expect(story.entities).toEqual([]);
  });
});

describe("archivedStoryToCluster", () => {
  it("rebuilds a renderable cluster with source links intact", () => {
    const cluster = archivedStoryToCluster(makeArchivedStory());
    expect(cluster.id).toBe("cl4b2n8x1");
    expect(cluster.slug).toBe("senate-passes-rail-safety-bill-cl4b2n8x1");
    expect(cluster.articles).toHaveLength(2);
    expect(cluster.lead.source).toBe("Example Wire");
    expect(cluster.lead.url).toBe("https://example-wire.com/rail-safety");
    expect(cluster.articles[1].sourceTier).toBe("B");
    expect(cluster.sourceNames).toEqual(["Example Wire", "Northern Post"]);
    expect(cluster.sourceCount).toBe(2);
    expect(cluster.entities).toEqual(["Senate", "Rail Safety"]);
    expect(cluster.firstPublishedAt).toBe("2026-08-14T08:00:00.000Z");
    expect(cluster.isMock).toBe(false);
    expect(cluster.isBreaking).toBe(false);
    expect(cluster.status).toBeNull();
  });

  it("falls back safely when stored enum values are no longer valid", () => {
    const cluster = archivedStoryToCluster(
      makeArchivedStory({
        category: "retired-category",
        geography: "XX",
        contentType: "retired-type",
        sources: [
          {
            name: "Example Wire",
            domain: "example-wire.com",
            tier: "Z",
            url: "https://example-wire.com/rail-safety",
            publishedAt: "2026-08-14T08:00:00.000Z",
            title: "Senate passes bipartisan rail safety bill",
          },
        ],
      }),
    );
    expect(cluster.category).toBe("world");
    expect(cluster.country).toBe("GLOBAL");
    expect(cluster.contentType).toBeUndefined();
    expect(cluster.lead.sourceTier).toBe("C");
  });
});

describe("idTokenFromSlug", () => {
  it("extracts the token after the last hyphen", () => {
    expect(idTokenFromSlug("senate-passes-rail-safety-bill-cl4b2n8x1")).toBe("cl4b2n8x1");
    expect(idTokenFromSlug("cl4b2n8x1")).toBe("cl4b2n8x1");
  });
});

describe("resolveStoryRequest", () => {
  const cluster = makeCluster();
  const archived = makeArchivedStory();

  function lookups(
    live: StoryCluster | null,
    archive: ArchivedStory | null,
  ): StoryLookups & { getLive: ReturnType<typeof vi.fn>; getArchived: ReturnType<typeof vi.fn> } {
    return {
      getLive: vi.fn(async () => live),
      getArchived: vi.fn(async () => archive),
    };
  }

  it("serves live clusters without consulting the archive", async () => {
    const deps = lookups(cluster, archived);
    const result = await resolveStoryRequest(cluster.slug, deps);
    expect(result).toEqual({ kind: "live", cluster });
    expect(deps.getArchived).not.toHaveBeenCalled();
  });

  it("redirects live alias slugs to the canonical slug", async () => {
    const deps = lookups(cluster, null);
    const result = await resolveStoryRequest("cl4b2n8x1", deps);
    expect(result).toEqual({ kind: "redirect", slug: cluster.slug });
  });

  it("falls back to the archive when the live dataset misses", async () => {
    const deps = lookups(null, archived);
    const result = await resolveStoryRequest(archived.slug, deps);
    expect(result).toEqual({ kind: "archived", story: archived });
    expect(deps.getLive).toHaveBeenCalledWith(archived.slug);
  });

  it("redirects archive hits found under a non-canonical slug", async () => {
    const deps = lookups(null, archived);
    const result = await resolveStoryRequest("old-headline-cl4b2n8x1", deps);
    expect(result).toEqual({ kind: "redirect", slug: archived.slug });
  });

  it("returns not-found only when neither live nor archive knows the URL", async () => {
    const deps = lookups(null, null);
    const result = await resolveStoryRequest("definitely-not-a-story", deps);
    expect(result).toEqual({ kind: "not-found" });
    expect(deps.getLive).toHaveBeenCalled();
    expect(deps.getArchived).toHaveBeenCalled();
  });
});

function makeDataset(clusters: StoryCluster[], dataMode: "mock" | "live"): NewsDataset {
  return {
    articles: [],
    clusters,
    trending: [],
    generatedAt: NOW.toISOString(),
    dataMode,
    ingestion: {} as NewsDataset["ingestion"],
  };
}

describe("database-off behavior (DATABASE_URL unset)", () => {
  beforeEach(() => {
    getDbMock.mockReturnValue(null);
  });

  it("archiveDataset is a no-op returning 0", async () => {
    await expect(archiveDataset(makeDataset([makeCluster()], "live"))).resolves.toBe(0);
  });

  it("findArchivedStory returns null", async () => {
    await expect(findArchivedStory("anything-cl4b2n8x1")).resolves.toBeNull();
  });

  it("getArchiveFirstSeen returns an empty map", async () => {
    const map = await getArchiveFirstSeen(["cl4b2n8x1"]);
    expect(map.size).toBe(0);
  });
});

describe("archiveDataset upsert (mocked db)", () => {
  interface UpsertCall {
    rows: Record<string, unknown>[];
    config: { set: Record<string, unknown> };
  }
  const upserts: UpsertCall[] = [];

  function fakeDb() {
    return {
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

  beforeEach(() => {
    upserts.length = 0;
    getDbMock.mockReturnValue(fakeDb());
  });

  it("upserts every real cluster and reports the count", async () => {
    const clusters = [makeCluster(), makeCluster({ id: "cl9zz00aa2", slug: "other-cl9zz00aa2" })];
    await expect(archiveDataset(makeDataset(clusters, "live"))).resolves.toBe(2);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].rows.map((r) => r.clusterId)).toEqual(["cl4b2n8x1", "cl9zz00aa2"]);
  });

  it("never includes first_seen_at in the conflict-update set", async () => {
    await archiveDataset(makeDataset([makeCluster()], "live"));
    expect(upserts).toHaveLength(1);
    expect(Object.keys(upserts[0].config.set)).not.toContain("firstSeenAt");
    // But the mutable fields are updated.
    expect(Object.keys(upserts[0].config.set)).toEqual(
      expect.arrayContaining(["title", "summary", "lastPublishedAt", "sourceCount", "sources"]),
    );
  });

  it("archives nothing in mock mode or for mock clusters", async () => {
    await expect(archiveDataset(makeDataset([makeCluster()], "mock"))).resolves.toBe(0);
    await expect(
      archiveDataset(makeDataset([makeCluster({ isMock: true })], "live")),
    ).resolves.toBe(0);
    expect(upserts).toHaveLength(0);
  });

  it("is best-effort: a failing write logs and returns 0, never throws", async () => {
    getDbMock.mockReturnValue({
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => Promise.reject(new Error("connection refused")),
        }),
      }),
    });
    await expect(archiveDataset(makeDataset([makeCluster()], "live"))).resolves.toBe(0);
  });
});

describe("findArchivedStory lookup (mocked db)", () => {
  function fakeSelectDb(rows: Record<string, unknown>[]) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(rows),
          }),
        }),
      }),
    };
  }

  const rowA = {
    clusterId: "cl4b2n8x1",
    slug: "senate-passes-rail-safety-bill-cl4b2n8x1",
    title: "Senate passes bipartisan rail safety bill",
    summary: null,
    category: "politics",
    geography: "US",
    contentType: null,
    imageUrl: null,
    firstPublishedAt: new Date("2026-08-14T08:00:00.000Z"),
    lastPublishedAt: new Date("2026-08-14T09:30:00.000Z"),
    firstSeenAt: new Date("2026-08-14T08:05:00.000Z"),
    lastModifiedAt: new Date("2026-08-14T09:35:00.000Z"),
    rankingScore: 72.5,
    sourceCount: 2,
    sources: [],
    entities: [],
    updatedAt: new Date("2026-08-14T09:35:00.000Z"),
  };

  it("prefers the exact-slug match when several rows come back", async () => {
    const other = { ...rowA, clusterId: "cl0other99", slug: "different-cl0other99" };
    getDbMock.mockReturnValue(fakeSelectDb([other, rowA]));
    const story = await findArchivedStory("senate-passes-rail-safety-bill-cl4b2n8x1");
    expect(story?.clusterId).toBe("cl4b2n8x1");
    expect(story?.firstSeenAt).toBe("2026-08-14T08:05:00.000Z");
  });

  it("returns null when nothing matches", async () => {
    getDbMock.mockReturnValue(fakeSelectDb([]));
    await expect(findArchivedStory("unknown-zzz")).resolves.toBeNull();
  });

  it("swallows query failures and returns null", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.reject(new Error("timeout")) }),
        }),
      }),
    });
    await expect(findArchivedStory("anything-cl4b2n8x1")).resolves.toBeNull();
  });
});
