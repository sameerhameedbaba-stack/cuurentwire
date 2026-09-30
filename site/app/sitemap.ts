import type { MetadataRoute } from "next";
import { CATEGORIES, CATEGORY_IDS } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getPublishedArticles } from "@/lib/editorial/store";

/**
 * STATIC-SITE OVERLAY: /sitemap.xml.
 *
 * Rendered once at build time. Lists exactly what the static site serves —
 * no aggregator surfaces, because every URL in a sitemap that answers 404 is
 * a crawl error charged to the domain.
 *
 * Categories are listed only when they contain an article: an empty section
 * is noindex (see site/app/[category]/page.tsx), and listing a noindex URL in
 * a sitemap is a contradiction Search Console reports.
 */
export const dynamic = "force-static";

const TRUST_PAGES = [
  "/about",
  "/news-desk",
  "/editorial-standards",
  "/corrections",
  "/contact",
  "/privacy",
  "/terms",
  "/copyright",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const articles = getPublishedArticles();
  const newest = articles[0]?.updatedAt ?? articles[0]?.publishedAt;

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: `${base}/articles`, lastModified: newest, changeFrequency: "daily", priority: 0.9 },
  ];

  const withArticles = new Set(articles.map((a) => a.category));
  for (const id of CATEGORY_IDS) {
    if (!withArticles.has(id)) continue;
    const newestInCategory = articles.find((a) => a.category === id);
    entries.push({
      url: `${base}${CATEGORIES[id].path}`,
      lastModified: newestInCategory?.updatedAt ?? newestInCategory?.publishedAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const article of articles) {
    entries.push({
      url: `${base}/article/${article.slug}`,
      lastModified: article.updatedAt ?? article.publishedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const path of TRUST_PAGES) {
    entries.push({ url: `${base}${path}`, changeFrequency: "monthly", priority: 0.4 });
  }

  return entries;
}
