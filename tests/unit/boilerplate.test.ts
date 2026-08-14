import { describe, expect, it } from "vitest";
import type { ArchivedStory } from "@/lib/database/archive";
import {
  cleanDescription,
  cleanDisplayTitle,
} from "@/lib/news/normalization/boilerplate";
import { normalizeArticle } from "@/lib/news/normalization/normalize";
import { resolveStoryRequest } from "@/lib/news/story-resolution";
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

  it("treats newline block boundaries as sentence boundaries", () => {
    // stripHtml preserves </p> and </li> as newlines — the anchored rules
    // must fire on those unpunctuated segments.
    expect(
      cleanDescription(
        "Standfirst without terminal punctuation\n" +
          "Sign up for the Breaking News US email\n" +
          "The minister spoke to reporters this morning.",
      ),
    ).toBe(
      "Standfirst without terminal punctuation The minister spoke to reporters this morning.",
    );
  });

  it("strips Guardian inline sign-up chrome in flat text when the domain matches", () => {
    const flat =
      "Trump asks court to allow ballroom construction Sign up for the Breaking News US email The administration filed its appeal today.";
    expect(cleanDescription(flat, "theguardian.com")).toBe(
      "Trump asks court to allow ballroom construction The administration filed its appeal today.",
    );
    // Without a domain there is no boundary to anchor on — flat text stays
    // untouched, by design (the pattern is publisher-scoped, not global).
    expect(cleanDescription(flat)).toBe(flat);
    // And the Guardian pattern never applies to other publishers.
    expect(cleanDescription(flat, "example.com")).toBe(flat);
  });

  it("keeps real Guardian sentences that merely mention signing up", () => {
    const text =
      "Officials asked residents to sign up for emergency alerts as the storm approached.";
    expect(cleanDescription(text, "theguardian.com")).toBe(text);
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

  it("strips Guardian live-blog list chrome while keeping standfirst and body", () => {
    // Real Guardian US-news live-blog description structure: standfirst
    // <p>, a <ul> of latest-post links including a sign-up CTA, then body.
    const raw: RawArticle = {
      title:
        "Trump administration news live: supreme court asked to allow ballroom construction",
      description:
        "<p>President claims families not worried, despite relatives raising concerns, but confirms USS George Washington will replace aircraft carrier on Iran mission</p>" +
        '<ul><li><p><a href="https://www.theguardian.com/us-news/2026/aug/14/x">Trump administration asks US supreme court to allow construction of White House ballroom</a></p></li>' +
        '<li><p><a href="https://www.theguardian.com/news/2026/feb/17/sign-up-for-the-breaking-news-us-email-x">Sign up for the Breaking News US email</a></p></li></ul>' +
        "<p>The Trump administration, in its appeal to the supreme court today, said that <strong>“this case involves an extraordinary and unlawful injunction”</strong></p>",
      url: "https://www.theguardian.com/us-news/live/2026/aug/14/trump-administration-news",
      source: "The Guardian",
      publishedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
      provider: "rss",
    };
    const article = normalizeArticle(raw, NOW)!;
    expect(article.description).not.toContain("Sign up");
    expect(article.description).not.toContain("Breaking News US email");
    expect(article.description).toContain(
      "confirms USS George Washington will replace aircraft carrier on Iran mission",
    );
    expect(article.description).toContain(
      "Trump administration asks US supreme court to allow construction of White House ballroom",
    );
    expect(article.description).toContain(
      "an extraordinary and unlawful injunction",
    );
  });
});

describe("resolveStoryRequest re-cleans archived summaries at display time", () => {
  // Pre-fix rows persist in the archive forever (the upsert only self-heals
  // stories still in feeds) — the resolver must never serve their chrome.
  const archived: ArchivedStory = {
    clusterId: "clguard0001",
    slug: "trump-ballroom-appeal-clguard0001",
    title: "Trump administration asks supreme court to allow ballroom construction",
    summary:
      "Confirms USS George Washington will replace aircraft carrier on Iran mission Trump administration asks US supreme court to allow construction of White House ballroom Sign up for the Breaking News US email The Trump administration said the injunction was unlawful.",
    category: "politics",
    geography: "US",
    contentType: "news",
    imageUrl: null,
    firstPublishedAt: "2026-08-14T08:00:00.000Z",
    lastPublishedAt: "2026-08-14T09:00:00.000Z",
    firstSeenAt: "2026-08-14T08:05:00.000Z",
    lastModifiedAt: "2026-08-14T09:05:00.000Z",
    rankingScore: 10,
    sourceCount: 1,
    sources: [
      {
        name: "The Guardian",
        domain: "theguardian.com",
        tier: "A",
        url: "https://www.theguardian.com/us-news/live/2026/aug/14/trump-administration-news",
        publishedAt: "2026-08-14T08:00:00.000Z",
        title: "Trump administration news live",
      },
    ],
    entities: [],
    mergedIntoClusterId: null,
  };

  it("strips pre-fix Guardian chrome from an archive-served summary", async () => {
    const result = await resolveStoryRequest(archived.slug, {
      getLive: async () => null,
      getArchived: async (slugOrId) =>
        slugOrId === archived.slug ? archived : null,
    });
    expect(result.kind).toBe("archived");
    if (result.kind !== "archived") return;
    expect(result.story.summary).not.toContain("Sign up");
    expect(result.story.summary).not.toContain("Breaking News US email");
    expect(result.story.summary).toContain(
      "replace aircraft carrier on Iran mission",
    );
    expect(result.story.summary).toContain(
      "The Trump administration said the injunction was unlawful.",
    );
  });

  it("returns already-clean archived stories unchanged", async () => {
    const clean: ArchivedStory = {
      ...archived,
      summary: "The measure now heads to the House.",
    };
    const result = await resolveStoryRequest(clean.slug, {
      getLive: async () => null,
      getArchived: async () => clean,
    });
    expect(result).toEqual({ kind: "archived", story: clean });
  });
});
