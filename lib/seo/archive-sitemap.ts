import { siteConfig } from "@/config/site";
import { escapeXml } from "@/lib/seo/news-sitemap";
import { logger } from "@/lib/utils/logger";

/**
 * Archive sitemap: every permanently published /story/ URL, so stories that
 * rotated out of the live dataset (and therefore out of sitemap.xml's recent
 * slice) stay discoverable and recrawlable. Merged stories are excluded —
 * their URLs 308 to the survivor and must not be advertised.
 *
 * Single-file sitemap by design: Google's limit is 50,000 URLs per file.
 *
 * The line here used to add "which covers years of output at current volume".
 * That was never measured. This file is a rolling window — the route filters
 * through archiveSitemapIndexableSql (336h OR multi-publication OR history OR
 * GSC-protected) — so it does NOT grow at the gross publish rate, but it is
 * still growing: 9,999 URLs on 2026-08-28 and 16,758 on 2026-09-04, a net
 * ~1,059/day over the last four days and rising. That reaches the 45,000
 * seo-health failure around 2026-09-24. Weeks, not years.
 *
 * Sharding must NOT use Next's generateSitemaps: it only binds to the
 * sitemap.(js|ts) file convention (this is a Route Handler), it forces the URL
 * to /.../sitemap/[id].xml, and its generated wrapper hardcodes a 200 with
 * `public, max-age=0, must-revalidate` — there is no code path to the 503 +
 * Retry-After outage contract this route gained after 2026-08-21, when an
 * empty urlset told crawlers the site had zero story URLs. The planned shape
 * is a hand-rolled <sitemapindex> at this same URL pointing at per-ISO-week
 * shards keyed on first_seen_at, so no /story/ URL ever moves.
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
  let truncated = 0;
  for (const entry of entries) {
    if (urls.length >= ARCHIVE_SITEMAP_MAX_ENTRIES) {
      truncated += 1;
      continue;
    }
    const loc = `${base}/story/${entry.slug}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${escapeXml(entry.lastModifiedAt)}</lastmod>
  </url>`);
  }
  if (truncated > 0) {
    // The cap used to `break` in silence, which is the worst available
    // behaviour: the sitemap keeps answering 200 with a well-formed urlset
    // while N permanent story URLs simply stop being advertised, and no probe
    // that checks status, validity or entry count can see it. Entries arrive
    // newest-first, so the URLs dropped are the OLDEST — the ones with no
    // other discovery path left. seo-health.mjs fails above 45,000 to catch
    // this first, but that runs daily against production only; this fires in
    // the request that does it.
    logger.error("seo.archive_sitemap_truncated", {
      emitted: urls.length,
      dropped: truncated,
      cap: ARCHIVE_SITEMAP_MAX_ENTRIES,
    });
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
