import { feedCategoryPrior } from "@/config/categories";
import { env } from "@/lib/env";
import type { FeedHealth, NewsProvider, RawArticle } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";

/**
 * RSS adapter for official publisher feeds where syndication is permitted.
 * Configure feed URLs via the RSS_FEEDS env var (comma-separated).
 * Uses a small dependency-free XML item parser — RSS 2.0 and Atom.
 *
 * Robustness rules: a malformed item (bad/missing date, missing link or
 * title) is skipped and counted — it never rejects the whole feed. A failed
 * feed is logged and recorded in per-feed health, never silently dropped.
 */

/** Last-run per-feed health, refreshed on every fetchLatest() call. */
let lastFeedHealth: FeedHealth[] = [];

export function getLastFeedHealth(): FeedHealth[] {
  return lastFeedHealth;
}

export const rssProvider: NewsProvider = {
  name: "rss",

  isConfigured() {
    return env.rssFeeds.length > 0;
  },

  async fetchLatest(): Promise<RawArticle[]> {
    const feeds = env.rssFeeds;
    if (feeds.length === 0) {
      lastFeedHealth = [];
      return [];
    }

    // One health row per configured feed, in configured order.
    const health: FeedHealth[] = new Array(feeds.length);
    const results = await Promise.allSettled(
      feeds.map(async (feedUrl, index) => {
        const started = Date.now();
        try {
          const result = await fetchFeed(feedUrl);
          health[index] = {
            url: feedUrl,
            ok: true,
            itemsParsed: result.articles.length,
            itemsSkipped: result.skipped,
            durationMs: Date.now() - started,
          };
          return result.articles;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          logger.warn("rss.feed_failed", { url: feedUrl, error: message });
          health[index] = {
            url: feedUrl,
            ok: false,
            itemsParsed: 0,
            itemsSkipped: 0,
            error: message,
            durationMs: Date.now() - started,
          };
          throw error;
        }
      }),
    );
    lastFeedHealth = health;

    const articles: RawArticle[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") articles.push(...result.value);
    }
    return articles;
  },
};

async function fetchFeed(
  feedUrl: string,
): Promise<{ articles: RawArticle[]; skipped: number }> {
  const parsed = new URL(feedUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported feed protocol: ${parsed.protocol}`);
  }

  const response = await fetch(feedUrl, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
    headers: { "User-Agent": "CurrentWire/1.0 (news aggregator)" },
  });
  if (!response.ok) throw new Error(`Feed ${parsed.hostname} responded ${response.status}`);

  const xml = await response.text();
  const channelTitle =
    firstTag(xml.split(/<item[\s>]/i)[0] ?? "", "title") ?? parsed.hostname;

  const { items, skipped } = parseItemsWithStats(xml);
  return {
    articles: items.map((item) => {
      const sourceDomain = item.url ? hostnameOf(item.url) : parsed.hostname;
      // Feed-section prior (espn.com → sports etc.) — a weak classifier
      // nudge carried as providerCategory with the prior flag set.
      const prior =
        feedCategoryPrior(sourceDomain) ?? feedCategoryPrior(parsed.hostname);
      return {
        ...item,
        source: channelTitle,
        sourceDomain,
        provider: "rss",
        ...(prior
          ? { providerCategory: prior, providerCategoryIsPrior: true }
          : {}),
      };
    }),
    skipped,
  };
}

interface ParsedItem {
  title: string;
  description?: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

/** Backward-compatible wrapper: parsed items only, skip counts discarded. */
export function parseItems(xml: string): ParsedItem[] {
  return parseItemsWithStats(xml).items;
}

/**
 * Parse RSS 2.0 <item> or Atom <entry> blocks. A malformed block (missing
 * title/link/date, unparseable date, or anything that throws) is skipped and
 * counted — one bad item can never reject the rest of the feed.
 */
export function parseItemsWithStats(xml: string): {
  items: ParsedItem[];
  skipped: number;
} {
  const items: ParsedItem[] = [];
  let skipped = 0;
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];

  for (const block of blocks.slice(0, 100)) {
    try {
      const title = firstTag(block, "title");
      const link =
        firstTag(block, "link") ??
        block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
      const pubDate =
        firstTag(block, "pubDate") ??
        firstTag(block, "published") ??
        firstTag(block, "updated") ??
        firstTag(block, "dc:date");
      if (!title || !link || !pubDate) {
        skipped++;
        continue;
      }

      // An invalid date must skip this item, never throw out of the loop.
      const published = new Date(pubDate.trim());
      if (Number.isNaN(published.getTime())) {
        skipped++;
        continue;
      }

      const description =
        firstTag(block, "description") ?? firstTag(block, "summary");
      const imageUrl = bestImageUrl(block);

      items.push({
        title: decodeEntities(title),
        description: description ? decodeEntities(description) : undefined,
        url: decodeEntities(link.trim()),
        publishedAt: published.toISOString(),
        ...(imageUrl ? { imageUrl } : {}),
      });
    } catch {
      skipped++;
    }
  }
  return { items, skipped };
}

/**
 * Best article image from a feed item block. Feeds often carry several
 * media:content variants (The Guardian lists a 140px thumbnail first) —
 * pick the widest one. Attribute values are XML-escaped in the source
 * (&amp; between query params), so the winner must be entity-decoded or
 * publishers reject the URL and the image optimizer returns 502.
 */
function bestImageUrl(block: string): string | undefined {
  let best: { url: string; width: number } | undefined;
  for (const tag of ["media:content", "media:thumbnail"]) {
    const escaped = tag.replace(":", "\\:");
    for (const m of block.matchAll(
      new RegExp(`<${escaped}[^>]*url=["']([^"']+)["'][^>]*>`, "gi"),
    )) {
      const width = Number(m[0].match(/width=["'](\d+)["']/i)?.[1] ?? 0);
      if (!best || width > best.width) best = { url: m[1], width };
    }
    if (best) break;
  }
  const url =
    best?.url ??
    block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)?.[1];
  return url ? decodeEntities(url.trim()) : undefined;
}

function firstTag(block: string, tag: string): string | undefined {
  const escaped = tag.replace(":", "\\:");
  const match = block.match(
    new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, "i"),
  );
  if (!match) return undefined;
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
