import { describe, expect, it } from "vitest";
import incidents from "@/data/incidents.json";
import keepList from "@/data/story-keep-list.json";
import {
  DEFAULT_RETIREMENT_POLICY,
  MAX_OUTAGE_FRACTION,
  outageCoverage,
  planRetirement,
  storyIdFromSlug,
  verdictForId,
  verdictForSlug,
  windowIsSound,
  type OutageRecord,
  type UrlSignals,
} from "@/lib/editorial/retirement";

const signals: UrlSignals = {
  busy: [54, 3],
  modest: [5, 0],
  atThreshold: [3, 0],
  belowThreshold: [2, 0],
  oneClickOnly: [1, 1],
};

describe("storyIdFromSlug", () => {
  it("pulls the id off a real story slug", () => {
    expect(
      storyIdFromSlug("judge-swapped-in-trumps-defamation-case-against-bbc-cf03400ab04ec"),
    ).toBe("cf03400ab04ec");
  });

  it("returns undefined for a slug with no id", () => {
    expect(storyIdFromSlug("just-a-headline")).toBeUndefined();
    expect(storyIdFromSlug("")).toBeUndefined();
  });

  it("does not mistake a short trailing word for an id", () => {
    // "bbc" is only 3 chars — an id is 8+ hex, so this must not match.
    expect(storyIdFromSlug("a-story-about-the-bbc")).toBeUndefined();
  });
});

describe("verdictForId", () => {
  it("keeps a URL above the impression floor", () => {
    expect(verdictForId("modest", signals)).toBe("keep");
    expect(verdictForId("atThreshold", signals)).toBe("keep");
  });

  it("retires a URL below it", () => {
    expect(verdictForId("belowThreshold", signals)).toBe("retire");
  });

  it("keeps anything that earned a click, however few impressions", () => {
    // A click is a human finding it useful — worth more than the count says.
    expect(verdictForId("oneClickOnly", signals)).toBe("keep");
  });

  it("retires a story with no signal entry at all", () => {
    // This is the ~15,600-URL case: retired by omission, which is why the
    // list is an allowlist rather than a blocklist.
    expect(verdictForId("neverSeen", signals)).toBe("retire");
  });

  it("retires an unidentifiable URL rather than guessing", () => {
    expect(verdictForId(undefined, signals)).toBe("retire");
  });

  it("honours a stricter policy", () => {
    expect(verdictForId("modest", signals, { minImpressions: 10, minClicks: 1 })).toBe("retire");
    expect(verdictForId("busy", signals, { minImpressions: 10, minClicks: 1 })).toBe("keep");
  });
});

describe("verdictForSlug", () => {
  it("decides from the full slug", () => {
    // Real slugs end in an 8+ hex-char id; anything shorter is not an id.
    expect(
      verdictForSlug("a-headline-here-cf03400ab04ec", { cf03400ab04ec: [54, 3] }),
    ).toBe("keep");
  });

  it("retires a slug that ends in a word rather than an id", () => {
    expect(verdictForSlug("a-headline-here-busy", { busy: [54, 3] })).toBe("retire");
  });

  it("retires a slug whose id is not in the signals", () => {
    expect(verdictForSlug("a-headline-here-deadbeef1234", signals)).toBe("retire");
  });
});

describe("planRetirement", () => {
  it("splits the set and reports what it retains", () => {
    const plan = planRetirement(signals);
    expect(plan.keep.sort()).toEqual(["atThreshold", "busy", "modest", "oneClickOnly"]);
    expect(plan.keptCount).toBe(4);
    expect(plan.droppedCount).toBe(1);
    expect(plan.impressionsRetained).toBe(54 + 5 + 3 + 1);
    expect(plan.impressionsTotal).toBe(54 + 5 + 3 + 2 + 1);
  });

  it("handles an empty signal set", () => {
    const plan = planRetirement({});
    expect(plan.keep).toEqual([]);
    expect(plan.impressionsTotal).toBe(0);
  });
});

describe("the committed keep-list", () => {
  /**
   * NOTE ON WHAT THIS DELIBERATELY DOES NOT ASSERT.
   *
   * An earlier version of this test compared the committed list against
   * whatever data/gsc-url-signals.json currently holds. That was wrong, and it
   * failed on 2026-09-28 for the right reason: the refreshed window (Sep 1-28)
   * was measured through 14 days of the 402 pause, so it showed 5 stories and
   * 13 impressions against 383 and 1,166 pre-outage. "Matching current
   * signals" would have meant rebuilding the list down to 2 URLs and
   * permanently 410-ing pages for the crime of being unreachable.
   *
   * What matters is not that the list is FRESH, it is that the list was built
   * from a window measured while the site was SERVING. That is what these
   * assertions check.
   */
  it("is internally consistent", () => {
    expect(keepList.keep).toHaveLength(keepList.keptCount);
    expect(new Set(keepList.keep).size).toBe(keepList.keep.length);
    expect(keepList.impressionsRetained).toBeLessThanOrEqual(keepList.impressionsTotal);
  });

  it("was built from a window measured mostly while the site was serving", () => {
    // Same rule the build script enforces, so the COMMITTED list cannot drift
    // from it: no outage can quietly become a permanent retirement decision.
    const window = keepList.signalWindow;
    expect(window).not.toBeNull();
    const coverage = outageCoverage(window!, incidents as OutageRecord[]);
    expect(
      coverage.fraction,
      `keep-list window ${window!.startDate}..${window!.endDate} was ` +
        `${coverage.darkDays}/${coverage.windowDays} days dark ` +
        `(${Math.round(coverage.fraction * 100)}%) — rebuild from a serving window`,
    ).toBeLessThanOrEqual(MAX_OUTAGE_FRACTION);
  });

  it("is reproducible from the signal set it records", () => {
    // Self-consistency of the policy: every kept id must clear the recorded
    // policy, which is what planRetirement would have decided.
    const asSignals: UrlSignals = Object.fromEntries(
      keepList.keep.map((id) => [id, [keepList.policy.minImpressions, 0] as [number, number]]),
    );
    const plan = planRetirement(asSignals, keepList.policy);
    expect(plan.keep).toEqual([...keepList.keep].sort());
  });

  it("was built with the documented default policy", () => {
    expect(keepList.policy).toEqual(DEFAULT_RETIREMENT_POLICY);
  });

  it("keeps a small, deliberate subset — not most of the corpus", () => {
    // The whole point is that ~16k URLs go. If this list ever grows into the
    // thousands, the cost problem it exists to solve has come back.
    expect(keepList.keep.length).toBeGreaterThan(0);
    expect(keepList.keep.length).toBeLessThan(500);
  });

  it("retains the majority of the search value it could", () => {
    expect(keepList.impressionsRetained / keepList.impressionsTotal).toBeGreaterThan(0.5);
  });
});


describe("outageCoverage — separating noise from contamination", () => {
  const ongoing: OutageRecord[] = [
    { date: "2026-09-12", kind: "outage", ongoing: true, label: "site paused" },
  ];

  it("scores the pre-outage window sound and the through-outage window not", () => {
    // The two real cases that motivated this rule.
    const pre = outageCoverage({ startDate: "2026-08-18", endDate: "2026-09-14" }, ongoing);
    const through = outageCoverage({ startDate: "2026-09-01", endDate: "2026-09-28" }, ongoing);
    expect(pre.darkDays).toBe(3);
    expect(through.darkDays).toBe(17);
    expect(windowIsSound({ startDate: "2026-08-18", endDate: "2026-09-14" }, ongoing)).toBe(true);
    expect(windowIsSound({ startDate: "2026-09-01", endDate: "2026-09-28" }, ongoing)).toBe(false);
  });

  it("treats an ongoing outage as running to the end of the window", () => {
    const coverage = outageCoverage({ startDate: "2026-09-10", endDate: "2026-09-30" }, ongoing);
    expect(coverage.darkDays).toBe(19); // 09-12 .. 09-30 inclusive
  });

  it("does not double-count overlapping incidents", () => {
    const overlapping: OutageRecord[] = [
      { date: "2026-09-01", kind: "outage", end: "2026-09-05" },
      { date: "2026-09-03", kind: "outage", end: "2026-09-07" },
    ];
    // Resolved incidents, so ongoingOnly must be switched off to see them.
    // Union is 09-01..09-07 = 7 days, not 5 + 5.
    expect(
      outageCoverage({ startDate: "2026-09-01", endDate: "2026-09-28" }, overlapping, {
        ongoingOnly: false,
      }).darkDays,
    ).toBe(7);
  });

  it("ignores RESOLVED outages by default — nothing could be rebuilt otherwise", () => {
    // This site logged ~38 incidents in three weeks; counting resolved ones
    // made every window fail. Only an unresolved outage gates a rebuild.
    const resolved: OutageRecord[] = [
      { date: "2026-09-02", kind: "outage", end: "2026-09-04", label: "brief blip" },
    ];
    const window = { startDate: "2026-09-01", endDate: "2026-09-28" };
    expect(outageCoverage(window, resolved).darkDays).toBe(0);
    expect(outageCoverage(window, resolved, { ongoingOnly: false }).darkDays).toBe(3);
    expect(windowIsSound(window, resolved)).toBe(true);
  });

  it("ignores non-outage incidents", () => {
    const changes: OutageRecord[] = [{ date: "2026-09-12", kind: "change", ongoing: true }];
    expect(outageCoverage({ startDate: "2026-09-01", endDate: "2026-09-28" }, changes).darkDays).toBe(0);
  });

  it("ignores outages outside the window", () => {
    const old: OutageRecord[] = [{ date: "2026-07-01", kind: "outage", end: "2026-07-02" }];
    expect(outageCoverage({ startDate: "2026-09-01", endDate: "2026-09-28" }, old).darkDays).toBe(0);
  });

  it("handles a nonsense window without dividing by zero", () => {
    const coverage = outageCoverage({ startDate: "2026-09-28", endDate: "2026-09-01" }, ongoing);
    expect(coverage.fraction).toBe(0);
    expect(coverage.windowDays).toBe(0);
  });
});
