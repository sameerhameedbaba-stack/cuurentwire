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
vi.mock("@/lib/database/persist-gate", () => ({
  shouldPersistNow: () => shouldPersistNowMock(),
  claimCronBurst: () => claimCronBurstMock(),
  releaseCronBurst: () => releaseCronBurstMock(),
  markPersisted: () => markPersistedMock(),
  archivePublicDataset: () => archivePublicDatasetMock(),
  drainPendingIndexNowIds: () => drainPendingMock(),
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
    getDatasetMock.mockResolvedValue({ ...dataset, generatedAt: new Date().toISOString() });
    const res = await GET(cronRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe("fresh");
    expect(forceRefreshMock).not.toHaveBeenCalled();
    expect(persistDatasetMock).not.toHaveBeenCalled();
  });

  it("?force=1 bypasses the guard", async () => {
    getDatasetMock.mockResolvedValue({ ...dataset, generatedAt: new Date().toISOString() });
    const res = await GET(new NextRequest("http://localhost:3000/api/cron/news-refresh?force=1"));
    const body = await res.json();
    expect(body.skipped).toBeUndefined();
    expect(forceRefreshMock).toHaveBeenCalledTimes(1);
  });
});
