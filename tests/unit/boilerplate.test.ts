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

describe("cleanDescription strips Guardian closure and teaser chrome (R9 audit)", () => {
  it("empties the live-blog closure notice served as an entire description", () => {
    // Live-captured 2026-08-18: a story's <meta name=description> was
    // EXACTLY this string.
    expect(cleanDescription("This blog is now closed.", "theguardian.com")).toBe("");
    // The general shape, publisher-agnostic (sentence-anchored).
    expect(cleanDescription("This live blog has closed.")).toBe("");
  });

  it("keeps a sentence that merely mentions a closed blog mid-sentence", () => {
    const text = "Readers asked why this blog is now closed on weekends.";
    expect(cleanDescription(text)).toBe(text);
  });

  it("strips First Thing teaser sentences from homepage card text", () => {
    // Live-captured shape: "Plus: the Italian nuns… Don't already get First
    // Thing in your inbox?" trailing a real summary sentence.
    expect(
      cleanDescription(
        "Trump orders review of national guard deployment. " +
          "Plus: the Italian nuns who refused to leave their convent. " +
          "Don't already get First Thing in your inbox? Sign up here.",
        "theguardian.com",
      ),
    ).toBe("Trump orders review of national guard deployment.");
  });

  it("strips teaser and live-blog chrome from flat Guardian text", () => {
    // No block boundaries at all — only the domain-scoped patterns can see
    // the chrome here.
    const flat =
      "UK inflation eases to 3.2% Business live – latest updates Don't already get First Thing in your inbox? The ONS said prices rose more slowly in July.";
    expect(cleanDescription(flat, "theguardian.com")).toBe(
      "UK inflation eases to 3.2% The ONS said prices rose more slowly in July.",
    );
  });

  it("keeps a mid-sentence 'plus' untouched", () => {
    const text = "The deal adds 4,000 jobs plus a new research campus in Waterloo.";
    expect(cleanDescription(text, "theguardian.com")).toBe(text);
  });

  it("is idempotent on the closure and teaser fixtures", () => {
    const once = cleanDescription(
      "Plus: the Italian nuns who refused to leave their convent. " +
        "This blog is now closed. The minister spoke to reporters this morning.",
      "theguardian.com",
    );
    expect(once).toBe("The minister spoke to reporters this morning.");
    expect(cleanDescription(once, "theguardian.com")).toBe(once);
  });
});

describe("cleanDescription drops SHOUTED legal disclaimers (R9 audit)", () => {
  // Live-captured SEDAR+ prospectus disclaimer shape from a wire release.
  const LEGAL =
    "THE PROSPECTUS SUPPLEMENT, THE CORRESPONDING BASE SHELF PROSPECTUS AND ANY AMENDMENT THERETO ARE AVAILABLE ON SEDAR+ AT WWW.SEDARPLUS.CA.";

  it("drops a long all-caps legal sentence, wherever it sits", () => {
    expect(LEGAL.length).toBeGreaterThan(80);
    expect(
      cleanDescription(`The company closed its financing round. ${LEGAL}`),
    ).toBe("The company closed its financing round.");
    expect(cleanDescription(`${LEGAL} The company closed its financing round.`)).toBe(
      "The company closed its financing round.",
    );
    expect(cleanDescription(LEGAL)).toBe("");
  });

  it("keeps short acronym-dense sentences under the length floor", () => {
    const acronyms = "NASA, NATO and NORAD announced a joint AI plan.";
    expect(cleanDescription(acronyms)).toBe(acronyms);
  });

  it("keeps long normal-case sentences", () => {
    const long =
      "Officials said the agreement, reached after months of negotiation between the two governments, will take effect next spring.";
    expect(long.length).toBeGreaterThan(80);
    expect(cleanDescription(long)).toBe(long);
  });
});

describe("cleanDescription strips newsletter-digest chrome (The Hill)", () => {
  // Real thehill.com/homenews/feed/ CDATA after entity decoding — the RSS
  // provider decodes &#8202; to a U+200A hair space and &#038; to "&"
  // before normalization, so the fixtures carry the real code points.
  const DEFENSE_DIGEST =
    "Welcome to The Hill's Defense & NatSec newsletter {beacon} " +
    "Defense &National Security Defense &National Security   " +
    "The Big Story  Amid reports of low morale, USS Abraham Lincoln " +
    "returning home, Navy says Acting Navy Secretary Hung Cao announced " +
    "on Friday that the USS Abraham Lincoln is returning to the U.S. " +
    "as the aircraft carrier's long deployment...";

  const HEALTHCARE_DIGEST =
    "Click in for more news from The Hill {beacon} Healthcare   " +
    "The Big Story  Trump admin escalates fight against transgender " +
    "care ...   © Photo credit The moves this week add to...";

  it("cleans the defense digest down to the real story", () => {
    const cleaned = cleanDescription(DEFENSE_DIGEST, "thehill.com");
    expect(cleaned.startsWith("Amid reports of low morale")).toBe(true);
    for (const chrome of ["Welcome to", "{beacon}", "The Big Story"]) {
      expect(cleaned).not.toContain(chrome);
    }
    expect(cleaned).toContain(
      "returning to the U.S. as the aircraft carrier's long deployment",
    );
  });

  it("cleans the healthcare digest including header echoes and photo credit", () => {
    const cleaned = cleanDescription(HEALTHCARE_DIGEST, "thehill.com");
    expect(cleaned.startsWith("Trump admin escalates")).toBe(true);
    for (const chrome of [
      "Click in",
      "{beacon}",
      "Healthcare",
      "The Big Story",
      "Photo credit",
    ]) {
      expect(cleaned).not.toContain(chrome);
    }
  });

  it("cleans digests generically, without a domain rule", () => {
    // The chrome detection is structural (tokens, typographic spaces,
    // greeting openers) — it must not depend on knowing the publisher.
    expect(cleanDescription(DEFENSE_DIGEST)).toBe(
      cleanDescription(DEFENSE_DIGEST, "thehill.com"),
    );
  });

  it("is idempotent on digest fixtures", () => {
    for (const fixture of [DEFENSE_DIGEST, HEALTHCARE_DIGEST]) {
      const once = cleanDescription(fixture, "thehill.com");
      expect(cleanDescription(once, "thehill.com")).toBe(once);
    }
  });

  it("keeps a real news sentence about a newsletter launch", () => {
    const text = "The Atlantic launched a daily newsletter on Monday.";
    expect(cleanDescription(text, "thehill.com")).toBe(text);
  });

  it("keeps a 'Welcome to' lead without a newsletter keyword", () => {
    const text =
      "Welcome to the new era of flight. Boarding will never look the same.";
    expect(cleanDescription(text)).toBe(text);
  });

  it("preserves a lone non-breaking space inside a sentence", () => {
    const text =
      "Organizers said the relief fund reached 10 000 kronor overnight.";
    expect(cleanDescription(text)).toBe(text);
  });

  it("normalizeArticle serves the cleaned digest description end to end", () => {
    const NOW = new Date("2026-08-14T12:00:00Z");
    const raw: RawArticle = {
      title: "Defense & NatSec — USS Abraham Lincoln returning home",
      description: DEFENSE_DIGEST,
      url: "https://thehill.com/newsletters/defense-natsec/1234567-uss-abraham-lincoln/",
      source: "The Hill",
      publishedAt: new Date(NOW.getTime() - 3_600_000).toISOString(),
      provider: "rss",
    };
    const article = normalizeArticle(raw, NOW)!;
    expect(article.description!.startsWith("Amid reports of low morale")).toBe(
      true,
    );
    expect(article.description).not.toContain("Welcome to");
    expect(article.description).not.toContain("The Big Story");
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
