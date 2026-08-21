import type { MetadataRoute } from "next";
import { CATEGORIES, PUBLIC_CATEGORY_IDS } from "@/config/categories";
import { HUB_IDS } from "@/config/hubs";
import { siteConfig } from "@/config/site";
import { getDataset } from "@/lib/cache/store";
import { listBriefingDates } from "@/lib/database/briefing";
import { hubCounts } from "@/lib/news/hubs";
import { listActiveSources } from "@/lib/news/queries";
import { deriveTrending } from "@/lib/news/trending";
import { reportWeekIds, weekRangeET } from "@/lib/reports/weeks";
import { shouldIndexCollection } from "@/lib/seo/indexing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  // /search is intentionally absent: it is noindex and robots-disallowed.
  // /archive/<date> pages are also absent by design: this route renders per
  // request, and listing the day pages would cost a Neon aggregate on every
  // sitemap fetch. They are all one link from /archive (listed below), and
  // every story they link to is already in archive-sitemap.xml.
  const staticPaths = [
    "", "/latest", "/top-10", "/top-100", "/briefing", "/most-covered",
    "/reports/media-coverage", "/us", "/canada", "/topics",
    "/sources", "/archive", "/about", "/news-desk", "/methodology",
    // Evergreen reference pages. Nested under /methodology so the URL
    // hierarchy matches the BreadcrumbList they emit.
    "/methodology/coverage-breadth",
    "/methodology/publisher-tiers",
    "/methodology/duplicate-stories",
    "/editorial-standards", "/corrections", "/contact", "/privacy",
    "/terms", "/copyright",
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    changeFrequency:
      path === "" ||
      path === "/latest" ||
      path === "/top-10" ||
      path === "/top-100" ||
      path === "/briefing"
        ? "hourly"
        : "daily",
    priority:
      path === ""
        ? 1
        : path === "/top-10" || path === "/top-100" || path === "/briefing"
          ? 0.9
          : 0.6,
  }));

  // Weekly Media Coverage Reports: permanent data pages, one per completed
  // ET week (pure date math — no database read for the sitemap).
  for (const weekId of reportWeekIds()) {
    entries.push({
      url: `${base}/reports/media-coverage/${weekId}`,
      lastModified: weekRangeET(weekId)?.endUtcISO,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // Dated Daily Briefing pages are deliberate long-tail landing pages
  // ("news on <date>"), so unlike archive day ledgers they ARE advertised.
  // listBriefingDates is a cached read (1,800s) — one small query per TTL,
  // not per crawl — and fail-soft (empty without a database).
  for (const date of await listBriefingDates()) {
    entries.push({
      url: `${base}/briefing/${date}`,
      lastModified: `${date}T23:59:00.000Z`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Internal buckets (general) are excluded — only browsable sections.
  for (const id of PUBLIC_CATEGORY_IDS) {
    entries.push({
      url: `${base}${CATEGORIES[id].path}`,
      changeFrequency: "hourly",
      priority: 0.8,
    });
    // Per-section Top 10 pages ("top political news today" queries). Thin
    // sections answer noindex,follow themselves; the sitemap listing is
    // harmless while the section fills back up.
    entries.push({
      url: `${base}/top-10/${id}`,
      changeFrequency: "hourly",
      priority: 0.8,
    });
  }

  try {
    const dataset = await getDataset();
    // Topic hubs (config/hubs.ts): permanent URLs, listed only while they
    // clear the thin-collection bar — below it they answer noindex,follow.
    const counts = hubCounts(dataset);
    for (const id of HUB_IDS) {
      if (!shouldIndexCollection(counts[id])) continue;
      entries.push({
        url: `${base}/${id}`,
        changeFrequency: "hourly",
        priority: 0.8,
      });
    }
    for (const cluster of dataset.clusters.slice(0, 200)) {
      entries.push({
        url: `${base}/story/${cluster.slug}`,
        lastModified: cluster.lastPublishedAt,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }

    // Topic and source hubs are indexable once they clear the thin-collection
    // bar (the same gate the pages themselves apply), but nothing listed them
    // for discovery. Only the indexable ones go in: a sitemap must never
    // advertise a URL that answers noindex.
    for (const topic of deriveTrending(dataset.clusters, 60)) {
      if (!shouldIndexCollection(topic.clusterCount)) continue;
      entries.push({
        url: `${base}/topic/${topic.slug}`,
        changeFrequency: "hourly",
        priority: 0.5,
      });
    }
  } catch {
    // Sitemap still serves the static routes if the feed is unavailable.
  }

  try {
    const { sources } = await listActiveSources();
    for (const source of sources) {
      if (!shouldIndexCollection(source.articleCount)) continue;
      entries.push({
        url: `${base}/source/${source.slug}`,
        changeFrequency: "daily",
        priority: 0.5,
      });
    }
  } catch {
    // Source hubs are a bonus: their absence never breaks the sitemap.
  }

  return entries;
}
