import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * STATIC-SITE OVERLAY: /robots.txt.
 *
 * One sitemap. The Vercel app advertised three (sitemap, news-sitemap,
 * archive-sitemap); the latter two indexed the aggregator's /story/ corpus,
 * which the static site does not serve. Advertising sitemaps that 404 is a
 * crawl-health error in Search Console.
 *
 * Nothing is disallowed: the static site has no /api, /admin or /search.
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: [`${siteConfig.url}/sitemap.xml`],
  };
}
