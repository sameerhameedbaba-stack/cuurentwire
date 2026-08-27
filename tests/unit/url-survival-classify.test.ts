import { describe, expect, it } from "vitest";
import {
  classifyResults,
  clusterIdFromStoryUrl,
  LOST_AFTER_DAYS,
  RUN_HEALTHY_SHARE,
} from "../../scripts/url-survival-lib.mjs";

const NOW = new Date("2026-08-24T12:00:00.000Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

type Result = { url: string; ok: boolean; status: number };
const ok = (url: string): Result => ({ url, ok: true, status: 200 });
const dead = (url: string, status = 500): Result => ({ url, ok: false, status });

/** A ledger big enough that a handful of failures stays inside the healthy share. */
function healthyRun(failures: Result[]) {
  const results: Result[] = [];
  for (let i = 0; i < 500; i++) results.push(ok(`https://x/story/live-${i}`));
  results.push(...failures);
  return results;
}

describe("url-survival failure classification", () => {
  it("calls a 4xx GONE — the permanence guarantee is broken", () => {
    const results = healthyRun([dead("https://x/story/a", 404)]);
    const ledger = new Map([["https://x/story/a", { lastOk: daysAgo(10) }]]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.gone).toHaveLength(1);
    expect(out.lost).toHaveLength(0);
    expect(out.unavailable).toHaveLength(0);
  });

  it("a 4xx is never reclassified as LOST however stale it is", () => {
    // LOST must never absorb the one condition this probe exists to catch.
    const results = healthyRun([dead("https://x/story/a", 410)]);
    const ledger = new Map([["https://x/story/a", { lastOk: daysAgo(90) }]]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.gone).toHaveLength(1);
    expect(out.lost).toHaveLength(0);
  });

  it("a recently-alive 5xx stays UNAVAILABLE (the origin is having a bad day)", () => {
    const results = healthyRun([dead("https://x/story/a")]);
    const ledger = new Map([
      ["https://x/story/a", { lastOk: daysAgo(LOST_AFTER_DAYS - 1) }],
    ]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.unavailable).toHaveLength(1);
    expect(out.lost).toHaveLength(0);
  });

  it("a 5xx not seen alive for longer than the window becomes LOST", () => {
    const results = healthyRun([dead("https://x/story/a")]);
    const ledger = new Map([
      ["https://x/story/a", { lastOk: daysAgo(LOST_AFTER_DAYS + 1) }],
    ]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.lost).toHaveLength(1);
    expect(out.unavailable).toHaveLength(0);
  });

  it("a URL that never once answered 200 is dated from firstSeen", () => {
    const results = healthyRun([dead("https://x/story/a")]);
    const ledger = new Map([
      ["https://x/story/a", { lastOk: null, firstSeen: daysAgo(9) }],
    ]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.lost).toHaveLength(1);
  });

  it("a site-wide outage is NEVER laundered into lost content", () => {
    // The whole point of RUN_HEALTHY_SHARE: with the origin down, every URL
    // is stale AND 5xx, which would otherwise mark the entire ledger lost
    // and turn the gate green in the middle of the worst possible failure.
    const results: Result[] = [];
    for (let i = 0; i < 500; i++) results.push(dead(`https://x/story/s-${i}`));
    const ledger = new Map(
      results.map((r) => [r.url, { lastOk: daysAgo(LOST_AFTER_DAYS + 5) }]),
    );
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.runIsHealthy).toBe(false);
    expect(out.lost).toHaveLength(0);
    expect(out.unavailable).toHaveLength(500);
  });

  it("the healthy-share threshold is what gates reclassification", () => {
    // Just under the bar: nothing may be called lost.
    const total = 100;
    const failing = Math.ceil(total * (1 - RUN_HEALTHY_SHARE)) + 1;
    const results: Result[] = [];
    for (let i = 0; i < failing; i++) results.push(dead(`https://x/story/d-${i}`));
    for (let i = failing; i < total; i++) results.push(ok(`https://x/story/l-${i}`));
    const ledger = new Map(
      results.map((r) => [r.url, { lastOk: daysAgo(LOST_AFTER_DAYS + 5) }]),
    );
    expect(classifyResults({ results, ledger, nowMs: NOW }).lost).toHaveLength(0);
  });

  it("a network error (status 0) is treated as a failure, not as OK", () => {
    const results = healthyRun([dead("https://x/story/a", 0)]);
    const ledger = new Map([["https://x/story/a", { lastOk: daysAgo(1) }]]);
    const out = classifyResults({ results, ledger, nowMs: NOW });
    expect(out.unavailable).toHaveLength(1);
  });

  it("a redirect that resolves 200 is OK, not a failure", () => {
    const results = healthyRun([{ url: "https://x/story/a", ok: true, status: 308 }]);
    const out = classifyResults({ results, ledger: new Map(), nowMs: NOW });
    expect(out.redirects).toHaveLength(1);
    expect(out.gone).toHaveLength(0);
    expect(out.unavailable).toHaveLength(0);
    expect(out.lost).toHaveLength(0);
  });

  it("an unknown URL with no ledger entry stays UNAVAILABLE", () => {
    // No record of it ever being alive is not evidence that it is lost.
    const results = healthyRun([dead("https://x/story/ghost")]);
    const out = classifyResults({ results, ledger: new Map(), nowMs: NOW });
    expect(out.unavailable).toHaveLength(1);
    expect(out.lost).toHaveLength(0);
  });
});

describe("tombstoned stories", () => {
  // data/lost-stories.json holds cluster ids whose content exists nowhere:
  // published during the 2026-08-19..21 Neon egress outage, never archived.
  // lib/news/story-resolution.ts answers a deliberate 404 for them, so the
  // probe must recognise its own site's decision instead of reporting 212
  // broken promises every night.
  const TOMB = "c0123456789ab";
  const tombUrl = `https://x/story/some-headline-${TOMB}`;
  const liveId = "cfedcba987654";
  const liveUrl = `https://x/story/another-headline-${liveId}`;

  it("reads the cluster id out of a story URL", () => {
    expect(clusterIdFromStoryUrl(tombUrl)).toBe(TOMB);
    expect(clusterIdFromStoryUrl("https://x/about")).toBeNull();
  });

  it("a 404 for a tombstoned id is expected, not a broken promise", () => {
    const out = classifyResults({
      results: healthyRun([dead(tombUrl, 404)]),
      ledger: new Map([[tombUrl, { lastOk: daysAgo(7) }]]),
      nowMs: NOW,
      tombstonedIds: new Set([TOMB]),
    });
    expect(out.tombstoned).toHaveLength(1);
    expect(out.gone).toHaveLength(0);
  });

  it("a 404 for any OTHER id still fails the gate", () => {
    // The whole reason to split them out: a real regression must stay
    // visible next to the expected ones.
    const out = classifyResults({
      results: healthyRun([dead(tombUrl, 404), dead(liveUrl, 404)]),
      ledger: new Map(),
      nowMs: NOW,
      tombstonedIds: new Set([TOMB]),
    });
    expect(out.tombstoned).toHaveLength(1);
    expect(out.gone).toHaveLength(1);
    expect(out.gone[0].url).toBe(liveUrl);
  });

  it("a tombstone excuses a 404 only — a 5xx on the same id is still an outage", () => {
    const out = classifyResults({
      results: healthyRun([dead(tombUrl, 500)]),
      ledger: new Map([[tombUrl, { lastOk: daysAgo(1) }]]),
      nowMs: NOW,
      tombstonedIds: new Set([TOMB]),
    });
    expect(out.tombstoned).toHaveLength(0);
    expect(out.unavailable).toHaveLength(1);
  });

  it("tombstones never drag the run below the healthy share", () => {
    // 205 tombstoned ids against a ~4,600-URL ledger is 4.5% today, but the
    // file only grows. If they counted as sick, a bigger tombstone list
    // would silently suspend LOST classification for unrelated 5xx.
    const results: Result[] = [];
    const tombs = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const id = `c${i.toString(16).padStart(12, "0")}`;
      tombs.add(id);
      results.push(dead(`https://x/story/gone-${id}`, 404));
    }
    for (let i = 0; i < 60; i++) results.push(ok(`https://x/story/live-${i}`));
    const stale = "https://x/story/stale-cabcdef123456";
    results.push(dead(stale, 500));
    const out = classifyResults({
      results,
      ledger: new Map([[stale, { lastOk: daysAgo(LOST_AFTER_DAYS + 1) }]]),
      nowMs: NOW,
      tombstonedIds: tombs,
    });
    expect(out.runIsHealthy).toBe(true);
    expect(out.tombstoned).toHaveLength(40);
    expect(out.lost).toHaveLength(1);
  });

  it("with no tombstone list every 4xx is still GONE", () => {
    const out = classifyResults({
      results: healthyRun([dead(tombUrl, 404)]),
      ledger: new Map(),
      nowMs: NOW,
    });
    expect(out.gone).toHaveLength(1);
    expect(out.tombstoned).toHaveLength(0);
  });
});
