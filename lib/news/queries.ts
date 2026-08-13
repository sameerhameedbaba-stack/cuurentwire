import { isCategoryId, type CategoryId } from "@/config/categories";
import { SOURCES, type SourceDefinition } from "@/config/sources";
import { getDataset } from "@/lib/cache/store";
import { matchesCountryFilter } from "@/lib/news/classification/geography";
import type {
  Article,
  NewsDataset,
  StoryCluster,
  TrendingTopic,
} from "@/lib/news/types";
import { significantTokens, slugify } from "@/lib/utils/text";

/** Country filter values accepted in URLs. */
export type CountryFilter = "all" | "us" | "canada" | "us-canada" | "global";
export type TimeFilter = "latest" | "3h" | "6h" | "12h" | "24h";
export type SortOrder = "importance" | "newest" | "most-covered";

export function parseCountryFilter(value: string | undefined): CountryFilter {
  const allowed: CountryFilter[] = ["all", "us", "canada", "us-canada", "global"];
  return allowed.includes(value as CountryFilter) ? (value as CountryFilter) : "all";
}

export function parseCategoryFilter(value: string | undefined): CategoryId | "all" {
  if (value && isCategoryId(value)) return value;
  return "all";
}

export function parseTimeFilter(value: string | undefined): TimeFilter {
  const allowed: TimeFilter[] = ["latest", "3h", "6h", "12h", "24h"];
  return allowed.includes(value as TimeFilter) ? (value as TimeFilter) : "latest";
}

const TIME_FILTER_HOURS: Record<TimeFilter, number | null> = {
  latest: null,
  "3h": 3,
  "6h": 6,
  "12h": 12,
  "24h": 24,
};

export interface Top100Filters {
  country?: CountryFilter;
  category?: CategoryId | "all";
  time?: TimeFilter;
  sort?: SortOrder;
}

export function filterClusters(
  clusters: StoryCluster[],
  filters: Top100Filters,
  now: Date = new Date(),
): StoryCluster[] {
  let result = clusters;

  const country = filters.country ?? "all";
  if (country !== "all") {
    result = result.filter((c) => matchesCountryFilter(c.country, country));
  }
  const category = filters.category ?? "all";
  if (category !== "all") {
    result = result.filter(
      (c) => c.category === category || c.lead.categories.includes(category),
    );
  }
  const hours = TIME_FILTER_HOURS[filters.time ?? "latest"];
  if (hours !== null) {
    const cutoff = now.getTime() - hours * 3_600_000;
    result = result.filter(
      (c) => new Date(c.lastPublishedAt).getTime() >= cutoff,
    );
  }

  const sort = filters.sort ?? "importance";
  if (sort === "newest") {
    result = [...result].sort(
      (a, b) =>
        new Date(b.lastPublishedAt).getTime() - new Date(a.lastPublishedAt).getTime(),
    );
  } else if (sort === "most-covered") {
    result = [...result].sort((a, b) => b.sourceCount - a.sourceCount);
  }
  // "importance" keeps the dataset's ranking order.
  return result;
}

/** The Top 100 — ranked clusters after filters, capped at 100. */
export async function getTop100(filters: Top100Filters = {}): Promise<{
  stories: StoryCluster[];
  totalAvailable: number;
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const filtered = filterClusters(dataset.clusters, filters);
  return {
    stories: filtered.slice(0, 100),
    totalAvailable: filtered.length,
    dataset,
  };
}

export interface HomepageData {
  dataset: NewsDataset;
  breaking: StoryCluster | null;
  hero: StoryCluster | null;
  topSecondary: StoryCluster[];
  liveDeveloping: StoryCluster[];
  mostCovered: StoryCluster[];
  sections: Partial<Record<CategoryId, StoryCluster[]>>;
  us: StoryCluster[];
  canada: StoryCluster[];
  top100Preview: StoryCluster[];
  trending: TrendingTopic[];
}

export async function getHomepageData(): Promise<HomepageData> {
  const dataset = await getDataset();
  const clusters = dataset.clusters;
  const used = new Set<string>();

  const take = (pool: StoryCluster[], count: number): StoryCluster[] => {
    const picked: StoryCluster[] = [];
    for (const cluster of pool) {
      if (picked.length >= count) break;
      if (used.has(cluster.id)) continue;
      used.add(cluster.id);
      picked.push(cluster);
    }
    return picked;
  };

  const breaking = clusters.find((c) => c.isBreaking) ?? null;

  const hero = take(clusters, 1)[0] ?? null;
  const topSecondary = take(clusters, 4);

  // The hero already dominates the page — don't repeat it in the stream.
  const liveDeveloping = clusters
    .filter((c) => c.status !== null && c.id !== hero?.id)
    .slice(0, 6);

  const mostCovered = [...clusters]
    .filter((c) => c.sourceCount >= 2)
    .sort((a, b) => b.sourceCount - a.sourceCount)
    .slice(0, 5);

  const us = take(
    clusters.filter((c) => matchesCountryFilter(c.country, "us")),
    9,
  );
  const canada = take(
    clusters.filter((c) => matchesCountryFilter(c.country, "canada")),
    9,
  );

  const sections: Partial<Record<CategoryId, StoryCluster[]>> = {};
  const sectionIds: CategoryId[] = [
    "business", "technology", "world", "climate", "health",
    "science", "culture", "sports",
  ];
  for (const id of sectionIds) {
    sections[id] = take(
      clusters.filter((c) => c.category === id || c.lead.categories.includes(id)),
      5,
    );
  }

  return {
    dataset,
    breaking,
    hero,
    topSecondary,
    liveDeveloping,
    mostCovered,
    sections,
    us,
    canada,
    top100Preview: clusters.slice(0, 10),
    trending: dataset.trending,
  };
}

/**
 * Reverse-chronological article feed for /latest, paginated so every
 * article (and therefore every story cluster) is reachable from a
 * crawlable page. `page` is 1-based and clamped to the valid range.
 */
export async function getLatest(
  country: CountryFilter = "all",
  limit = 60,
  page = 1,
): Promise<{
  articles: Article[];
  total: number;
  page: number;
  pageCount: number;
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  let articles = dataset.articles;
  if (country !== "all") {
    articles = articles.filter((a) => matchesCountryFilter(a.country, country));
  }
  articles = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const total = articles.length;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * limit;
  return {
    articles: articles.slice(start, start + limit),
    total,
    page: current,
    pageCount,
    dataset,
  };
}

/** Parse a 1-based ?page= value; anything invalid falls back to page 1. */
export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export async function getClusterBySlug(slug: string): Promise<StoryCluster | null> {
  const dataset = await getDataset();
  // Stable-id fallback: bare cluster ids and re-titled old links resolve,
  // but only when the token after the LAST hyphen IS the id exactly — no
  // open-ended alias URLs.
  const idToken = slug.slice(slug.lastIndexOf("-") + 1);
  return (
    dataset.clusters.find((c) => c.slug === slug) ??
    dataset.clusters.find((c) => c.id === slug || c.id === idToken) ??
    null
  );
}

export async function getRelatedClusters(
  cluster: StoryCluster,
  limit = 4,
): Promise<StoryCluster[]> {
  const dataset = await getDataset();
  const clusterEntities = new Set(cluster.entities.map((e) => e.toLowerCase()));
  return dataset.clusters
    .filter((c) => c.id !== cluster.id)
    .map((c) => {
      const shared = c.entities.filter((e) =>
        clusterEntities.has(e.toLowerCase()),
      ).length;
      const sameCategory = c.category === cluster.category ? 1 : 0;
      return { cluster: c, relevance: shared * 2 + sameCategory };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.cluster.rankingScore - a.cluster.rankingScore)
    .slice(0, limit)
    .map((r) => r.cluster);
}

export interface SearchFilters {
  country?: CountryFilter;
  category?: CategoryId | "all";
  source?: string;
  time?: TimeFilter;
}

/** Token-scored search over titles, summaries, sources and entities. */
export async function searchStories(
  query: string,
  filters: SearchFilters = {},
  limit = 40,
): Promise<{ results: StoryCluster[]; dataset: NewsDataset }> {
  const dataset = await getDataset();
  const tokens = significantTokens(query);
  let pool = filterClusters(dataset.clusters, {
    country: filters.country,
    category: filters.category,
    time: filters.time,
  });
  if (filters.source) {
    const sourceSlug = filters.source.toLowerCase();
    pool = pool.filter((c) =>
      c.articles.some((a) => a.sourceSlug === sourceSlug),
    );
  }
  if (tokens.length === 0) {
    return { results: pool.slice(0, limit), dataset };
  }

  const scored = pool
    .map((cluster) => {
      const haystackTitle = cluster.title.toLowerCase();
      const haystackRest = [
        cluster.summary ?? "",
        cluster.entities.join(" "),
        cluster.sourceNames.join(" "),
        cluster.articles.map((a) => a.title).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystackTitle.includes(token)) score += 3;
        else if (haystackRest.includes(token)) score += 1;
      }
      return { cluster, score };
    })
    .filter((r) => r.score >= Math.max(1, tokens.length))
    .sort((a, b) => b.score - a.score || b.cluster.rankingScore - a.cluster.rankingScore);

  return { results: scored.map((r) => r.cluster).slice(0, limit), dataset };
}

/** Stories mentioning a topic/entity, for /topic/[slug]. */
export async function getTopicStories(topicSlug: string): Promise<{
  topicName: string | null;
  stories: StoryCluster[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  let topicName: string | null = null;
  const stories = dataset.clusters.filter((cluster) => {
    for (const entity of cluster.entities) {
      if (slugify(entity, 60) === topicSlug) {
        topicName ??= entity;
        return true;
      }
    }
    return false;
  });
  // Derive a readable name from the slug when no story currently matches.
  if (!topicName && topicSlug) {
    topicName = topicSlug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return { topicName, stories, dataset };
}

/** Articles from one source, for /source/[slug]. */
export async function getSourceStories(sourceSlug: string): Promise<{
  source: SourceDefinition | null;
  sourceName: string | null;
  articles: Article[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const articles = dataset.articles
    .filter((a) => a.sourceSlug === sourceSlug)
    .sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  const sourceName = articles[0]?.source ?? null;
  const source =
    SOURCES.find((s) => slugify(s.name, 60) === sourceSlug) ?? null;
  return { source, sourceName: sourceName ?? source?.name ?? null, articles, dataset };
}

/** All sources that currently have at least one article, for /sources. */
export async function listActiveSources(): Promise<{
  sources: { name: string; slug: string; tier: string; articleCount: number }[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const counts = new Map<string, { name: string; tier: string; count: number }>();
  for (const article of dataset.articles) {
    const existing = counts.get(article.sourceSlug);
    if (existing) existing.count++;
    else
      counts.set(article.sourceSlug, {
        name: article.source,
        tier: article.sourceTier,
        count: 1,
      });
  }
  const sources = [...counts.entries()]
    .map(([slug, v]) => ({
      name: v.name,
      slug,
      tier: v.tier,
      articleCount: v.count,
    }))
    .sort((a, b) => a.tier.localeCompare(b.tier) || b.articleCount - a.articleCount);
  return { sources, dataset };
}

/** Category page data: hero, secondary, and a latest feed for the category. */
export async function getCategoryData(category: CategoryId): Promise<{
  hero: StoryCluster | null;
  secondary: StoryCluster[];
  more: StoryCluster[];
  latest: Article[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const clusters = dataset.clusters.filter(
    (c) => c.category === category || c.lead.categories.includes(category),
  );
  const latest = dataset.articles
    .filter((a) => a.category === category || a.categories.includes(category))
    .sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, 10);
  return {
    hero: clusters[0] ?? null,
    secondary: clusters.slice(1, 5),
    more: clusters.slice(5, 13),
    latest,
    dataset,
  };
}

/** Country page data for /us and /canada. */
export async function getCountryData(country: "us" | "canada"): Promise<{
  hero: StoryCluster | null;
  secondary: StoryCluster[];
  byCategory: Partial<Record<CategoryId, StoryCluster[]>>;
  topList: StoryCluster[];
  latest: Article[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const clusters = dataset.clusters.filter((c) =>
    matchesCountryFilter(c.country, country),
  );
  const used = new Set<string>();
  const hero = clusters[0] ?? null;
  if (hero) used.add(hero.id);
  const secondary = clusters.filter((c) => !used.has(c.id)).slice(0, 4);
  for (const c of secondary) used.add(c.id);

  const byCategory: Partial<Record<CategoryId, StoryCluster[]>> = {};
  const categoryIds: CategoryId[] = ["politics", "business", "technology", "climate"];
  for (const id of categoryIds) {
    const items = clusters
      .filter((c) => !used.has(c.id))
      .filter((c) => c.category === id || c.lead.categories.includes(id))
      .slice(0, 3);
    for (const item of items) used.add(item.id);
    if (items.length > 0) byCategory[id] = items;
  }

  const latest = dataset.articles
    .filter((a) => matchesCountryFilter(a.country, country))
    .sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, 8);

  return {
    hero,
    secondary,
    byCategory,
    topList: clusters.slice(0, 10),
    latest,
    dataset,
  };
}
