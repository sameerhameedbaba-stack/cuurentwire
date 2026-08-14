import { siteConfig } from "@/config/site";
import { escapeXml } from "@/lib/seo/news-sitemap";

/**
 * Archive sitemap: every permanently published /story/ URL, so stories that
 * rotated out of the live dataset (and therefore out of sitemap.xml's recent
 * slice) stay discoverable and recrawlable. Merged stories are excluded —
 * their URLs 308 to the survivor and must not be advertised.
 *
 * Single-file sitemap by design: Google's limit is 50,000 URLs per file,
 * which covers years of output at current volume. BACKLOG holds the note to
 * shard via generateSitemaps when the archive approaches 40,000 stories.
 */

export const ARCHIVE_SITEMAP_MAX_ENTRIES = 50_000;

export interface ArchiveSitemapEntry {
  slug: string;
  lastModifiedAt: string;
}

export function renderArchiveSitemap(entries: ArchiveSitemapEntry[]): string {
  const base = siteConfig.url;
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const entry of entries) {
    if (urls.length >= ARCHIVE_SITEMAP_MAX_ENTRIES) break;
    const loc = `${base}/story/${entry.slug}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(entry.lastModifiedAt)}</lastmod>
  </url>`);
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
