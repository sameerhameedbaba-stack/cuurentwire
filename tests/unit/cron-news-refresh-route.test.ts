import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NewsDataset } from "@/lib/news/types";

/**
 * Wiring test for the cron route's batched persistence: DB work must run
 * only when the persist gate says so, and the response must keep the
 * documented field semantics on both burst and deferred runs. Everything
 * around the route is mocked — the gate's own decisions are covered in
 * persist-gate.test.ts.
 */

const dataset = {
  articles: [{ id: "a1" }],
  clusters: [
    {
      id: "cnewstory0001",
      slug: "fresh-story-cnewstory0001",
      isMock: false,
    },
  ],
  generatedAt: "2026-08-21T15:00:00.000Z",
  datasetVersion: "20260821T150000Z-test",
  dataMode: "live",
  ingestion: { duplicatesRemoved: 0, providers: [] },
} as unknown as NewsDataset;

const forceRefreshMock = vi.fn(async () => dataset);
// The cadence guard reads the current dataset first; the fixture is hours
// old, so by default the guard lets the refresh proceed.
const getDatasetMock = vi.fn(async () => dataset);
vi.mock("@/lib/cache/store", () => ({
  forceRefresh: () => forceRefreshMock(),
  getDataset: () => getDatasetMock(),
}));

const dbConfiguredMock = vi.fn(() => true);
vi.mock("@/lib/database/client", () => ({
  isDatabaseConfigured: () => dbConfiguredMock(),
}));

const persistDatasetMock = vi.fn(async () => true);
vi.mock("@/lib/database/persist", () => ({
  persistDataset: () => persistDatasetMock(),
}));

const upsertBriefingMock = vi.fn(async () => true);
vi.mock("@/lib/database/briefing", () => ({
  upsertDailyBriefing: () => upsertBriefingMock(),
}));

const pingIndexNowMock = vi.fn(async (_urls: string[]) => true);
vi.mock("@/lib/seo/indexnow", () => ({
  pingIndexNow: (urls: string[]) => pingIndexNowMock(urls),
}));

const shouldPersistNowMock = vi.fn(() => true);
const claimCronBurstMock = vi.fn();
const releaseCronBurstMock = vi.fn();
const markPersistedMock = vi.fn();
const archivePublicDatasetMock = vi.fn(async () => 1);
const drainPendingMock = vi.fn((): string[] => []);
const drainStaleSlugsMock = vi.fn((): string[] => []);
// next/cache throws outside a request context, and the route swallows that
// by design (a revalidation failure must never fail the refresh). Mocking it
// lets these tests assert WHICH paths were revalidated instead of watching
// every call fail silently.
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));
vi.mock("@/lib/database/persist-gate", () => ({
  shouldPersistNow: () => shouldPersistNowMock(),
  claimCronBurst: () => claimCronBurstMock(),
  releaseCronBurst: () => releaseCronBurstMock(),
  markPersisted: () => markPersistedMock(),
  archivePublicDataset: () => archivePublicDatasetMock(),
  drainPendingIndexNowIds: () => drainPendingMock(),
  drainStaleSlugs: () => drainStaleSlugsMock(),
}));

import { GET } from "@/app/api/cron/news-refresh/route";

function cronRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/news-refresh");
}

beforeEach(() => {
  vi.clearAllMocks();
  forceRefreshMock.mockResolvedValue(dataset);
  getDatasetMock.mockResolvedValue(dataset);
  dbConfiguredMock.mockReturnValue(true);
  persistDatasetMock.mockResolvedValue(true);
  upsertBriefingMock.mockResolvedValue(true);
  pingIndexNowMock.mockResolvedValue(true);
  shouldPersistNowMock.mockReturnValue(true);
  archivePublicDatasetMock.mockResolvedValue(1);
  drainPendingMock.mockReturnValue([]);
  drainStaleSlugsMock.mockReturnValue([]);
  revalidatePathMock.mockClear();
});

describe("cron news-refresh route — batched persistence wiring", () => {
  it("runs the full write burst when the gate is open", async () => {
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(persistDatasetMock).toHaveBeenCalledTimes(1);
    expect(archivePublicDatasetMock).toHaveBeenCalledTimes(1);
    expect(upsertBriefingMock).toHaveBeenCalledTimes(1);
    expect(markPersistedMock).toHaveBeenCalledTimes(1);
    // The burst is claimed around forceRefresh so the producer defers.
    expect(claimCronBurstMock).toHaveBeenCalledTimes(1);
    expect(releaseCronBurstMock).toHaveBeenCalledTimes(1);
    expect(body.persistedToDatabase).toBe(true);
    expect(body.archivedStories).toBe(1);
    expect(body.briefingStored).toBe(true);
    expect(body.persistenceDeferred).toBe(false);
  });

  it("still refreshes but skips all DB work on a deferred run", async () => {
    shouldPersistNowMock.mockReturnValue(false);
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(forceRefreshMock).toHaveBeenCalledTimes(1);
    expect(persistDatasetMock).not.toHaveBeenCalled();
    expect(archivePublicDatasetMock).not.toHaveBeenCalled();
    expect(upsertBriefingMock).not.toHaveBeenCalled();
    expect(markPersistedMock).not.toHaveBeenCalled();
    expect(claimCronBurstMock).not.toHaveBeenCalled();
    expect(body.persistedToDatabase).toBe(false);
    expect(body.archivedStories).toBe(0);
    expect(body.briefingStored).toBe(false);
    expect(body.indexNowSubmitted).toBe(0);
    expect(body.persistenceDeferred).toBe(true);
  });

  it("does not advance the batch clock when the archive write fails", async () => {
    archivePublicDatasetMock.mockResolvedValue(0);
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(markPersistedMock).not.toHaveBeenCalled();
    expect(body.archivedStories).toBe(0);
    expect(body.persistenceDeferred).toBe(false);
  });

  it("reports persistenceDeferred false when no database is configured", async () => {
    dbConfiguredMock.mockReturnValue(false);
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(persistDatasetMock).not.toHaveBeenCalled();
    expect(body.persistedToDatabase).toBe(false);
    expect(body.persistenceDeferred).toBe(false);
  });

  it("re-renders the story URLs the burst retired", async () => {
    // The canonical revalidation above never touches a retired alias, and
    // the alias is the URL holding a cached 307 with no cache tag — the
    // ingredient of the 2026-08-26 infinite redirect loop.
    drainStaleSlugsMock.mockReturnValue(["old-headline-crenamed00001"]);
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(drainStaleSlugsMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/story/old-headline-crenamed00001",
    );
    expect(body.retiredSlugsRevalidated).toBe(1);
  });

  it("drains nothing to revalidate when the archive write failed", async () => {
    archivePublicDatasetMock.mockResolvedValue(0);
    drainStaleSlugsMock.mockReturnValue(["old-headline-crenamed00001"]);
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(drainStaleSlugsMock).not.toHaveBeenCalled();
    expect(body.retiredSlugsRevalidated).toBe(0);
  });

  it("keeps IndexNow out of non-production runs but drains the stash", async () => {
    drainPendingMock.mockReturnValue(["cnewstory0001"]);
    const res = await GET(cronRequest());
    const body = await res.json();
    // Not production in tests → no ping, but the drain must still happen.
    expect(drainPendingMock).toHaveBeenCalledTimes(1);
    expect(pingIndexNowMock).not.toHaveBeenCalled();
    expect(body.indexNowSubmitted).toBe(0);
  });
});

describe("cron news-refresh route — cadence guard", () => {
  it("skips the refresh when the dataset is younger than the interval", async () => {
    shouldPersistNowMock.mockReturnValue(false);
    getDatasetMock.mockResolvedValue({ ...dataset, generatedAt: new Date().toISOString() });
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe("fresh");
    expect(forceRefreshMock).not.toHaveBeenCalled();
    expect(persistDatasetMock).not.toHaveBeenCalled();
  });

  it("a fresh dataset skips the refresh but NEVER the write burst", async () => {
    // Regression, 2026-08-26: the guard used to return before the persist
    // gate was even consulted, so the burst could only ever run on a tick
    // that also refreshed. Refresh ticks drift against the gate's
    // half-hour cold windows, and archive writes stopped for 14 hours
    // while every public surface still looked healthy.
    getDatasetMock.mockResolvedValue({ ...dataset, generatedAt: new Date().toISOString() });
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBeUndefined();
    expect(body.refreshSkipped).toBe(true);
    expect(forceRefreshMock).not.toHaveBeenCalled();
    // No producer run to race with, so the burst is not claimed — but every
    // database write still happens.
    expect(claimCronBurstMock).not.toHaveBeenCalled();
    expect(persistDatasetMock).toHaveBeenCalledTimes(1);
    expect(archivePublicDatasetMock).toHaveBeenCalledTimes(1);
    expect(upsertBriefingMock).toHaveBeenCalledTimes(1);
    expect(markPersistedMock).toHaveBeenCalledTimes(1);
    expect(body.archivedStories).toBe(1);
  });

  it("?force=1 bypasses the guard", async () => {
    getDatasetMock.mockResolvedValue({ ...dataset, generatedAt: new Date().toISOString() });
    const res = await GET(new NextRequest("http://localhost:3000/api/cron/news-refresh?force=1"));
    const body = await res.json();
    expect(body.skipped).toBeUndefined();
    expect(forceRefreshMock).toHaveBeenCalledTimes(1);
  });
});
