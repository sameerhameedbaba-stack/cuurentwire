import { siteConfig } from "@/config/site";
import type { StoryCluster } from "@/lib/news/types";

/**
 * Google News sitemap renderer (sitemap-news 0.9 namespace).
 *
 * Rules:
 * - real clusters only — mock/demo data is never submitted to Google News;
 * - with archive standing available (a database deployment), only clusters
 *   the permanent archive already holds, and none it marks merged. Googlebot-
 *   News fetches this sitemap within minutes of publication and judges the
 *   feed by what those URLs answer — and 2026-08-24 they caught both holes:
 *   a story advertised before the batched persist (persist-gate.ts) had
 *   archived it answered the deliberate retriable 500 for the whole
 *   publish-to-burst window whenever the serving instance's dataset missed
 *   it, and a cluster carrying a merge pointer answered 308 to the survivor.
 *   An archived, unmerged cluster is the only kind whose URL is guaranteed
 *   resolvable by every instance, dataset generation or not. The cost is
 *   news-sitemap entry only at the next persist burst (≤ ~30 min) — the same
 *   cadence IndexNow pings already announce new URLs on;
 * - only stories whose source coverage AND emitted publication_date both fall
 *   inside the last 48 hours. Both must be checked: coverage can refresh on a
 *   story we published days ago, and Google rejects a news sitemap entry whose
 *   publication_date is outside the window. Dropped stories stay reachable via
 *   sitemap.xml / archive-sitemap.xml — only the News fast lane is time-boxed;
 * - newest coverage first, capped at 1000 entries;
 * - publication_date prefers the archive's first_seen_at (when CurrentWire
 *   actually published the story page, passed in via archive.firstSeenById)
 *   and falls back to firstPublishedAt (earliest source coverage); lastmod =
 *   lastPublishedAt (latest source coverage). Never our render time, so
 *   freshness is never faked.
 *
 * Pure function so it is unit-testable; the route handler feeds it data.
 */

export const NEWS_SITEMAP_WINDOW_HOURS = 48;
export const NEWS_SITEMAP_MAX_ENTRIES = 1000;

/**
 * Archive standing of the live clusters (getNewsSitemapArchiveStatus in
 * lib/database/archive.ts). Absent — no database, or the archive did not
 * answer — the renderer lists the live dataset unfiltered: a fail-open,
 * because an emptied news sitemap is "we published nothing", a worse signal
 * than temporarily advertising unguarded URLs.
 */
export interface NewsSitemapArchiveInfo {
  /** first_seen_at per archived cluster id — implies "archived". */
  firstSeenById: ReadonlyMap<string, string>;
  /** Cluster ids whose archive row currently carries a merge pointer. */
  mergedIds: ReadonlySet<string>;
}

export function renderNewsSitemap(
  clusters: StoryCluster[],
  now: Date = new Date(),
  archive?: NewsSitemapArchiveInfo,
): string {
  const base = siteConfig.url;
  const cutoff = now.getTime() - NEWS_SITEMAP_WINDOW_HOURS * 3_600_000;

  const fresh = clusters
    .filter((cluster) => !cluster.isMock)
    .filter(
      (cluster) =>
        !archive ||
        (archive.firstSeenById.has(cluster.id) &&
          !archive.mergedIds.has(cluster.id)),
    )
    .map((cluster) => ({
      cluster,
      publicationDate:
        archive?.firstSeenById.get(cluster.id) ?? cluster.firstPublishedAt,
    }))
    .filter(({ cluster, publicationDate }) => {
      const last = new Date(cluster.lastPublishedAt).getTime();
      const published = new Date(publicationDate).getTime();
      return (
        Number.isFinite(last) &&
        last >= cutoff &&
        Number.isFinite(published) &&
        published >= cutoff
      );
    })
    .sort(
      (a, b) =>
        new Date(b.cluster.lastPublishedAt).getTime() -
        new Date(a.cluster.lastPublishedAt).getTime(),
    );

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const { cluster, publicationDate } of fresh) {
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
      <news:publication_date>${escapeXml(publicationDate)}</news:publication_date>
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

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
