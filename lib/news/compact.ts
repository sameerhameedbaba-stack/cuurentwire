import type { Article, NewsDataset, StoryCluster } from "@/lib/news/types";

/**
 * Compact wire form of a dataset for the shared Data Cache entry and the
 * Postgres snapshot row.
 *
 * In memory every cluster carries full Article objects (`articles`, `lead`)
 * that also live in `dataset.articles`, so the plain JSON form serializes
 * each article ~3 times. Vercel's Data Cache refuses items over 2 MB
 * ("items larger won't be cached"), and an uncacheable dataset means every
 * request re-runs the pipeline — so the stored form keeps one copy of each
 * article and references it by id from the clusters. `expandDataset`
 * rebuilds the exact in-memory shape; no page or query code changes.
 */

export const COMPACT_FORMAT = 1 as const;

type CompactCluster = Omit<StoryCluster, "articles" | "lead"> & {
  articleIds: string[];
  leadId: string;
  /** Only when the lead is not among `articles` (defensive; never expected). */
  leadArticle?: Article;
};

/** Stored article: canonicalUrl is omitted when it equals url (the norm). */
type CompactArticle = Omit<Article, "canonicalUrl"> & { canonicalUrl?: string };

export interface CompactDataset extends Omit<NewsDataset, "clusters" | "articles"> {
  compact: typeof COMPACT_FORMAT;
  articles: CompactArticle[];
  clusters: CompactCluster[];
}

function compactArticle(article: Article): CompactArticle {
  if (article.canonicalUrl !== article.url) return article;
  const { canonicalUrl: _same, ...rest } = article;
  void _same;
  return rest;
}

function expandArticle(article: CompactArticle): Article {
  return article.canonicalUrl === undefined
    ? ({ ...article, canonicalUrl: article.url } as Article)
    : (article as Article);
}

export function isCompactDataset(value: unknown): value is CompactDataset {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { compact?: unknown }).compact === COMPACT_FORMAT &&
    Array.isArray((value as { clusters?: unknown }).clusters)
  );
}

export function compactDataset(dataset: NewsDataset): CompactDataset {
  const known = new Set(dataset.articles.map((a) => a.id));
  const extras: Article[] = [];
  const clusters: CompactCluster[] = dataset.clusters.map((cluster) => {
    const { articles, lead, ...rest } = cluster;
    for (const article of articles) {
      // A cluster article missing from dataset.articles (should not happen,
      // but the archive and previous-run registries have seen odd shapes)
      // is carried along so expansion is always lossless.
      if (!known.has(article.id)) {
        known.add(article.id);
        extras.push(article);
      }
    }
    const leadInArticles = articles.some((a) => a.id === lead.id);
    return {
      ...rest,
      articleIds: articles.map((a) => a.id),
      leadId: lead.id,
      ...(leadInArticles || known.has(lead.id) ? {} : { leadArticle: lead }),
    };
  });
  const allArticles =
    extras.length > 0 ? [...dataset.articles, ...extras] : dataset.articles;
  return {
    ...dataset,
    compact: COMPACT_FORMAT,
    articles: allArticles.map(compactArticle),
    clusters,
  };
}

export function expandDataset(compact: CompactDataset): NewsDataset {
  const articlesFull = compact.articles.map(expandArticle);
  const byId = new Map(articlesFull.map((a) => [a.id, a] as const));
  const { compact: _format, clusters, articles: _stored, ...rest } = compact;
  void _format;
  void _stored;
  const expanded: StoryCluster[] = clusters.map((cluster) => {
    const { articleIds, leadId, leadArticle, ...fields } = cluster;
    const articles = articleIds
      .map((id) => byId.get(id))
      .filter((a): a is Article => Boolean(a));
    const lead = byId.get(leadId) ?? leadArticle ?? articles[0];
    return { ...fields, articles, lead } as StoryCluster;
  });
  return { ...rest, articles: articlesFull, clusters: expanded };
}

/** Accepts either stored shape (rows written before the compact form). */
export function expandIfCompact(value: NewsDataset | CompactDataset): NewsDataset {
  return isCompactDataset(value) ? expandDataset(value) : (value as NewsDataset);
}

/**
 * Vercel Data Cache refuses items over 2 MB — silently, and an uncached
 * dataset means every request re-runs the pipeline. This budget keeps a
 * safety margin under that cliff.
 */
export const CACHE_ENTRY_BYTE_BUDGET = 1_850_000;

export interface FitResult {
  dataset: NewsDataset;
  bytes: number;
  droppedClusters: number;
  droppedArticles: number;
}

/**
 * Guarantee the compact entry fits the budget by dropping the LOWEST-ranked
 * clusters (dataset.clusters is ranking order) and the articles only they
 * referenced, 5% at a time, until it does. Normal volumes never trigger
 * this (the pipeline's article cap comes first); it is the last line of
 * defence for an extraordinary news day.
 */
export function fitToCacheBudget(
  dataset: NewsDataset,
  budget: number = CACHE_ENTRY_BYTE_BUDGET,
): FitResult {
  let current = dataset;
  let bytes = JSON.stringify(compactDataset(current)).length;
  let droppedClusters = 0;
  let droppedArticles = 0;
  while (bytes > budget && current.clusters.length > 1) {
    const keepCount = Math.max(
      1,
      Math.floor(current.clusters.length * 0.95),
    );
    const clusters = current.clusters.slice(0, keepCount);
    droppedClusters += current.clusters.length - keepCount;
    const referenced = new Set<string>();
    for (const cluster of clusters) {
      for (const article of cluster.articles) referenced.add(article.id);
      referenced.add(cluster.lead.id);
    }
    const articles = current.articles.filter((a) => referenced.has(a.id));
    droppedArticles += current.articles.length - articles.length;
    current = { ...current, clusters, articles };
    bytes = JSON.stringify(compactDataset(current)).length;
  }
  return { dataset: current, bytes, droppedClusters, droppedArticles };
}
