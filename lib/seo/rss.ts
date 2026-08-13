import { siteConfig } from "@/config/site";
import type { StoryCluster } from "@/lib/news/types";

/** Render an RSS 2.0 feed for a set of ranked story clusters. */
export function renderRss({
  title,
  description,
  path,
  clusters,
}: {
  title: string;
  description: string;
  path: string;
  clusters: StoryCluster[];
}): string {
  const base = siteConfig.url;
  const items = clusters
    .map((cluster) => {
      const link = `${base}/story/${cluster.slug}`;
      const sourceNote = `Coverage from ${cluster.sourceNames.join(", ")}.`;
      const summary = cluster.summary ? `${cluster.summary} ` : "";
      return `    <item>
      <title>${escapeXml(cluster.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${cluster.id}</guid>
      <pubDate>${new Date(cluster.lastPublishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(cluster.category)}</category>
      <description>${escapeXml(`${summary}${sourceNote}`)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(base)}</link>
    <atom:link href="${escapeXml(`${base}${path}`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
