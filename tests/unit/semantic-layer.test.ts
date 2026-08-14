import { describe, expect, it } from "vitest";
import type { CategoryResult } from "@/lib/news/classification/category";
import {
  categoryCacheKey,
  emptyTelemetry,
  eventCacheKey,
  isValidRelationship,
  isValidSemanticCategory,
  needsSemanticCategory,
  nullSemanticProvider,
  resolveCategory,
  resolveMerge,
  SemanticBudget,
  semanticConfig,
  withGuards,
  type EventRelationshipResult,
  type SemanticCategoryResult,
} from "@/lib/intelligence/semantic";

/** Intelligence Layer v2 guard-rail tests (§49). */

function det(overrides: Partial<CategoryResult> = {}): CategoryResult {
  return {
    primary: "general",
    all: ["general"],
    confidence: 0,
    scores: {},
    matchedSignals: [],
    ...overrides,
  };
}

function sem(overrides: Partial<SemanticCategoryResult> = {}): SemanticCategoryResult {
  return {
    category: "sports",
    confidence: 0.95,
    reasonCode: "test",
    provider: "fake",
    model: "fake-1",
    ...overrides,
  };
}

const config = semanticConfig({} as NodeJS.ProcessEnv);

describe("ambiguity gate", () => {
  it("gates general, low confidence and near-ties; passes confident results", () => {
    expect(needsSemanticCategory(det())).toBe(true);
    expect(
      needsSemanticCategory(
        det({ primary: "politics", confidence: 0.2, scores: { politics: 6 } }),
      ),
    ).toBe(true);
    // Near-tie: 6 vs 5.5 → margin < 0.25.
    expect(
      needsSemanticCategory(
        det({ primary: "politics", confidence: 0.6, scores: { politics: 6, world: 5.5 } }),
      ),
    ).toBe(true);
    expect(
      needsSemanticCategory(
        det({ primary: "politics", confidence: 1, scores: { politics: 9 } }),
      ),
    ).toBe(false);
  });
});

describe("category resolution (§9/§39)", () => {
  it("overrides general only at/above the threshold", () => {
    expect(resolveCategory(det(), sem({ confidence: 0.9 }), config)).toEqual({
      category: "sports",
      overridden: true,
    });
    expect(resolveCategory(det(), sem({ confidence: 0.5 }), config)).toEqual({
      category: "general",
      overridden: false,
    });
  });

  it("never overrides a specific deterministic category", () => {
    const specific = det({ primary: "politics", confidence: 0.9 });
    expect(resolveCategory(specific, sem({ confidence: 0.99 }), config).category).toBe(
      "politics",
    );
  });

  it("rejects unknown categories and semantic general", () => {
    expect(
      resolveCategory(det(), sem({ category: "crypto" as never }), config).overridden,
    ).toBe(false);
    expect(
      resolveCategory(det(), sem({ category: "general" }), config).overridden,
    ).toBe(false);
  });

  it("keeps the deterministic result when semantic abstains", () => {
    expect(resolveCategory(det(), null, config)).toEqual({
      category: "general",
      overridden: false,
    });
  });
});

describe("merge resolution (§13/§41)", () => {
  const same = (confidence: number): EventRelationshipResult => ({
    relationship: "same_event",
    confidence,
    reasonCode: "test",
    provider: "fake",
    model: "fake-1",
  });

  it("requires same_event, threshold AND deterministic evidence", () => {
    expect(resolveMerge(same(0.95), true, config)).toBe(true);
    expect(resolveMerge(same(0.95), false, config)).toBe(false); // no blind merges
    expect(resolveMerge(same(0.85), true, config)).toBe(false); // below threshold
    expect(
      resolveMerge({ ...same(0.99), relationship: "related_event" }, true, config),
    ).toBe(false);
    expect(resolveMerge(null, true, config)).toBe(false);
  });
});

describe("guards: timeout, failure, budget (§19/§22)", () => {
  it("timeout returns null and counts a timeout — never throws", async () => {
    const telemetry = emptyTelemetry();
    const result = await withGuards<SemanticCategoryResult>(
      () =>
        new Promise<SemanticCategoryResult | null>((resolve) =>
          setTimeout(() => resolve(sem()), 5_000),
        ),
      50,
      telemetry,
    );
    expect(result).toBeNull();
    expect(telemetry.timeouts).toBe(1);
  });

  it("a throwing provider returns null and counts a failure", async () => {
    const telemetry = emptyTelemetry();
    const result = await withGuards(
      () => Promise.reject(new Error("provider exploded")),
      1_000,
      telemetry,
    );
    expect(result).toBeNull();
    expect(telemetry.providerFailures).toBe(1);
  });

  it("budget exhaustion stops further calls", () => {
    const budget = new SemanticBudget({ ...config, maxClassificationsPerRefresh: 2 });
    expect(budget.takeClassification()).toBe(true);
    expect(budget.takeClassification()).toBe(true);
    expect(budget.takeClassification()).toBe(false);
  });

  it("the null provider abstains from everything", async () => {
    expect(await nullSemanticProvider.classifyCategory({ title: "x" })).toBeNull();
    expect(
      await nullSemanticProvider.compareEvents(
        { id: "a", title: "x" },
        { id: "b", title: "y" },
      ),
    ).toBeNull();
  });
});

describe("validators and cache keys (§7/§12/§20)", () => {
  it("accepts only known categories and relationships", () => {
    expect(isValidSemanticCategory("sports")).toBe(true);
    expect(isValidSemanticCategory("crypto")).toBe(false);
    expect(isValidRelationship("same_event")).toBe(true);
    expect(isValidRelationship("maybe_related")).toBe(false);
  });

  it("cache keys are deterministic; event keys are order-independent", () => {
    const input = { title: "T", description: "D" };
    expect(categoryCacheKey(input)).toBe(categoryCacheKey({ ...input }));
    expect(categoryCacheKey({ title: "T", description: "other" })).not.toBe(
      categoryCacheKey(input),
    );
    const a = { id: "art1", title: "x" };
    const b = { id: "art2", title: "y" };
    expect(eventCacheKey(a, b)).toBe(eventCacheKey(b, a));
  });
});

describe("configuration (§9/§22)", () => {
  it("defaults to OFF with sane thresholds; env overrides parse", () => {
    const defaults = semanticConfig({} as NodeJS.ProcessEnv);
    expect(defaults.mode).toBe("off");
    expect(defaults.categoryOverrideThreshold).toBe(0.85);
    expect(defaults.mergeThreshold).toBe(0.9);
    const custom = semanticConfig({
      SEMANTIC_MODE: "shadow",
      SEMANTIC_CATEGORY_OVERRIDE_THRESHOLD: "0.7",
      MAX_SEMANTIC_CLASSIFICATIONS_PER_REFRESH: "10",
    } as unknown as NodeJS.ProcessEnv);
    expect(custom.mode).toBe("shadow");
    expect(custom.categoryOverrideThreshold).toBe(0.7);
    expect(custom.maxClassificationsPerRefresh).toBe(10);
    expect(
      semanticConfig({ SEMANTIC_MODE: "everything" } as unknown as NodeJS.ProcessEnv).mode,
    ).toBe("off");
  });
});
