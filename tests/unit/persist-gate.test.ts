import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsDataset, StoryCluster } from "@/lib/news/types";

// archiveDataset / findNewClusterIds are stubbed: these tests exercise the
// gate's decisions and the carry/ping registries, not the upsert itself.
const archiveDatasetMock = vi.fn<
  (dataset: NewsDataset, carry?: StoryCluster[]) => Promise<number>
>(async () => 1);
const findNewClusterIdsMock = vi.fn<(ids: string[]) => Promise<string[]>>(
  async () => [],
);
vi.mock("@/lib/database/archive", () => ({
  archiveDataset: (dataset: NewsDataset, carry?: StoryCluster[]) =>
    archiveDatasetMock(dataset, carry),
  findNewClusterIds: (ids: string[]) => findNewClusterIdsMock(ids),
}));

import {
  archivePublicDataset,
  claimCronBurst,
  drainPendingIndexNowIds,
  isCronBurstActive,
  markPersisted,
  PERSIST_MIN_INTERVAL_MS,
  registerPublicClusters,
  releaseCronBurst,
  resetPersistGateForTests,
  shouldPersistNow,
} from "@/lib/database/persist-gate";

/** Midday ET (15:xx UTC = 11:xx ET in August) — far from the day rollover. */
function midday(minute: number, second = 0): Date {
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return new Date(`2026-08-21T15:${mm}:${ss}.000Z`);
}

function makeCluster(id: string, overrides: Partial<StoryCluster> = {}): StoryCluster {
  return {
    id,
    slug: `story-${id}`,
    title: `Story ${id}`,
    summary: null,
    category: "politics",
    country: "US",
    articles: [],
    lead: { source: "Example Wire" },
    sourceCount: 1,
    sourceNames: ["Example Wire"],
    entities: [],
    firstPublishedAt: "2026-08-21T10:00:00.000Z",
    lastPublishedAt: "2026-08-21T11:00:00.000Z",
    rankingScore: 50,
    isMock: false,
    ...overrides,
  } as unknown as StoryCluster;
}

function makeDataset(
  clusters: StoryCluster[],
  dataMode: "live" | "mock" = "live",
): NewsDataset {
  return {
    articles: [],
    clusters,
    trending: [],
    generatedAt: "2026-08-21T15:00:00.000Z",
    datasetVersion: "20260821T150000Z-test",
    dataMode,
  } as unknown as NewsDataset;
}

beforeEach(() => {
  resetPersistGateForTests();
  archiveDatasetMock.mockClear();
  archiveDatasetMock.mockResolvedValue(1);
  findNewClusterIdsMock.mockClear();
  findNewClusterIdsMock.mockResolvedValue([]);
});

describe("shouldPersistNow — cold instance (no module state)", () => {
  it("opens during the first half of each half hour", () => {
    for (const minute of [0, 1, 4, 14, 30, 31, 44]) {
      expect(shouldPersistNow(midday(minute))).toBe(true);
    }
    for (const minute of [15, 20, 25, 29, 45, 55, 59]) {
      expect(shouldPersistNow(midday(minute))).toBe(false);
    }
  });

  it("no scheduler beat of 15 minutes or less can miss every window", () => {
    // The 2026-08-27 stall in one assertion: a window narrower than the
    // beat is a coin flip on the scheduler's phase, and the phase is not
    // ours to choose. Every start minute, every beat up to 15 minutes.
    for (let beat = 1; beat <= 15; beat++) {
      for (let phase = 0; phase < 60; phase++) {
        const opens = [];
        for (let tick = 0; tick * beat < 60; tick++) {
          opens.push(shouldPersistNow(midday((phase + tick * beat) % 60)));
        }
        expect(opens.some(Boolean), `beat ${beat} phase ${phase}`).toBe(true);
      }
    }
  });
});

describe("shouldPersistNow — warm instance (marked)", () => {
  it("closes after a mark and reopens once the interval elapses", () => {
    markPersisted(midday(0));
    // In-window minutes no longer open the gate: elapsed time decides.
    expect(shouldPersistNow(midday(1))).toBe(false);
    expect(shouldPersistNow(midday(4))).toBe(false);
    expect(shouldPersistNow(midday(24))).toBe(false);
    const reopenAt = new Date(midday(0).getTime() + PERSIST_MIN_INTERVAL_MS);
    expect(shouldPersistNow(reopenAt)).toBe(true);
  });
});

describe("shouldPersistNow — ET day rollover", () => {
  // 03:57 UTC on Aug 22 is 23:57 ET on Aug 21 (EDT, UTC-4): the next cron
  // tick lands after midnight ET, so this tick must write regardless of
  // cadence — the briefing row for the day freezes at rollover.
  it("forces a persist on the day's last cron tick", () => {
    const lastTick = new Date("2026-08-22T03:57:00.000Z");
    markPersisted(new Date(lastTick.getTime() - 60_000));
    expect(shouldPersistNow(lastTick)).toBe(true);
  });

  it("does not force earlier evening ticks", () => {
    const earlier = new Date("2026-08-22T03:49:00.000Z"); // 23:49 ET
    markPersisted(new Date(earlier.getTime() - 60_000));
    expect(shouldPersistNow(earlier)).toBe(false);
  });
});

describe("cron burst claim", () => {
  it("is active after claim, inactive after release", () => {
    expect(isCronBurstActive(midday(0))).toBe(false);
    claimCronBurst(midday(0));
    expect(isCronBurstActive(midday(0, 30))).toBe(true);
    releaseCronBurst();
    expect(isCronBurstActive(midday(0, 31))).toBe(false);
  });

  it("expires on its own if never released", () => {
    claimCronBurst(midday(0));
    expect(isCronBurstActive(midday(5))).toBe(false);
  });
});

describe("archivePublicDataset — carry registry", () => {
  it("carries registered clusters that vanished from the current dataset", async () => {
    const vanished = makeCluster("cvanished0001");
    const survivor = makeCluster("csurvivor001");
    registerPublicClusters(makeDataset([vanished, survivor]));
    await archivePublicDataset(makeDataset([survivor]));
    expect(archiveDatasetMock).toHaveBeenCalledTimes(1);
    const [, carry] = archiveDatasetMock.mock.calls[0];
    expect(carry?.map((c) => c.id)).toEqual(["cvanished0001"]);
  });

  it("clears the registry after a successful archive, keeps it on failure", async () => {
    const vanished = makeCluster("cvanished0001");
    registerPublicClusters(makeDataset([vanished]));
    archiveDatasetMock.mockResolvedValueOnce(0); // failed burst
    await archivePublicDataset(makeDataset([makeCluster("cother0000001")]));
    await archivePublicDataset(makeDataset([makeCluster("cother0000001")]));
    // Second (successful) call still carried the vanished cluster…
    expect(archiveDatasetMock.mock.calls[1][1]?.map((c) => c.id)).toEqual([
      "cvanished0001",
    ]);
    // …and the third call after success carries nothing.
    await archivePublicDataset(makeDataset([makeCluster("cother0000001")]));
    expect(archiveDatasetMock.mock.calls[2][1]).toEqual([]);
  });

  it("never registers mock clusters or mock datasets", async () => {
    registerPublicClusters(makeDataset([makeCluster("cmockmode0001")], "mock"));
    registerPublicClusters(
      makeDataset([makeCluster("cmockrow00001", { isMock: true })]),
    );
    await archivePublicDataset(makeDataset([makeCluster("cother0000001")]));
    expect(archiveDatasetMock.mock.calls[0][1]).toEqual([]);
  });
});

describe("archivePublicDataset — IndexNow stash", () => {
  it("stashes new ids on success and drains them once", async () => {
    findNewClusterIdsMock.mockResolvedValueOnce(["cnewstory0001"]);
    await archivePublicDataset(makeDataset([makeCluster("cnewstory0001")]));
    expect(drainPendingIndexNowIds()).toEqual(["cnewstory0001"]);
    expect(drainPendingIndexNowIds()).toEqual([]);
  });

  it("stashes nothing when the archive write failed", async () => {
    findNewClusterIdsMock.mockResolvedValueOnce(["cnewstory0001"]);
    archiveDatasetMock.mockResolvedValueOnce(0);
    await archivePublicDataset(makeDataset([makeCluster("cnewstory0001")]));
    expect(drainPendingIndexNowIds()).toEqual([]);
  });

  it("accumulates across bursts until drained (producer burst + cron drain)", async () => {
    findNewClusterIdsMock.mockResolvedValueOnce(["cfirstnew0001"]);
    await archivePublicDataset(makeDataset([makeCluster("cfirstnew0001")]));
    findNewClusterIdsMock.mockResolvedValueOnce(["csecondnew001"]);
    await archivePublicDataset(makeDataset([makeCluster("csecondnew001")]));
    expect(drainPendingIndexNowIds().sort()).toEqual([
      "cfirstnew0001",
      "csecondnew001",
    ]);
  });

  it("skips the new-id lookup entirely for mock datasets", async () => {
    await archivePublicDataset(makeDataset([makeCluster("cmock00000001")], "mock"));
    expect(findNewClusterIdsMock).not.toHaveBeenCalled();
  });
});
