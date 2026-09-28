/**
 * RSS 2.0 for original articles.
 *
 * Kept separate from lib/seo/rss.ts, which renders aggregator clusters and
 * credits other publishers as the source of each item. These items are ours:
 * the link is our article, and the description is our standfirst.
 */

import { CATEGORIES } from "@/config/categories";
import type { PublishedArticle } from "@/lib/editorial/article";

/** Most recent items in the feed. Readers need the latest, not the archive. */
export const FEED_ITEM_LIMIT = 30;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderArticleFeed({
  articles,
  base,
  title,
  description,
  path,
}: {
  articles: PublishedArticle[];
  /** Absolute site origin, no trailing slash. */
  base: string;
  title: string;
  description: string;
  /** Where the feed itself is served, for the atom:self link. */
  path: string;
}): string {
  const items = articles.slice(0, FEED_ITEM_LIMIT).map((article) => {
    const link = `${base}/article/${article.slug}`;
    return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(CATEGORIES[article.category].label)}</category>
      <description>${escapeXml(article.dek)}</description>
    </item>`;
  });

  // lastBuildDate is the newest article, not the build clock: a rebuild with
  // no new articles must not tell every reader something changed.
  const newest = articles[0]?.updatedAt ?? articles[0]?.publishedAt;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(base)}</link>
    <atom:link href="${escapeXml(`${base}${path}`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(description)}</description>
    <language>en</language>${newest ? `
    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
  </channel>
</rss>
`;
}
