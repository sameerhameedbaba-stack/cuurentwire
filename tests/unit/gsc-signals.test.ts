import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createGscSignals,
  GSC_PROTECT_MIN_IMPRESSIONS,
  GSC_SIGNALS_MAX_AGE_DAYS,
  gscProtectedStoryIds,
  gscSignalsAvailable,
  gscSignalsVersion,
  gscStorySignal,
  isGscProtected,
  type GscUrlSignalsFile,
} from "@/lib/seo/gsc-signals";

const PLACEHOLDER: GscUrlSignalsFile = {
  generatedAt: null,
  window: null,
  surfaces: ["web", "news"],
  minImpressions: 1,
  stories: {},
};

const GENERATED_AT = "2026-08-20T06:00:00.000Z";

const FRESH: GscUrlSignalsFile = {
  generatedAt: GENERATED_AT,
  window: { startDate: "2026-07-21", endDate: "2026-08-17", days: 28 },
  surfaces: ["web", "news"],
  minImpressions: 1,
  stories: {
    c0123456789ab: [120, 7],
    cfedcba987654: [1, 0],
    c00000000000a: [0, 1],
    c00000000000b: [0, 0],
  },
};

describe("createGscSignals", () => {
  it("treats the never-run placeholder as no data", () => {
    const signals = createGscSignals(PLACEHOLDER);
    expect(signals.generatedAt).toBeNull();
    expect(signals.available(new Date("2026-08-22T00:00:00Z"))).toBe(false);
    expect(signals.story("c0123456789ab")).toBeNull();
    expect(signals.protectedStoryIds()).toEqual([]);
    expect(signals.version()).toBe("none");
  });

  it("is available for 14 days after generation and stale afterwards", () => {
    const signals = createGscSignals(FRESH);
    const generated = new Date(GENERATED_AT).getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(signals.available(new Date(generated))).toBe(true);
    expect(signals.available(new Date(generated + 13 * day))).toBe(true);
    expect(signals.available(new Date(generated + GSC_SIGNALS_MAX_AGE_DAYS * day))).toBe(true);
    expect(signals.available(new Date(generated + GSC_SIGNALS_MAX_AGE_DAYS * day + 1))).toBe(
      false,
    );
    expect(GSC_SIGNALS_MAX_AGE_DAYS).toBe(14);
  });

  it("treats an unparseable generatedAt as no data", () => {
    const signals = createGscSignals({ ...FRESH, generatedAt: "last tuesday" });
    expect(signals.generatedAt).toBeNull();
    expect(signals.available(new Date(GENERATED_AT))).toBe(false);
    // The string is still the cache key — a new file, even a broken one, is a new version.
    expect(signals.version()).toBe("last tuesday");
  });

  it("reads a story's [impressions, clicks] and answers null for an absent URL", () => {
    const signals = createGscSignals(FRESH);
    expect(signals.story("c0123456789ab")).toEqual({ impressions: 120, clicks: 7 });
    expect(signals.story("cfedcba987654")).toEqual({ impressions: 1, clicks: 0 });
    expect(signals.story("c00000000000b")).toEqual({ impressions: 0, clicks: 0 });
    expect(signals.story("cabsent000000")).toBeNull();
    // Prototype keys are not stories.
    expect(signals.story("constructor")).toBeNull();
    expect(signals.story("__proto__")).toBeNull();
  });

  it("ignores malformed entries instead of throwing", () => {
    const signals = createGscSignals({
      ...FRESH,
      stories: {
        cbadentry0001: "12" as unknown as number[],
        cbadentry0002: [Number.NaN, -3],
        cbadentry0003: [4],
        cgoodentry001: [2, 0],
      },
    });
    expect(signals.story("cbadentry0001")).toBeNull();
    expect(signals.story("cbadentry0002")).toEqual({ impressions: 0, clicks: 0 });
    expect(signals.story("cbadentry0003")).toBeNull();
    expect(signals.protectedStoryIds()).toEqual(["cgoodentry001"]);
  });

  it("protects stories with >= 1 click or >= GSC_PROTECT_MIN_IMPRESSIONS impressions, in file order", () => {
    expect(GSC_PROTECT_MIN_IMPRESSIONS).toBe(1);
    const signals = createGscSignals(FRESH);
    expect(signals.protectedStoryIds()).toEqual([
      "c0123456789ab",
      "cfedcba987654",
      "c00000000000a",
    ]);
    expect(isGscProtected({ impressions: 0, clicks: 0 })).toBe(false);
    expect(isGscProtected({ impressions: 1, clicks: 0 })).toBe(true);
    expect(isGscProtected({ impressions: 0, clicks: 1 })).toBe(true);
  });

  it("memoizes the protected set", () => {
    const signals = createGscSignals(FRESH);
    expect(signals.protectedStoryIds()).toBe(signals.protectedStoryIds());
  });

  it("uses generatedAt as the version", () => {
    expect(createGscSignals(FRESH).version()).toBe(GENERATED_AT);
  });
});

describe("committed data/gsc-url-signals.json", () => {
  const file = JSON.parse(
    readFileSync(new URL("../../data/gsc-url-signals.json", import.meta.url), "utf8"),
  ) as GscUrlSignalsFile;

  it("matches the shared signals-file contract", () => {
    expect(file).toHaveProperty("generatedAt");
    expect(file).toHaveProperty("window");
    expect(file.surfaces).toEqual(["web", "news"]);
    expect(file.minImpressions).toBe(1);
    expect(typeof file.stories).toBe("object");
    expect(Object.keys(file.stories).length).toBeLessThanOrEqual(20_000);
    for (const [clusterId, entry] of Object.entries(file.stories)) {
      expect(clusterId).toMatch(/^c[0-9a-f]{12}$/);
      expect(entry).toHaveLength(2);
      expect(entry[0]).toBeGreaterThanOrEqual(1);
      expect(entry[1]).toBeGreaterThanOrEqual(0);
    }
    if (file.generatedAt === null) {
      expect(file.window).toBeNull();
      expect(file.stories).toEqual({});
    } else {
      expect(Number.isFinite(Date.parse(file.generatedAt))).toBe(true);
      expect(file.window?.days).toBe(28);
    }
  });

  it("is what the module-level readers expose", () => {
    expect(gscSignalsVersion()).toBe(file.generatedAt ?? "none");
    const expected = createGscSignals(file);
    expect(gscSignalsAvailable()).toBe(expected.available());
    expect(gscProtectedStoryIds()).toEqual(expected.protectedStoryIds());
    for (const clusterId of Object.keys(file.stories).slice(0, 5)) {
      expect(gscStorySignal(clusterId)).toEqual(expected.story(clusterId));
    }
    expect(gscStorySignal("cabsent000000")).toBeNull();
  });
});
