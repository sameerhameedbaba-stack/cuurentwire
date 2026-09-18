import { describe, expect, it } from "vitest";
import keepList from "@/data/story-keep-list.json";
import signalsFile from "@/data/gsc-url-signals.json";
import {
  DEFAULT_RETIREMENT_POLICY,
  planRetirement,
  storyIdFromSlug,
  verdictForId,
  verdictForSlug,
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
  it("matches what the current policy and signals produce", () => {
    // If this fails, either the signals were refreshed without regenerating
    // the list (npx tsx scripts/build-keep-list.ts) or the policy drifted.
    // A stale keep-list retires URLs that have since started earning.
    const plan = planRetirement(
      (signalsFile as { stories: UrlSignals }).stories,
      keepList.policy,
    );
    expect(keepList.keep).toEqual(plan.keep);
    expect(keepList.keptCount).toBe(plan.keptCount);
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
