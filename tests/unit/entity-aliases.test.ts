import { describe, expect, it } from "vitest";
import {
  canonicalizeEntity,
  extractEntities,
} from "@/lib/news/classification/entities";

/**
 * Entity alias canonicalization (Stage C audit fix): "USS Lincoln" and
 * "USS Abraham Lincoln" must be ONE topic, not two — and the same for the
 * other safe alias pairs. All headlines are synthetic.
 */

describe("canonicalizeEntity", () => {
  it.each([
    ["USS Lincoln", "USS Abraham Lincoln"],
    ["The Fed", "Federal Reserve"],
    ["Fed", "Federal Reserve"],
    ["President Trump", "Donald Trump"],
    ["Trump", "Donald Trump"],
    ["Biden", "Joe Biden"],
    ["President Biden", "Joe Biden"],
    ["AI", "Artificial Intelligence"],
    ["NYC", "New York City"],
    ["UK", "United Kingdom"],
    ["USA", "United States"],
    ["SCOTUS", "Supreme Court"],
    ["GOP", "Republican Party"],
    ["Mounties", "RCMP"],
    ["Putin", "Vladimir Putin"],
    ["Zelensky", "Volodymyr Zelenskyy"],
    ["COVID", "COVID-19"],
  ])("%s → %s", (alias, canonical) => {
    expect(canonicalizeEntity(alias)).toBe(canonical);
  });

  it("leaves unaliased entities unchanged", () => {
    expect(canonicalizeEntity("Bank of Canada")).toBe("Bank of Canada");
    // The president is NOT the aircraft carrier — deliberately unaliased.
    expect(canonicalizeEntity("Abraham Lincoln")).toBe("Abraham Lincoln");
  });
});

describe("extractEntities canonicalization", () => {
  it("merges USS Lincoln and USS Abraham Lincoln into one topic", () => {
    const a = extractEntities(
      "Carrier group led by USS Lincoln repositions in the Pacific",
    );
    const b = extractEntities(
      "Navy says USS Abraham Lincoln will reposition in the Pacific",
    );
    expect(a).toContain("USS Abraham Lincoln");
    expect(b).toContain("USS Abraham Lincoln");
    expect(a).not.toContain("USS Lincoln");
    // The full-name headline must not ALSO leak "Abraham Lincoln" (the
    // president) as a separate topic — the sub-phrase is the same mention.
    expect(b).not.toContain("Abraham Lincoln");
  });

  it("resolves 'the Fed' mentions to Federal Reserve", () => {
    const entities = extractEntities(
      "Markets steady as the Fed weighs its next move on rates",
    );
    expect(entities).toContain("Federal Reserve");
  });

  it("canonicalizes titled names captured by the phrase pass", () => {
    const entities = extractEntities(
      "Trade talks continue as President Trump meets provincial leaders",
    );
    expect(entities).toContain("Donald Trump");
    expect(entities).not.toContain("President Trump");
  });

  it("dedupes an alias against its canonical form within one text", () => {
    const entities = extractEntities(
      "Rate expectations shift as the Fed briefs Congress",
      "The Federal Reserve chair testified before lawmakers on Tuesday.",
    );
    expect(
      entities.filter((e) => e === "Federal Reserve"),
    ).toHaveLength(1);
  });

  it("does not turn word fragments into aliases", () => {
    // "uk" inside "Ukraine" must not become United Kingdom.
    const entities = extractEntities("Ukraine grain exports resume via Black Sea");
    expect(entities).not.toContain("United Kingdom");
  });
});
