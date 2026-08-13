import { describe, expect, it } from "vitest";
import { classifyCategory } from "@/lib/news/classification/category";
import { classifyGeography } from "@/lib/news/classification/geography";
import { extractEntities } from "@/lib/news/classification/entities";

describe("classifyGeography", () => {
  it("classifies Canadian-subject stories as Canada even from international wires", () => {
    expect(
      classifyGeography({
        title: "Bank of Canada signals cautious approach ahead of rate decision",
        description: "Officials in Ottawa emphasized a data-dependent path.",
        sourceCountry: "INTL",
      }),
    ).toBe("CA");
  });

  it("classifies US-institution stories as US", () => {
    expect(
      classifyGeography({
        title: "Congress debates federal budget framework in Washington",
        sourceCountry: "INTL",
      }),
    ).toBe("US");
  });

  it("classifies shared stories as US_CA", () => {
    expect(
      classifyGeography({
        title: "US and Canada resume talks on softwood lumber trade dispute",
      }),
    ).toBe("US_CA");
  });

  it("never matches the pronoun 'us' or substrings like 'cautious'", () => {
    expect(
      classifyGeography({
        title: "Officials take cautious tone as central bank tells us little",
      }),
    ).toBe("GLOBAL");
  });

  it("recognizes internationally-relevant North American stories", () => {
    expect(
      classifyGeography({
        title: "NATO members plan joint exercise amid supply chain concerns",
      }),
    ).toBe("GLOBAL_NA");
  });
});

describe("classifyCategory", () => {
  it("classifies markets stories as business", () => {
    const result = classifyCategory({
      title: "Federal Reserve holds interest rate steady as inflation cools",
    });
    expect(result.primary).toBe("business");
  });

  it("classifies sports stories as sports", () => {
    const result = classifyCategory({
      title: "NHL clubs complete multi-player trade ahead of training camps",
    });
    expect(result.primary).toBe("sports");
  });

  it("uses provider category as a signal", () => {
    const result = classifyCategory({
      title: "A short headline with no obvious keywords",
      providerCategory: "technology",
    });
    expect(result.primary).toBe("technology");
  });

  it("falls back to world when nothing matches", () => {
    const result = classifyCategory({ title: "Completely generic headline" });
    expect(result.primary).toBe("world");
  });
});

describe("extractEntities", () => {
  it("finds known institutions", () => {
    const entities = extractEntities(
      "Federal Reserve holds benchmark interest rate steady",
    );
    expect(entities).toContain("Federal Reserve");
  });

  it("never matches entity abbreviations inside words (NFL vs inflation)", () => {
    const entities = extractEntities(
      "Officials point to inflation data ahead of the next decision",
    );
    expect(entities).not.toContain("NFL");
    expect(entities).toContain("Inflation");
  });

  it("extracts capitalized phrases from headlines", () => {
    const entities = extractEntities(
      "Crews respond to fires across British Columbia this week",
    );
    expect(entities).toContain("British Columbia");
  });
});
