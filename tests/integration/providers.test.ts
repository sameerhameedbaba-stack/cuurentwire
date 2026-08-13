import { describe, expect, it } from "vitest";
import { generateMockArticles } from "@/lib/news/providers/mock";
import { parseItems } from "@/lib/news/providers/rss";
import { normalizeArticle } from "@/lib/news/normalization/normalize";

describe("mock provider", () => {
  it("produces articles that all survive normalization", () => {
    const now = new Date();
    const raws = generateMockArticles(now);
    expect(raws.length).toBeGreaterThan(50);
    for (const raw of raws) {
      const article = normalizeArticle(raw, now);
      expect(article, `failed: ${raw.title}`).not.toBeNull();
      expect(article!.isMock).toBe(true);
    }
  });

  it("attributes stories only to fictional demo outlets", () => {
    for (const raw of generateMockArticles()) {
      expect(raw.sourceDomain?.endsWith(".demo")).toBe(true);
    }
  });
});

describe("rss provider parsing", () => {
  it("parses RSS 2.0 items into raw articles", () => {
    const xml = `<?xml version="1.0"?>
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
    const items = parseItems(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("First story & details");
    expect(items[0].url).toBe("https://example.com/one");
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
    const items = parseItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/atom-one");
  });

  it("skips malformed items", () => {
    const xml = `<rss><channel><item><title>No link or date</title></item></channel></rss>`;
    expect(parseItems(xml)).toHaveLength(0);
  });
});
