import { env } from "@/lib/env";
import type { NewsProvider, RawArticle } from "@/lib/news/types";

/**
 * RSS adapter for official publisher feeds where syndication is permitted.
 * Configure feed URLs via the RSS_FEEDS env var (comma-separated).
 * Uses a small dependency-free XML item parser — RSS 2.0 and Atom.
 */

export const rssProvider: NewsProvider = {
  name: "rss",

  isConfigured() {
    return env.rssFeeds.length > 0;
  },

  async fetchLatest(): Promise<RawArticle[]> {
    const feeds = env.rssFeeds;
    if (feeds.length === 0) return [];

    const results = await Promise.allSettled(
      feeds.map((feedUrl) => fetchFeed(feedUrl)),
    );
    const articles: RawArticle[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") articles.push(...result.value);
    }
    return articles;
  },
};

async function fetchFeed(feedUrl: string): Promise<RawArticle[]> {
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

  return parseItems(xml).map((item) => ({
    ...item,
    source: channelTitle,
    sourceDomain: item.url ? hostnameOf(item.url) : parsed.hostname,
    provider: "rss",
  }));
}

interface ParsedItem {
  title: string;
  description?: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export function parseItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];

  for (const block of blocks.slice(0, 100)) {
    const title = firstTag(block, "title");
    const link =
      firstTag(block, "link") ??
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    const pubDate =
      firstTag(block, "pubDate") ??
      firstTag(block, "published") ??
      firstTag(block, "updated") ??
      firstTag(block, "dc:date");
    if (!title || !link || !pubDate) continue;

    const description =
      firstTag(block, "description") ?? firstTag(block, "summary");
    const imageUrl =
      block.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1] ??
      block.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i)?.[1] ??
      block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i)?.[1];

    items.push({
      title: decodeEntities(title),
      description: description ? decodeEntities(description) : undefined,
      url: decodeEntities(link.trim()),
      publishedAt: new Date(pubDate.trim()).toISOString(),
      imageUrl,
    });
  }
  return items;
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
