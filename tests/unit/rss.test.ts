import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLastFeedHealth,
  parseItems,
  parseItemsWithStats,
  rssProvider,
} from "@/lib/news/providers/rss";

/**
 * RSS parser robustness: malformed items are skipped and counted — one bad
 * item or one dead feed can never reject the rest of the run.
 */

const GOOD_FEED = `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <title>Example Feed</title>
    <item>
      <title>First story &amp; details</title>
      <link>https://example.com/one</link>
      <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[A <b>description</b> here]]></description>
    </item>
    <item>
      <title>Second story</title>
      <link>https://example.com/two</link>
      <pubDate>Wed, 13 Aug 2026 09:00:00 GMT</pubDate>
    </item>
  </channel></rss>`;

describe("parseItemsWithStats robustness", () => {
  it("skips an item with an invalid pubDate while parsing the rest", () => {
    const xml = `<rss><channel>
      <item>
        <title>Good story</title>
        <link>https://example.com/good</link>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Bad date story</title>
        <link>https://example.com/bad</link>
        <pubDate>not a real date</pubDate>
      </item>
      <item>
        <title>Another good story</title>
        <link>https://example.com/good-2</link>
        <pubDate>Wed, 13 Aug 2026 08:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const { items, skipped } = parseItemsWithStats(xml);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(items.map((i) => i.url)).toEqual([
      "https://example.com/good",
      "https://example.com/good-2",
    ]);
  });

  it("skips items missing a link or a date", () => {
    const xml = `<rss><channel>
      <item>
        <title>No link</title>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>No date</title>
        <link>https://example.com/no-date</link>
      </item>
      <item>
        <title>Complete</title>
        <link>https://example.com/complete</link>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const { items, skipped } = parseItemsWithStats(xml);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/complete");
    expect(skipped).toBe(2);
  });

  it("parses RSS 2.0 items with CDATA and entities", () => {
    const { items, skipped } = parseItemsWithStats(GOOD_FEED);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(0);
    expect(items[0].title).toBe("First story & details");
    expect(items[0].description).toBe("A <b>description</b> here");
    expect(new Date(items[0].publishedAt).getUTCHours()).toBe(10);
  });

  it("parses Atom entries", () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Atom Feed</title>
        <entry>
          <title>Atom story headline</title>
          <link href="https://example.com/atom-one"/>
          <updated>2026-08-13T10:30:00Z</updated>
        </entry>
      </feed>`;
    const { items, skipped } = parseItemsWithStats(xml);
    expect(items).toHaveLength(1);
    expect(skipped).toBe(0);
    expect(items[0].url).toBe("https://example.com/atom-one");
  });

  it("keeps the backward-compatible parseItems wrapper working", () => {
    expect(parseItems(GOOD_FEED)).toHaveLength(2);
  });
});

describe("rssProvider feed health", () => {
  const originalFeeds = process.env.RSS_FEEDS;

  afterEach(() => {
    if (originalFeeds === undefined) delete process.env.RSS_FEEDS;
    else process.env.RSS_FEEDS = originalFeeds;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records per-feed counters and isolates a failing feed", async () => {
    process.env.RSS_FEEDS =
      "https://good.example.com/rss,https://down.example.com/rss";
    const badFeed = `<rss><channel>
      <title>Mixed Feed</title>
      <item>
        <title>Fine</title>
        <link>https://good.example.com/a</link>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Broken date</title>
        <link>https://good.example.com/b</link>
        <pubDate>garbage</pubDate>
      </item>
    </channel></rss>`;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("https://good.example.com")) {
          return new Response(badFeed, { status: 200 });
        }
        return new Response("nope", { status: 503 });
      }),
    );

    const articles = await rssProvider.fetchLatest();
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe("https://good.example.com/a");

    const health = getLastFeedHealth();
    expect(health).toHaveLength(2);
    expect(health[0]).toMatchObject({
      url: "https://good.example.com/rss",
      ok: true,
      itemsParsed: 1,
      itemsSkipped: 1,
    });
    expect(health[1]).toMatchObject({
      url: "https://down.example.com/rss",
      ok: false,
      itemsParsed: 0,
      itemsSkipped: 0,
    });
    expect(health[1].error).toContain("503");
    // The failure was logged, not silently dropped.
    expect(console.warn).toHaveBeenCalled();
  });
});
