import { describe, expect, it } from "vitest";
import { classifyCategory } from "@/lib/news/classification/category";
import {
  classifyGeography,
  classifyGeographyDetailed,
} from "@/lib/news/classification/geography";
import { extractEntities, isGenericEntity } from "@/lib/news/classification/entities";

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

  it("audit regression: Congressional Black Caucus story is US, never Canada", () => {
    // Live failure: "the CBC" (= the Caucus) was the ONLY term hit on either
    // side, so a US politics story classified CA at confidence 1.0 and
    // appeared on the homepage Canada rail and /canada.
    expect(
      classifyGeography({
        title: "Congressional Black Caucus urges DOJ to review Nolan Wells case",
        description:
          "Supporters of Nolan Wells' family announced that the CBC sent a request on Wednesday to the DOJ to launch a federal review into the death of the 18-year-old.",
      }),
    ).toBe("US");
  });

  it("still recognizes the Canadian broadcaster CBC alongside strong evidence", () => {
    const result = classifyGeographyDetailed({
      title: "CBC News: Ottawa unveils federal budget",
    });
    expect(result.country).toBe("CA");
    // Both "cbc" and "ottawa" must land: the black-caucus guard only
    // suppresses the acronym when the caucus is named in the text.
    expect(result.scores.ca).toBeGreaterThanOrEqual(2);
  });

  it("weak-only acronym evidence never claims a country on its own", () => {
    expect(classifyGeography({ title: "TSX edges higher at open" })).toBe("GLOBAL");
    expect(
      classifyGeography({ title: "NDP support grows in latest poll" }),
    ).toBe("GLOBAL");
  });

  it("lets weak terms support and tiebreak a side that has strong evidence", () => {
    // "premier" (weak) alongside "ontario" (strong) still counts toward CA.
    const result = classifyGeographyDetailed({
      title: "Ontario premier announces new highway funding",
    });
    expect(result.country).toBe("CA");
    expect(result.scores.ca).toBeGreaterThanOrEqual(2);
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

  it("falls back to the internal general bucket (never world) when nothing matches", () => {
    const result = classifyCategory({ title: "Completely generic headline" });
    expect(result.primary).toBe("general");
    expect(result.confidence).toBe(0);
    expect(result.scores).toEqual({});
  });

  it("reports deterministic confidence, scores and matched signals", () => {
    const result = classifyCategory({
      title: "Federal Reserve holds interest rate steady as inflation cools",
    });
    expect(result.primary).toBe("business");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.scores.business).toBeGreaterThan(0);
    expect(
      result.matchedSignals.some((s) => s.startsWith("business:")),
    ).toBe(true);
    // Deterministic: identical input, identical output.
    expect(
      classifyCategory({
        title: "Federal Reserve holds interest rate steady as inflation cools",
      }),
    ).toEqual(result);
  });

  it("uses entity signals on word boundaries (SpaceX -> science, not inside words)", () => {
    const result = classifyCategory({
      title: "SpaceX completes crewed launch to orbiting research station",
    });
    expect(result.primary).toBe("science");
    expect(result.matchedSignals).toContain("science:entity:spacex");
  });

  it("applies negative keywords to kill obvious false positives", () => {
    // "Box office earnings" is culture, not business — without the negative
    // keyword the business/culture tie would break toward business.
    const result = classifyCategory({
      title: "Box office earnings surge as new superhero film tops weekend charts",
    });
    expect(result.primary).toBe("culture");
    expect(result.matchedSignals).toContain("business:negative:box office");
    expect(result.scores.business ?? 0).toBeLessThan(result.scores.culture!);
  });

  it("weighs a feed-section prior below an explicit provider category", () => {
    const base = { title: "A short headline with no obvious keywords" };
    const explicit = classifyCategory({ ...base, providerCategory: "technology" });
    const prior = classifyCategory({
      ...base,
      providerCategory: "technology",
      providerCategoryIsPrior: true,
    });
    expect(explicit.primary).toBe("technology");
    expect(prior.primary).toBe("technology");
    expect(prior.scores.technology!).toBeLessThan(explicit.scores.technology!);
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

  it("does not fuse capitalized words across sentence punctuation", () => {
    // Live regression: the comma ended the clause, so "Niger" and
    // "Christian" are two different things, not one entity.
    const entities = extractEntities(
      "US missionary released following kidnap in Niger, Christian group says",
    );
    expect(entities).not.toContain("Niger Christian");
    const dashed = extractEntities("Talks resume in Geneva: Swiss officials confirm");
    expect(dashed).not.toContain("Geneva Swiss");
  });

  it("breaks title-case phrases on headline verbs and connectives", () => {
    // Live regression: press-release headlines are title-cased, so the phrase
    // pass used to fuse issuer + verb + object into "Metals Announces Closing".
    const entities = extractEntities(
      "Brixton Metals Announces Closing of First Tranche of Private Placement",
    );
    expect(entities).not.toContain("Metals Announces Closing");
    // The real name still survives when it is not the skipped leading word.
    expect(
      extractEntities("Miner Brixton Metals Announces Closing of Private Placement"),
    ).toContain("Brixton Metals");
  });

  it("strips possessives inside phrases (live /topic/liverpools-gakpo regression)", () => {
    // "Liverpool's Gakpo" names Gakpo (of Liverpool) — the tokens are
    // Liverpool + Gakpo, never a fused "Liverpools".
    const entities = extractEntities("Slot praises Liverpool's Gakpo after cup win");
    expect(entities).toContain("Liverpool Gakpo");
    expect(entities.some((e) => /liverpools/i.test(e))).toBe(false);
    // Typographic apostrophes behave identically.
    const curly = extractEntities("Slot praises Liverpool’s Gakpo after cup win");
    expect(curly).toContain("Liverpool Gakpo");
  });

  it("breaks phrases on negation fragments (live /topic/gop-dont regression)", () => {
    for (const title of [
      "Democrats warn GOP Don't Count on a Shutdown Deal",
      "Democrats warn GOP Don’t Count on a Shutdown Deal",
    ]) {
      const entities = extractEntities(title);
      expect(
        entities.some((e) => /don.?t/i.test(e)),
        `"${title}" must not fuse a negation into an entity`,
      ).toBe(false);
    }
  });

  it("breaks phrases on the CEO title (live /topic/ceo-josh-damaro regression)", () => {
    const entities = extractEntities(
      "Disney taps CEO Josh D'Amaro to lead experiences unit",
    );
    expect(entities).toContain("Josh D'Amaro");
    expect(entities.some((e) => /^ceo\b/i.test(e))).toBe(false);
  });

  it("treats corporate-filing phrases as generic, never relatedness evidence", () => {
    // Two unrelated issuers share this template language; it must never make
    // their stories look like coverage of the same event.
    expect(isGenericEntity("Private Placement")).toBe(true);
    expect(isGenericEntity("First Tranche")).toBe(true);
    expect(isGenericEntity("Second Quarter")).toBe(true);
    expect(isGenericEntity("Luigi Mangione")).toBe(false);
  });
});
