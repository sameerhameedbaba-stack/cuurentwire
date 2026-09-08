import { describe, expect, it } from "vitest";

import {
  MIN_READ_RATIO,
  ORPHAN_SECTION,
  appendHistory,
  articleSectionFrom,
  formatOrphanReport,
  previousRow,
  sitemapLocs,
  summarizeSections,
} from "../../scripts/general-orphan-lib.mjs";

const ldScript = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

describe("articleSectionFrom", () => {
  it("reads articleSection from a story page's NewsArticle block", () => {
    const html = `<head>${ldScript({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      articleSection: "Politics",
    })}</head>`;
    expect(articleSectionFrom(html)).toBe("Politics");
  });

  it("finds NewsArticle when the page also carries BreadcrumbList", () => {
    // The real shape of a /story/ page, verified live 2026-09-09: two
    // separate ld+json blocks, BreadcrumbList emitted before the article on
    // some routes.
    const html =
      ldScript({ "@type": "BreadcrumbList", itemListElement: [] }) +
      ldScript({ "@type": "NewsArticle", articleSection: "General" });
    expect(articleSectionFrom(html)).toBe("General");
  });

  it("handles an array block and a @graph block", () => {
    expect(
      articleSectionFrom(ldScript([{ "@type": "WebSite" }, { "@type": "NewsArticle", articleSection: "Sports" }])),
    ).toBe("Sports");
    expect(
      articleSectionFrom(ldScript({ "@graph": [{ "@type": "NewsArticle", articleSection: "Health" }] })),
    ).toBe("Health");
  });

  it("accepts NewsArticle declared as one of several @type values", () => {
    expect(
      articleSectionFrom(ldScript({ "@type": ["Article", "NewsArticle"], articleSection: "World" })),
    ).toBe("World");
  });

  it("skips an unparseable block instead of failing the page", () => {
    const html =
      `<script type="application/ld+json">{ not json </script>` +
      ldScript({ "@type": "NewsArticle", articleSection: "Culture" });
    expect(articleSectionFrom(html)).toBe("Culture");
  });

  it("returns null rather than guessing when there is no NewsArticle", () => {
    expect(articleSectionFrom(ldScript({ "@type": "BreadcrumbList" }))).toBeNull();
    expect(articleSectionFrom("<html><body>no structured data</body></html>")).toBeNull();
    expect(articleSectionFrom("")).toBeNull();
  });

  it("does not run past the closing quote of a nearby attribute", () => {
    // The 2026-09-08 defect this parser exists to avoid: a greedy regex
    // reading `content="..."` swallowed the rest of the document. A page
    // whose visible copy mentions articleSection must still read null.
    const html = `<meta name="description" content="Our articleSection: General, allegedly"><p>articleSection: Sports</p>`;
    expect(articleSectionFrom(html)).toBeNull();
  });
});

describe("sitemapLocs", () => {
  it("returns loc values in document order, deduplicated", () => {
    const xml = `<urlset>
      <url><loc>https://currentwire.us/story/a-c1</loc></url>
      <url><loc>https://currentwire.us/story/b-c2</loc></url>
      <url><loc>https://currentwire.us/story/a-c1</loc></url>
    </urlset>`;
    expect(sitemapLocs(xml)).toEqual([
      "https://currentwire.us/story/a-c1",
      "https://currentwire.us/story/b-c2",
    ]);
  });

  it("is empty for an empty or missing document", () => {
    expect(sitemapLocs("<urlset></urlset>")).toEqual([]);
    expect(sitemapLocs(undefined)).toEqual([]);
  });
});

describe("summarizeSections", () => {
  const readings = (sections: (string | null)[]) =>
    sections.map((section, i) => ({ url: `https://currentwire.us/story/s-${i}`, section }));

  it("reports the orphan share over the pages actually read", () => {
    const summary = summarizeSections(readings(["General", "Politics", "Sports", "General"]));
    expect(summary.read).toBe(4);
    expect(summary.orphans).toBe(2);
    expect(summary.generalOrphanPct).toBe(50);
    expect(summary.measured).toBe(true);
  });

  it("folds the JSON-LD's 'General' onto the config's lowercase id", () => {
    const summary = summarizeSections(readings(["General", "general"]));
    expect(summary.sections).toEqual([{ id: ORPHAN_SECTION, count: 2 }]);
    expect(summary.orphans).toBe(2);
  });

  it("orders sections by count, ties broken by id, so two runs agree", () => {
    const summary = summarizeSections(readings(["sports", "politics", "sports", "business"]));
    expect(summary.sections).toEqual([
      { id: "sports", count: 2 },
      { id: "business", count: 1 },
      { id: "politics", count: 1 },
    ]);
  });

  it("keeps the corpus size as the denominator for readPct, not the readings", () => {
    // Four URLs in the sitemap, one page unreadable: the rate is over the
    // three that answered, but the run still knows it attempted four.
    const summary = summarizeSections(readings(["General", "Politics", "Sports", null]), 4);
    expect(summary.attempted).toBe(4);
    expect(summary.read).toBe(3);
    expect(summary.unread).toBe(1);
    expect(summary.readPct).toBe(75);
    expect(summary.generalOrphanPct).toBe(33.3);
  });

  it("is NOT measured when too few pages answered", () => {
    const sections = Array.from({ length: 10 }, (_, i) => (i < 8 ? "General" : null));
    const summary = summarizeSections(readings(sections), 10);
    expect(summary.readPct).toBe(80);
    expect(summary.measured).toBe(false);
  });

  it("is measured exactly at the floor, not one page above it", () => {
    const sections = Array.from({ length: 10 }, (_, i) => (i < MIN_READ_RATIO * 10 ? "General" : null));
    expect(summarizeSections(readings(sections), 10).measured).toBe(true);
  });

  it("reports an unknown rate as null, never as zero", () => {
    const summary = summarizeSections([], 0);
    expect(summary.generalOrphanPct).toBeNull();
    expect(summary.measured).toBe(false);
  });
});

describe("appendHistory", () => {
  const row = (measuredAt: string, pct: number, measured = true) => ({
    measuredAt,
    generalOrphanPct: pct,
    measured,
  });

  it("appends a measured row and keeps the series in time order", () => {
    const history = appendHistory([row("2026-09-09T02:00:00Z", 20)], row("2026-09-08T02:00:00Z", 25));
    expect(history.map((r) => r.measuredAt)).toEqual([
      "2026-09-08T02:00:00Z",
      "2026-09-09T02:00:00Z",
    ]);
  });

  it("keeps two readings from the same day as two facts", () => {
    const history = appendHistory([row("2026-09-09T02:00:00Z", 20)], row("2026-09-09T20:00:00Z", 28));
    expect(history).toHaveLength(2);
  });

  it("refuses to write an unmeasured run into the series", () => {
    const existing = [row("2026-09-09T02:00:00Z", 20)];
    expect(appendHistory(existing, row("2026-09-09T20:00:00Z", 0, false))).toEqual(existing);
  });

  it("replaces a row with the same timestamp rather than duplicating it", () => {
    const history = appendHistory([row("2026-09-09T02:00:00Z", 20)], row("2026-09-09T02:00:00Z", 22));
    expect(history).toHaveLength(1);
    expect(history[0].generalOrphanPct).toBe(22);
  });

  it("starts a series from nothing", () => {
    expect(appendHistory(undefined, row("2026-09-09T02:00:00Z", 20))).toHaveLength(1);
  });
});

describe("previousRow", () => {
  it("returns the newest measured row strictly before the given time", () => {
    const history = [
      { measuredAt: "2026-09-07T02:00:00Z", generalOrphanPct: 30, measured: true },
      { measuredAt: "2026-09-08T02:00:00Z", generalOrphanPct: 25, measured: true },
      { measuredAt: "2026-09-09T02:00:00Z", generalOrphanPct: 20, measured: true },
    ];
    expect(previousRow(history, "2026-09-09T02:00:00Z")?.generalOrphanPct).toBe(25);
  });

  it("ignores unmeasured rows", () => {
    const history = [
      { measuredAt: "2026-09-07T02:00:00Z", generalOrphanPct: 30, measured: true },
      { measuredAt: "2026-09-08T02:00:00Z", generalOrphanPct: null, measured: false },
    ];
    expect(previousRow(history, "2026-09-09T02:00:00Z")?.measuredAt).toBe("2026-09-07T02:00:00Z");
  });

  it("is null when the series is empty, so no delta can be invented", () => {
    expect(previousRow([], "2026-09-09T02:00:00Z")).toBeNull();
  });
});

describe("formatOrphanReport", () => {
  it("prints the denominator next to the rate", () => {
    const summary = summarizeSections(
      [
        { url: "a", section: "General" },
        { url: "b", section: "Politics" },
      ],
      2,
    );
    const report = formatOrphanReport(summary);
    expect(report).toContain("generalOrphanPct: 50%");
    // The count and the denominator must not be readable as one another:
    // the first live run printed "168 of 727 story pages read" when 727
    // were read and 168 were general.
    expect(report).toContain("1 general of 2 story pages read");
    expect(report).toContain("0 unread of 2 in the corpus");
    expect(report).toContain("first measured row");
  });

  it("marks the orphan bucket as the noindex one", () => {
    const summary = summarizeSections([{ url: "a", section: "General" }], 1);
    expect(formatOrphanReport(summary)).toContain("orphan bucket, noindex");
  });

  it("reports a delta against the previous row", () => {
    const summary = summarizeSections(
      [
        { url: "a", section: "General" },
        { url: "b", section: "Politics" },
        { url: "c", section: "Sports" },
        { url: "d", section: "World" },
      ],
      4,
    );
    const report = formatOrphanReport(summary, {
      measuredAt: "2026-09-08T02:00:00Z",
      generalOrphanPct: 20,
      measured: true,
    });
    expect(report).toContain("+5 pts");
  });

  it("says nothing was measured instead of printing a rate", () => {
    const summary = summarizeSections([{ url: "a", section: null }], 1);
    const report = formatOrphanReport(summary);
    expect(report).toContain("NOT MEASURED");
    expect(report).not.toContain("generalOrphanPct:");
  });

  it("names what the unread pages did, so the cause is not a guess", () => {
    const summary = summarizeSections([{ url: "a", section: null }], 1);
    const report = formatOrphanReport(summary, null, {
      TimeoutError: 12,
      "http 500": 4,
    });
    // Most frequent first: the tally is read to decide what to fix.
    expect(report).toMatch(/TimeoutError: 12[\s\S]*http 500: 4/);
  });

  it("omits the tally rather than printing an empty heading", () => {
    const summary = summarizeSections([{ url: "a", section: null }], 1);
    expect(formatOrphanReport(summary, null, {})).not.toContain("what the unread pages did");
  });
});
