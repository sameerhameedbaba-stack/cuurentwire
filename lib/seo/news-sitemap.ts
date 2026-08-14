import { siteConfig } from "@/config/site";
import type { StoryCluster } from "@/lib/news/types";

/**
 * Google News sitemap renderer (sitemap-news 0.9 namespace).
 *
 * Rules:
 * - real clusters only — mock/demo data is never submitted to Google News;
 * - only stories with source coverage inside the last 48 hours;
 * - newest coverage first, capped at 1000 entries;
 * - publication_date prefers the archive's first_seen_at (when CurrentWire
 *   actually published the story page, passed in via firstSeenById) and
 *   falls back to firstPublishedAt (earliest source coverage); lastmod =
 *   lastPublishedAt (latest source coverage). Never our render time, so
 *   freshness is never faked.
 *
 * Pure function so it is unit-testable; the route handler feeds it data.
 */

export const NEWS_SITEMAP_WINDOW_HOURS = 48;
export const NEWS_SITEMAP_MAX_ENTRIES = 1000;

export function renderNewsSitemap(
  clusters: StoryCluster[],
  now: Date = new Date(),
  firstSeenById?: ReadonlyMap<string, string>,
): string {
  const base = siteConfig.url;
  const cutoff = now.getTime() - NEWS_SITEMAP_WINDOW_HOURS * 3_600_000;

  const fresh = clusters
    .filter((cluster) => !cluster.isMock)
    .filter((cluster) => {
      const last = new Date(cluster.lastPublishedAt).getTime();
      return Number.isFinite(last) && last >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.lastPublishedAt).getTime() - new Date(a.lastPublishedAt).getTime(),
    );

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const cluster of fresh) {
    if (urls.length >= NEWS_SITEMAP_MAX_ENTRIES) break;
    const loc = `${base}/story/${cluster.slug}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteConfig.name)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${escapeXml(firstSeenById?.get(cluster.id) ?? cluster.firstPublishedAt)}</news:publication_date>
      <news:title>${escapeXml(cluster.title)}</news:title>
    </news:news>
    <lastmod>${escapeXml(cluster.lastPublishedAt)}</lastmod>
  </url>`);
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
