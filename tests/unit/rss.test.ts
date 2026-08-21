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

describe("item image extraction", () => {
  it("entity-decodes image URLs and prefers the widest media:content variant", () => {
    const xml = `<rss><channel>
      <item>
        <title>Story with images</title>
        <link>https://example.com/imaged</link>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
        <media:content url="https://img.example.com/a.jpg?width=140&amp;quality=85" width="140" height="84"/>
        <media:content url="https://img.example.com/a.jpg?width=700&amp;quality=85" width="700" height="420"/>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    // The escaped &amp; must become & or publishers reject the URL (502s).
    expect(item.imageUrl).toBe(
      "https://img.example.com/a.jpg?width=700&quality=85",
    );
  });

  it("falls back to media:thumbnail and enclosure images", () => {
    const xml = `<rss><channel>
      <item>
        <title>Thumb story</title>
        <link>https://example.com/thumb</link>
        <pubDate>Wed, 13 Aug 2026 10:00:00 GMT</pubDate>
        <media:thumbnail url="https://img.example.com/t.jpg?a=1&amp;b=2"/>
      </item>
      <item>
        <title>Enclosure story</title>
        <link>https://example.com/enc</link>
        <pubDate>Wed, 13 Aug 2026 09:00:00 GMT</pubDate>
        <enclosure url="https://img.example.com/e.jpg" type="image/jpeg"/>
      </item>
    </channel></rss>`;
    const items = parseItems(xml);
    expect(items[0].imageUrl).toBe("https://img.example.com/t.jpg?a=1&b=2");
    expect(items[1].imageUrl).toBe("https://img.example.com/e.jpg");
  });
});

/**
 * Fallback image shapes, measured live 2026-08-18: CBS carries the story
 * thumbnail ONLY as an item-level <image> child (10/10 items); NPR ONLY as
 * an <img> inside content:encoded (10/10), always trailed by a tracking
 * pixel that must never be promoted to story art; The Verge inside Atom
 * <content type="html">. Real feed items below, trimmed.
 */
describe("fallback image shapes", () => {
  it("extracts the CBS item-level <image> child (real feed item)", () => {
    const xml = `<rss version="2.0"><channel>
      <title>Home - CBSNews.com</title>
      <item>
        <title>Can creditors make an estate sell a house to pay debt?</title>
        <link>https://www.cbsnews.com/news/can-creditors-force-estate-to-sell-house-pay-debt/</link>
        <description>A home isn&#039;t automatically safe from creditors after its owner dies. Here&#039;s when the property could be at risk.</description>
        <pubDate>Tue, 18 Aug 2026 09:09:25 -0400</pubDate>
        <image>https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/0a463caf-4f7b-45aa-b3a1-a2b2e2e40165/thumbnail/60x60/fabe50cfe881763548330d8d6a9e0895/gettyimages-1306118604.jpg</image>
        <guid isPermaLink="false">fc76e11a-6025-4737-a145-2e69329c6685</guid>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe(
      "https://assets1.cbsnewsstatic.com/hub/i/r/2026/08/18/0a463caf-4f7b-45aa-b3a1-a2b2e2e40165/thumbnail/60x60/fabe50cfe881763548330d8d6a9e0895/gettyimages-1306118604.jpg",
    );
  });

  it("extracts the NPR content:encoded img (real feed item), skipping the rss pixel", () => {
    const xml = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0"><channel>
      <item>
        <title>The grueling fight over who profits from AI music</title>
        <description>AI can generate songs in seconds. But behind every AI track is a complicated question: Who should get paid? And, how? The fights have started.</description>
        <pubDate>Tue, 18 Aug 2026 06:30:00 -0400</pubDate>
        <link>https://www.npr.org/sections/planet-money/2026/08/18/g-s1-138852/grueling-fight-over-who-profits-from-ai-music</link>
        <content:encoded><![CDATA[<img src='https://npr.brightspotcdn.com/dims3/default/strip/false/crop/4897x3428+0+0/resize/4897x3428!/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F9d%2F9a%2Fbec4d78a4fb4a3826e4a7363141f%2Fgettyimages-2211085365.jpg' alt='undefined'/><p>AI can generate songs in seconds.</p><img src='https://media.npr.org/include/images/tracking/npr-rss-pixel.png?story=g-s1-138852' />]]></content:encoded>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe(
      "https://npr.brightspotcdn.com/dims3/default/strip/false/crop/4897x3428+0+0/resize/4897x3428!/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2F9d%2F9a%2Fbec4d78a4fb4a3826e4a7363141f%2Fgettyimages-2211085365.jpg",
    );
  });

  it("yields no image when the body has only a broken src and a tracking pixel (real NPR shape)", () => {
    const xml = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0"><channel>
      <item>
        <title>U.S. and Iran miss peace talks deadline. And, Alaska, Florida and Wyoming primaries</title>
        <pubDate>Tue, 18 Aug 2026 07:40:35 -0400</pubDate>
        <link>https://www.npr.org/2026/08/18/g-s1-139072/up-first-newsletter</link>
        <content:encoded><![CDATA[<img src='undefined' alt='President Trump speaks in the Oval Office.'/><p>The U.S. and Iran missed a deadline to begin peace talks this week.</p><img src='https://media.npr.org/include/images/tracking/npr-rss-pixel.png?story=g-s1-139072' />]]></content:encoded>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBeUndefined();
  });

  it("extracts the img from The Verge's Atom content (real entry)", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <title type="text">The Verge</title>
      <entry>
        <title type="html"><![CDATA[Polaroid's new Pokémon collection captures memories, not Pikachus]]></title>
        <link rel="alternate" type="text/html" href="https://www.theverge.com/tech/981141/polaroid-pokemon-pikachu-now-go-generation-3-instant-camera-film" />
        <published>2026-08-18T09:00:00-04:00</published>
        <content type="html"><![CDATA[<figure><img alt="A person standing in grass holds the Polaroid Go Gen 3 instant camera with a bright yellow Pikachu design." data-caption="" data-portal-copyright="Image: Polaroid" data-has-syndication-rights="1" src="https://platform.theverge.com/wp-content/uploads/sites/2/2026/08/polaroid1.jpg?quality=90&#038;strip=all&#038;crop=0,0,100,100" /></figure><p>Polaroid announced a new collection of cameras.</p>]]></content>
      </entry>
    </feed>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe(
      "https://platform.theverge.com/wp-content/uploads/sites/2/2026/08/polaroid1.jpg?quality=90&strip=all&crop=0,0,100,100",
    );
  });

  it("ignores 1x1 pixels, data: URIs and non-https images in description HTML", () => {
    const xml = `<rss><channel>
      <item>
        <title>Pixel story</title>
        <link>https://example.com/pixel</link>
        <pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[<img src="data:image/gif;base64,R0lGOD" /><img src="http://insecure.example.com/photo.jpg" /><img src="https://tracker.example.com/t.gif" width="1" height="1" />]]></description>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBeUndefined();
  });

  it("finds an img in entity-escaped (non-CDATA) description HTML and decodes its URL", () => {
    const xml = `<rss><channel>
      <item>
        <title>Escaped body story</title>
        <link>https://example.com/escaped</link>
        <pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
        <description>&lt;p&gt;Intro&lt;/p&gt;&lt;img src=&quot;https://img.example.com/photo.jpg?w=800&amp;amp;q=80&quot; /&gt;</description>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe("https://img.example.com/photo.jpg?w=800&q=80");
  });

  it("prefers media:content over the <image> child and body img fallbacks", () => {
    const xml = `<rss><channel>
      <item>
        <title>Rich item</title>
        <link>https://example.com/rich</link>
        <pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
        <media:content url="https://img.example.com/media.jpg" width="700" height="420"/>
        <image>https://img.example.com/child.jpg</image>
        <content:encoded><![CDATA[<img src="https://img.example.com/body.jpg" />]]></content:encoded>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe("https://img.example.com/media.jpg");
  });

  it("prefers the <image> child over a body img", () => {
    const xml = `<rss><channel>
      <item>
        <title>Child vs body</title>
        <link>https://example.com/child-vs-body</link>
        <pubDate>Tue, 18 Aug 2026 10:00:00 GMT</pubDate>
        <image>https://img.example.com/child.jpg</image>
        <content:encoded><![CDATA[<img src="https://img.example.com/body.jpg" />]]></content:encoded>
      </item>
    </channel></rss>`;
    const [item] = parseItems(xml);
    expect(item.imageUrl).toBe("https://img.example.com/child.jpg");
  });
});

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
  const originalCurated = process.env.RSS_CURATED_FEEDS;

  afterEach(() => {
    if (originalFeeds === undefined) delete process.env.RSS_FEEDS;
    else process.env.RSS_FEEDS = originalFeeds;
    if (originalCurated === undefined) delete process.env.RSS_CURATED_FEEDS;
    else process.env.RSS_CURATED_FEEDS = originalCurated;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records per-feed counters and isolates a failing feed", async () => {
    // Exactly the two test feeds: the curated list (config/feeds.ts) would
    // otherwise join automatically whenever RSS_FEEDS is set.
    process.env.RSS_CURATED_FEEDS = "off";
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
