import { isCategoryId, type CategoryId } from "@/config/categories";
import { SOURCES, type SourceDefinition } from "@/config/sources";
import { getDataset } from "@/lib/cache/store";
import { matchesCountryFilter } from "@/lib/news/classification/geography";
import { scoreArchiveRelatedness } from "@/lib/news/coverage-analysis";
import { isCuratedEligible, isTop100Eligible } from "@/lib/news/ranking/score";
import {
  resolveTopic,
  topicIndexFor,
  topicKey,
  type TopicIndex,
} from "@/lib/news/topics";
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
    // HARD category invariant: a category filter returns only stories whose
    // PRIMARY category matches. Secondary-category matches belong in
    // explicitly labeled related sections, never silently in the main feed.
    result = result.filter((c) => c.category === category);
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

/**
 * The Top 100 — ranked clusters after filters, capped at 100. Press-release
 * clusters without independent coverage are excluded from this slice
 * entirely (isTop100Eligible) — the Top 100 is a news ranking, not a wire
 * distribution channel.
 */
export async function getTop100(filters: Top100Filters = {}): Promise<{
  stories: StoryCluster[];
  totalAvailable: number;
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const filtered = filterClusters(
    dataset.clusters.filter(isTop100Eligible),
    filters,
  );
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
  // The homepage is a news ranking surface end to end: press-release
  // clusters without independent editorial coverage are excluded from every
  // curated slot (hero, sections, most covered), exactly like the Top 100.
  // They remain reachable via /latest, search and source pages, labeled.
  const clusters = dataset.clusters.filter(isCuratedEligible);
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
    // Primary category only — a section band must never show a story whose
    // visible label is a different category.
    sections[id] = take(clusters.filter((c) => c.category === id), 5);
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
    // The homepage "Top 100 preview" mirrors the Top 100 page, so the same
    // press-release eligibility gate applies.
    top100Preview: clusters.filter(isTop100Eligible).slice(0, 10),
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
    articles: withClusterSlugs(articles.slice(start, start + limit), dataset),
    total,
    page: current,
    pageCount,
    dataset,
  };
}

/**
 * Attach each article's cluster slug so listing links resolve directly.
 * Without it, cards link to /story/<clusterId>, which exists only as a 307
 * alias — every crawl of a listing page costs an extra hop and the canonical
 * URL never receives the link itself.
 */
export function withClusterSlugs(
  articles: Article[],
  dataset: NewsDataset,
): Article[] {
  const slugById = new Map(dataset.clusters.map((c) => [c.id, c.slug]));
  return articles.map((article) => {
    const slug = article.clusterId ? slugById.get(article.clusterId) : undefined;
    return slug ? { ...article, clusterSlug: slug } : article;
  });
}

/** Parse a 1-based ?page= value; anything invalid falls back to page 1. */
export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export async function getClusterBySlug(slug: string): Promise<StoryCluster | null> {
  return (await getClusterBySlugWithVersion(slug)).cluster;
}

/**
 * Story lookup plus the version stamp of the snapshot it came from, so the
 * story page can render <meta name="cw-dataset-version"> from the SAME
 * dataset object that produced the cluster — never a second fetch that
 * could race a refresh and report a different snapshot than the body.
 */
export async function getClusterBySlugWithVersion(slug: string): Promise<{
  cluster: StoryCluster | null;
  datasetVersion: string;
}> {
  const dataset = await getDataset();
  // Stable-id fallback: bare cluster ids and re-titled old links resolve,
  // but only when the token after the LAST hyphen IS the id exactly — no
  // open-ended alias URLs.
  const idToken = slug.slice(slug.lastIndexOf("-") + 1);
  const cluster =
    dataset.clusters.find((c) => c.slug === slug) ??
    dataset.clusters.find((c) => c.id === slug || c.id === idToken) ??
    null;
  return { cluster, datasetVersion: dataset.datasetVersion };
}

/**
 * Live sibling of the archive's "earlier coverage" module, and held to the
 * same bar: sharing a generic entity (or merely a category) is not a
 * relationship, so it can never put an unrelated story in this rail. An
 * empty result renders nothing — the story page omits the section.
 */
export async function getRelatedClusters(
  cluster: StoryCluster,
  limit = 4,
): Promise<StoryCluster[]> {
  const dataset = await getDataset();
  return dataset.clusters
    .filter((c) => c.id !== cluster.id)
    .map((c) => ({ cluster: c, relatedness: scoreArchiveRelatedness(cluster, c) }))
    .filter((r) => r.relatedness.passes)
    .sort(
      (a, b) =>
        b.relatedness.score - a.relatedness.score ||
        b.cluster.rankingScore - a.cluster.rankingScore,
    )
    .slice(0, limit)
    .map((r) => r.cluster);
}

/**
 * The live topic index (lib/news/topics.ts): one entry per topic KEY, with
 * its canonical slug/display and how many clusters mention it. Story pages
 * use it to drop "In this story" chips that would land the reader on a
 * topic page showing nothing beyond the story they came from, and to link
 * the canonical topic URL rather than whichever variant this story happened
 * to phrase. One index for the whole page, never a per-chip query — and
 * memoized on the dataset's clusters array, so metadata and body share it.
 */
export async function getTopicIndex(): Promise<TopicIndex> {
  const dataset = await getDataset();
  return topicIndexFor(dataset.clusters);
}

/**
 * Compact crawl path out of a story page: the top-ranked live clusters from
 * the same PRIMARY category, minus the current story and anything already
 * shown in Related coverage. Same curated gate as the category pages' Top
 * modules (a press release without independent coverage never fills an
 * editorial slot), and served from the already-cached dataset — no extra
 * queries. Dataset order IS ranking order, so a plain slice is "top ranked".
 */
export async function getMoreInCategory(
  cluster: StoryCluster,
  excludeIds: Iterable<string> = [],
  limit = 4,
): Promise<StoryCluster[]> {
  const dataset = await getDataset();
  const excluded = new Set([cluster.id, ...excludeIds]);
  return dataset.clusters
    .filter(isCuratedEligible)
    .filter((c) => c.category === cluster.category && !excluded.has(c.id))
    .slice(0, limit);
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

/**
 * Stories mentioning a topic/entity, for /topic/[slug].
 *
 * URL PERMANENCE: matching is by topic KEY, not by exact slug. Every slug a
 * topic has ever been published under — "big-bend" as well as
 * "big-bend-national-park" — resolves to the same stories, so normalization
 * changing which form is canonical can never strand a URL that has been
 * advertised. `canonicalSlug` is what the page emits as rel=canonical, so
 * the variants consolidate instead of competing. An unrecognized slug keeps
 * today's behaviour exactly: no stories, a title-cased name, HTTP 200.
 */
export async function getTopicStories(topicSlug: string): Promise<{
  topicName: string | null;
  canonicalSlug: string;
  stories: StoryCluster[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  const entry = resolveTopic(topicIndexFor(dataset.clusters), topicSlug);
  if (!entry) {
    const topicName = topicSlug
      ? topicSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : null;
    return { topicName, canonicalSlug: topicSlug, stories: [], dataset };
  }
  const stories = dataset.clusters.filter((cluster) =>
    cluster.entities.some((entity) => topicKey(entity) === entry.key),
  );
  return {
    topicName: entry.display,
    canonicalSlug: entry.slug,
    stories,
    dataset,
  };
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
  return {
    source,
    sourceName: sourceName ?? source?.name ?? null,
    articles: withClusterSlugs(articles, dataset),
    dataset,
  };
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

/**
 * Category page data: hero, secondary, and a latest feed for the category.
 * HARD invariant: every story in the primary feed (hero/secondary/more/
 * latest) satisfies `story.category === category`. Stories that merely list
 * the category as a SECONDARY signal go into `related`, rendered under an
 * explicit "Related coverage" heading — never mixed into the main feed.
 */
export async function getCategoryData(category: CategoryId): Promise<{
  hero: StoryCluster | null;
  secondary: StoryCluster[];
  more: StoryCluster[];
  related: StoryCluster[];
  latest: Article[];
  dataset: NewsDataset;
}> {
  const dataset = await getDataset();
  // Curated gate applied ONCE, before any slicing: hero, secondary, more and
  // related are all editorial "Top" modules, so a press release without
  // independent coverage never reaches them. The latest rows below stay
  // ungated — that feed is chronological, and the release is labeled there.
  const curated = dataset.clusters.filter(isCuratedEligible);
  const clusters = curated.filter((c) => c.category === category);
  const related = curated
    .filter(
      (c) => c.category !== category && c.lead.categories.includes(category),
    )
    .slice(0, 6);
  const hero = clusters[0] ?? null;
  const secondary = clusters.slice(1, 5);
  const more = clusters.slice(5, 13);
  // Every cluster rendered as a card above. The chronological Latest rail
  // excludes their articles — the live defect showed the same story twice on
  // one page (card + article row linking the bare-id /story/<clusterId>
  // alias) — and carries cluster slugs so the rows link canonically.
  const shown = new Set(
    [...(hero ? [hero] : []), ...secondary, ...more, ...related].map((c) => c.id),
  );
  const latest = withClusterSlugs(
    dataset.articles
      .filter((a) => a.category === category)
      .filter((a) => !a.clusterId || !shown.has(a.clusterId))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )
      .slice(0, 10),
    dataset,
  );
  return {
    hero,
    secondary,
    more,
    related,
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
  // One gate covers every curated module on the page — hero, secondary,
  // byCategory and topList all slice this list, and the ItemList JSON-LD is
  // emitted from topList, so search engines are never told a single-source
  // press release is a top country story. The latest rail below is
  // chronological and stays ungated.
  const clusters = dataset.clusters
    .filter(isCuratedEligible)
    .filter((c) => matchesCountryFilter(c.country, country));
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
      .filter((c) => c.category === id)
      .slice(0, 3);
    for (const item of items) used.add(item.id);
    if (items.length > 0) byCategory[id] = items;
  }

  const topList = clusters.slice(0, 10);
  // Everything the page renders as a card: hero, secondary and byCategory
  // (accumulated in `used`) plus the ranked top list. The "Latest
  // developments" rail excludes those clusters' articles — the live /canada
  // defect rendered all six rail stories a second time through bare-id
  // /story/<clusterId> alias links — and carries cluster slugs so the
  // remaining rows link canonically.
  const shown = new Set([...used, ...topList.map((c) => c.id)]);
  const latest = withClusterSlugs(
    dataset.articles
      .filter((a) => matchesCountryFilter(a.country, country))
      .filter((a) => !a.clusterId || !shown.has(a.clusterId))
      .sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      )
      .slice(0, 8),
    dataset,
  );

  return {
    hero,
    secondary,
    byCategory,
    topList,
    latest,
    dataset,
  };
}
