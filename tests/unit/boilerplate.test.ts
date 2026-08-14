import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  cleanDisplayTitle,
} from "@/lib/news/normalization/boilerplate";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import type { RawArticle } from "@/lib/news/types";

/**
 * Boilerplate cleaning (Stage C audit fix): publisher CMS chrome — newsletter
 * calls-to-action, "Continue reading…", byline-pipe title suffixes — must
 * never reach displayed summaries or titles. All example texts are synthetic
 * Guardian-style constructions.
 */

describe("cleanDescription", () => {
  it("strips trailing newsletter sign-up and continue-reading sentences", () => {
    expect(
      cleanDescription(
        "Utility crews worked through the night as high winds toppled lines. " +
          "Sign up for the Breaking News US email. Continue reading...",
      ),
    ).toBe("Utility crews worked through the night as high winds toppled lines.");
  });

  it("strips a leading subscribe sentence", () => {
    expect(
      cleanDescription(
        "Subscribe to our morning briefing for the day's top stories. " +
          "The council voted to expand the bike-lane network downtown.",
      ),
    ).toBe("The council voted to expand the bike-lane network downtown.");
  });

  it("strips live-blog follow prompts and click-here chrome", () => {
    expect(
      cleanDescription(
        "Follow our live blog for the latest developments. " +
          "Officials confirmed the bridge will stay closed through the weekend. " +
          "Click here for road closure maps.",
      ),
    ).toBe("Officials confirmed the bridge will stay closed through the weekend.");
  });

  it("strips Guardian-style photograph credits", () => {
    expect(
      cleanDescription(
        "Residents surveyed the flood damage on Tuesday morning. " +
          "Photograph: Newswire Contributor/Example Images",
      ),
    ).toBe("Residents surveyed the flood damage on Tuesday morning.");
  });

  it("drops a trailing fragment without terminal punctuation", () => {
    expect(
      cleanDescription("The inquiry's final report lands next week. Continue reading"),
    ).toBe("The inquiry's final report lands next week.");
  });

  it("returns empty when the whole description is boilerplate", () => {
    expect(cleanDescription("Sign up for our free daily newsletter.")).toBe("");
  });

  it("never touches real sentences that merely mention signing up", () => {
    const text =
      "Officials asked residents to sign up for emergency alerts as the storm approached.";
    expect(cleanDescription(text)).toBe(text);
  });
});

describe("cleanDisplayTitle", () => {
  it("strips a byline-pipe author suffix", () => {
    expect(
      cleanDisplayTitle(
        "Our brains need more live music, not less | Priya Raghavan",
      ),
    ).toBe("Our brains need more live music, not less");
  });

  it("keeps section-label pipe suffixes", () => {
    const title = "Manchester derby ends level as title race tightens | Premier League";
    expect(cleanDisplayTitle(title)).toBe(title);
  });

  it("keeps titles without a pipe unchanged", () => {
    const title = "Storm knocks out power to thousands across the region";
    expect(cleanDisplayTitle(title)).toBe(title);
  });
});

describe("normalizeArticle applies cleaning before truncation", () => {
  const NOW = new Date("2026-08-14T12:00:00Z");

  it("cleans description, strips the byline pipe, and still detects opinion", () => {
    const raw: RawArticle = {
      title: "The four-day week is working. Politicians should catch up | Dana Whitfield",
      description:
        "Trial programs keep reporting higher productivity and lower burnout. " +
        "Sign up for the First Edition newsletter. Continue reading...",
      url: "https://www.theguardian.com/commentisfree/2026/aug/13/synthetic",
      source: "The Guardian",
      publishedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
      provider: "rss",
    };
    const article = normalizeArticle(raw, NOW)!;
    // Display title loses the byline pipe…
    expect(article.title).toBe(
      "The four-day week is working. Politicians should catch up",
    );
    // …but the raw title already classified the piece as opinion.
    expect(article.contentType).toBe("opinion");
    expect(article.description).toBe(
      "Trial programs keep reporting higher productivity and lower burnout.",
    );
  });
});
