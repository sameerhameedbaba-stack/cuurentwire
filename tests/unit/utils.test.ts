import { describe, expect, it } from "vitest";
import {
  bigrams,
  fnv1a,
  jaccard,
  metaDescription,
  significantTokens,
  slugify,
  stableId,
  truncate,
} from "@/lib/utils/text";
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

describe("stableId", () => {
  it("is stable and 12 hex chars (sha256-based)", () => {
    expect(stableId("https://example.com/story")).toBe(
      stableId("https://example.com/story"),
    );
    expect(stableId("x")).toMatch(/^[0-9a-f]{12}$/);
    expect(stableId("a")).not.toBe(stableId("b"));
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

describe("metaDescription", () => {
  it("returns short text unchanged", () => {
    expect(metaDescription("A short summary.")).toBe("A short summary.");
  });

  it("keeps whole sentences instead of clipping mid-thought", () => {
    const text =
      "Residents began returning home on Monday. Roughly 1,200 properties were cleared for re-entry after crews finished inspecting every street in the evacuation zone.";
    const out = metaDescription(text);
    expect(out).toBe("Residents began returning home on Monday.");
    expect(out.endsWith("…")).toBe(false);
  });

  it("packs as many complete sentences as fit", () => {
    const text = "One two three. Four five six. " + "x".repeat(200) + ".";
    const out = metaDescription(text);
    expect(out).toBe("One two three. Four five six.");
  });

  it("falls back to ellipsis truncation when the first sentence is too long", () => {
    const text = `${"word ".repeat(60)}ends here. Second sentence.`;
    const out = metaDescription(text);
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith("…")).toBe(true);
  });

  it("never ends on a dangling connector before the ellipsis", () => {
    const text = `${"alpha ".repeat(24)}- beta gamma delta epsilon zeta eta theta iota kappa lambda.`;
    const out = metaDescription(text);
    expect(out).not.toMatch(/[\s,;:\-–—]…$/);
  });

  it("collapses whitespace and handles empty input", () => {
    expect(metaDescription("  spaced\n\nout  text.  ")).toBe("spaced out text.");
    expect(metaDescription("   ")).toBe("");
  });

  it("respects a custom max length", () => {
    const text = "First sentence here. Second sentence here. Third one here.";
    expect(metaDescription(text, 25)).toBe("First sentence here.");
  });

  // Live defect, measured on indexed story pages 2026-09-04: a summary opening
  // with an abbreviation returned a 2-character description. The sentence regex
  // cannot start a match on "U.S." so it began mid-token at "S. ".
  it("never returns a fragment when the text opens with an abbreviation", () => {
    const text =
      "U.S. Immigration officials said the policy would take effect immediately, according to a statement released Tuesday afternoon in Washington and confirmed by two senior officials.";
    const out = metaDescription(text);
    expect(out).not.toBe("S.");
    expect(out.startsWith("U.S.")).toBe(true);
    expect(out.length).toBeGreaterThanOrEqual(40);
  });

  it("rejects a prefix that is technically correct but useless", () => {
    // "Rep." IS a real prefix, so a prefix check alone would accept it.
    const text =
      "Rep. Johnson introduced the measure on Monday after weeks of negotiation with colleagues across the aisle, setting up a vote that could come as early as next week.";
    const out = metaDescription(text);
    expect(out).not.toBe("Rep.");
    expect(out.length).toBeGreaterThanOrEqual(40);
  });

  it("holds a length floor for every realistic summary", () => {
    // The observed live failures were 2, 7, 9, 13 and 15 characters.
    const openings = ["U.S.", "Rep.", "Sen.", "St. Louis", "Dr.", "Mt.", "Jan."];
    for (const opening of openings) {
      const text = `${opening} something happened here today and the story continued at considerable length afterwards, with several further developments reported by the evening.`;
      const out = metaDescription(text);
      expect(out.length, `opening ${opening} produced ${JSON.stringify(out)}`).toBeGreaterThanOrEqual(40);
      expect(text.startsWith(out.replace(/…$/, "").trimEnd())).toBe(true);
    }
  });
});
