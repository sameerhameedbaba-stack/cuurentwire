import { describe, expect, it } from "vitest";
import { bigrams, fnv1a, jaccard, significantTokens, slugify, truncate } from "@/lib/utils/text";
import { relativeTime } from "@/lib/utils/time";

describe("slugify", () => {
  it("produces clean url slugs", () => {
    expect(slugify("Fed Holds Rates — Markets React!")).toBe(
      "fed-holds-rates-markets-react",
    );
    expect(slugify("Québec's économie")).toBe("quebecs-economie");
  });

  it("never returns an empty slug", () => {
    expect(slugify("!!!")).toBe("story");
  });
});

describe("fnv1a", () => {
  it("is stable and 8 hex chars", () => {
    expect(fnv1a("https://example.com/story")).toBe(fnv1a("https://example.com/story"));
    expect(fnv1a("x")).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });
});

describe("token similarity helpers", () => {
  it("removes stopwords", () => {
    expect(significantTokens("The Fed and the markets")).toEqual(["fed", "markets"]);
  });

  it("computes jaccard overlap", () => {
    const a = new Set(["fed", "rate", "steady"]);
    const b = new Set(["fed", "rate", "unchanged"]);
    expect(jaccard(a, b)).toBeCloseTo(0.5);
    expect(jaccard(new Set(), b)).toBe(0);
  });

  it("builds consecutive bigrams", () => {
    expect([...bigrams(["a", "b", "c"])]).toEqual(["a b", "b c"]);
  });
});

describe("truncate", () => {
  it("cuts on word boundaries with an ellipsis", () => {
    const result = truncate("one two three four five", 14);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(15);
  });
  it("leaves short strings alone", () => {
    expect(truncate("short", 50)).toBe("short");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  it("formats recent times", () => {
    expect(relativeTime("2026-08-13T11:56:00Z", now)).toBe("4 min ago");
    expect(relativeTime("2026-08-13T10:00:00Z", now)).toBe("2 hr ago");
    expect(relativeTime("2026-08-12T06:00:00Z", now)).toBe("Yesterday");
    expect(relativeTime("2026-08-13T11:59:40Z", now)).toBe("Just now");
  });
  it("handles invalid input gracefully", () => {
    expect(relativeTime("garbage", now)).toBe("");
  });
});
