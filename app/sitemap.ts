import type { MetadataRoute } from "next";
import { CATEGORY_IDS, CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getDataset } from "@/lib/cache/store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  // /search is intentionally absent: it is noindex and robots-disallowed.
  const staticPaths = [
    "", "/latest", "/top-100", "/us", "/canada", "/topics",
    "/sources", "/about", "/methodology", "/editorial-standards",
    "/corrections", "/contact", "/privacy", "/terms", "/copyright",
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" || path === "/latest" || path === "/top-100" ? "hourly" : "daily",
    priority: path === "" ? 1 : path === "/top-100" ? 0.9 : 0.6,
  }));

  for (const id of CATEGORY_IDS) {
    entries.push({
      url: `${base}${CATEGORIES[id].path}`,
      changeFrequency: "hourly",
      priority: 0.8,
    });
  }

  try {
    const dataset = await getDataset();
    for (const cluster of dataset.clusters.slice(0, 200)) {
      entries.push({
        url: `${base}/story/${cluster.slug}`,
        lastModified: cluster.lastPublishedAt,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }
  } catch {
    // Sitemap still serves the static routes if the feed is unavailable.
  }

  return entries;
}
