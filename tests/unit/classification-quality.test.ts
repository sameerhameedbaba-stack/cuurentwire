import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "@/config/categories";
import { classifyCategory } from "@/lib/news/classification/category";
import { classifyContentType } from "@/lib/news/classification/content-type";
import { classifyGeography } from "@/lib/news/classification/geography";
import type { ContentType, Country } from "@/lib/news/types";
import {
  categoryFixtures,
  contentTypeFixtures,
  geographyFixtures,
  type CategoryFixture,
  type ContentTypeFixture,
  type GeographyFixture,
} from "../fixtures/classification-fixtures";

/**
 * Fixture-based evaluation of the deterministic classifiers.
 * Accuracy on high-confidence examples must stay >= 0.95 for both category
 * and geography; overall accuracy (including the intentionally-hard
 * low-confidence examples) is reported on every run.
 */

const MIN_HIGH_CONFIDENCE_ACCURACY = 0.95;

interface EvalResult {
  overallPass: number;
  overallTotal: number;
  highPass: number;
  highTotal: number;
  failures: string[];
}

function evaluate<T>(
  fixtures: T[],
  isHigh: (f: T) => boolean,
  run: (f: T) => { expected: string; actual: string; label: string },
): EvalResult {
  const result: EvalResult = {
    overallPass: 0,
    overallTotal: fixtures.length,
    highPass: 0,
    highTotal: 0,
    failures: [],
  };
  for (const fixture of fixtures) {
    const { expected, actual, label } = run(fixture);
    const ok = expected === actual;
    const high = isHigh(fixture);
    if (ok) result.overallPass++;
    if (high) {
      result.highTotal++;
      if (ok) result.highPass++;
    }
    if (!ok) {
      result.failures.push(
        `[${high ? "HIGH" : "low"}] ${label} — expected ${expected}, got ${actual}`,
      );
    }
  }
  return result;
}

function report(name: string, r: EvalResult): void {
  const overall = r.overallPass / r.overallTotal;
  const high = r.highTotal === 0 ? 1 : r.highPass / r.highTotal;
  // process.stdout.write so the numbers show on every run (vitest hides
  // console.log from passing tests).
  process.stdout.write(
    `[classification-quality] ${name}: overall ${r.overallPass}/${r.overallTotal} (${(overall * 100).toFixed(1)}%), ` +
      `high-confidence ${r.highPass}/${r.highTotal} (${(high * 100).toFixed(1)}%)\n`,
  );
  for (const failure of r.failures) {
    process.stdout.write(`[classification-quality]   miss: ${failure}\n`);
  }
}

function runCategory(f: CategoryFixture) {
  const result = classifyCategory({
    title: f.title,
    description: f.description,
    providerCategory: f.providerCategory,
    providerCategoryIsPrior: f.providerCategoryIsPrior,
  });
  return {
    expected: f.expectedCategory,
    actual: result.primary,
    label: `"${f.title}"`,
  };
}

function runGeography(f: GeographyFixture) {
  return {
    expected: f.expectedGeography,
    actual: classifyGeography({
      title: f.title,
      description: f.description,
      sourceCountry: f.sourceCountry,
      providerCountry: f.providerCountry,
    }),
    label: `"${f.title}"`,
  };
}

function runContentType(f: ContentTypeFixture) {
  return {
    expected: f.expectedContentType,
    actual: classifyContentType({ title: f.title, description: f.description }),
    label: `"${f.title}"`,
  };
}

describe("classification quality (fixture evaluation)", () => {
  it("has a broad, labeled fixture set", () => {
    expect(categoryFixtures.length).toBeGreaterThanOrEqual(250);
    expect(geographyFixtures.length).toBeGreaterThanOrEqual(250);

    // Every category and every geography bucket is represented.
    const categories = new Set(categoryFixtures.map((f) => f.expectedCategory));
    for (const id of CATEGORY_IDS) {
      expect(categories, `fixtures missing category ${id}`).toContain(id);
    }
    const countries = new Set(geographyFixtures.map((f) => f.expectedGeography));
    const allCountries: Country[] = ["US", "CA", "US_CA", "GLOBAL_NA", "GLOBAL"];
    for (const country of allCountries) {
      expect(countries, `fixtures missing geography ${country}`).toContain(country);
    }
  });

  it(`category accuracy >= ${MIN_HIGH_CONFIDENCE_ACCURACY} on high-confidence examples`, () => {
    const result = evaluate(categoryFixtures, (f) => f.highConfidence, runCategory);
    report("category", result);
    expect(result.highTotal).toBeGreaterThan(0);
    expect(result.highPass / result.highTotal).toBeGreaterThanOrEqual(
      MIN_HIGH_CONFIDENCE_ACCURACY,
    );
  });

  it(`geography accuracy >= ${MIN_HIGH_CONFIDENCE_ACCURACY} on high-confidence examples`, () => {
    const result = evaluate(geographyFixtures, (f) => f.highConfidence, runGeography);
    report("geography", result);
    expect(result.highTotal).toBeGreaterThan(0);
    expect(result.highPass / result.highTotal).toBeGreaterThanOrEqual(
      MIN_HIGH_CONFIDENCE_ACCURACY,
    );
  });

  it(`content-type accuracy >= ${MIN_HIGH_CONFIDENCE_ACCURACY} on high-confidence examples`, () => {
    // Fixture breadth: every content type is represented.
    const types = new Set(contentTypeFixtures.map((f) => f.expectedContentType));
    const allTypes: ContentType[] = ["news", "opinion", "analysis", "press_release", "live"];
    for (const type of allTypes) {
      expect(types, `fixtures missing content type ${type}`).toContain(type);
    }
    expect(contentTypeFixtures.length).toBeGreaterThanOrEqual(60);

    const result = evaluate(contentTypeFixtures, (f) => f.highConfidence, runContentType);
    report("content-type", result);
    expect(result.highTotal).toBeGreaterThan(0);
    expect(result.highPass / result.highTotal).toBeGreaterThanOrEqual(
      MIN_HIGH_CONFIDENCE_ACCURACY,
    );
  });

  it("classifies the audit's live failures correctly (regression)", () => {
    // 1. NPR/BBC/CBS "kidnapped in Niger" coverage all landed in technology
    //    ("app" matched inside "kidnapped").
    const niger = classifyCategory({
      title: "U.S. missionary who was kidnapped in Niger is released",
    });
    expect(niger.primary).toBe("world");

    // 2. Neuroscientist/pop-concerts opinion piece landed in technology.
    const concerts = classifyCategory({
      title:
        "I'm a neuroscientist. Here's why our brains need pop concerts | Bala Subramaniam",
    });
    expect(concerts.primary).not.toBe("technology");
    expect(["culture", "science"]).toContain(concerts.primary);

    // 3. Kelce/Swift wedding coverage landed in business ("shares" as a verb).
    const wedding = classifyCategory({
      title: "Travis Kelce and Taylor Swift wedding: everything we know so far",
      description:
        "The pop superstar and the Chiefs tight end shared details about the ceremony.",
    });
    expect(wedding.primary).not.toBe("business");
    expect(["culture", "sports"]).toContain(wedding.primary);

    // 4. Nigerian-vultures nature story landed in technology
    //    ("app" matched inside "disappearing"). The audit's point is the
    //    NEGATIVE: never technology. world (Nigeria) and science
    //    (scientists) now tie, and ties resolve to the general bucket by
    //    design — any of the three is acceptable.
    const vultures = classifyCategory({
      title: "Nigeria's vultures are disappearing and scientists are worried",
    });
    expect(vultures.primary).not.toBe("technology");
    expect(["world", "science", "general"]).toContain(vultures.primary);

    // 5. European transfer coverage classified CA ("premier" matched
    //    "Premier League"; GNews country=ca alone decided the country).
    const transfer = { title: "Transfer rumors, news: Arsenal hold talks over Osimhen deal" };
    expect(classifyGeography(transfer)).toBe("GLOBAL");
    expect(
      classifyGeography({
        ...transfer,
        description:
          "The latest Premier League transfer news, with clubs across Europe chasing summer deals.",
        providerCountry: "ca",
      }),
    ).toBe("GLOBAL");
  });
});
