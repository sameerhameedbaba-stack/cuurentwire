import { getDataMode } from "@/lib/env";
import { classifyCategory } from "@/lib/news/classification/category";
import { clusterArticles } from "@/lib/news/clustering/cluster";
import { dedupeExact, normalizeArticle } from "@/lib/news/normalization/normalize";
import { activeProviders } from "@/lib/news/providers";
import { getLastFeedHealth } from "@/lib/news/providers/rss";
import { rankClusters } from "@/lib/news/ranking/score";
import { deriveTrending } from "@/lib/news/trending";
import type {
  Article,
  IngestionStats,
  NewsDataset,
  ProviderRunStat,
  RawArticle,
} from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";

const MAX_ARTICLE_AGE_HOURS = 72;

/** Nearest-rank percentile of a pre-sorted ascending array; 0 when empty. */
function percentile(sortedValues: number[], fraction: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * fraction) - 1),
  );
  return sortedValues[index];
}

/**
 * Full ingestion pipeline:
 * providers → normalize → validate → dedupe → classify → cluster → rank → dataset.
 * Provider failures are isolated — one outage never destroys the run.
 */
export async function runPipeline(now: Date = new Date()): Promise<NewsDataset> {
  const startedAt = new Date();
  logger.info("ingestion.start", { dataMode: getDataMode() });

  const providers = activeProviders();
  const providerStats: ProviderRunStat[] = [];
  const raw: RawArticle[] = [];

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const providerStart = Date.now();
      const articles = await provider.fetchLatest({ limit: 100 });
      return { provider: provider.name, articles, durationMs: Date.now() - providerStart };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      raw.push(...result.value.articles);
      providerStats.push({
        provider: result.value.provider,
        ok: true,
        articleCount: result.value.articles.length,
        durationMs: result.value.durationMs,
      });
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : "Unknown error";
      logger.error("ingestion.provider_failed", {
        provider: providers[i].name,
        error: message,
      });
      providerStats.push({
        provider: providers[i].name,
        ok: false,
        articleCount: 0,
        error: message,
        durationMs: 0,
      });
    }
  }

  // Attach per-feed health to the RSS provider entry (module-level last run).
  for (const stat of providerStats) {
    if (stat.provider === "rss") stat.feeds = getLastFeedHealth();
  }

  // Normalize + validate. Keep the raw article alongside (first occurrence
  // wins, matching dedupe) so the sanity check below can re-derive
  // classification details that Article does not retain (provider category).
  const normalized: Article[] = [];
  const rawByArticleId = new Map<string, RawArticle>();
  let rejected = 0;
  for (const rawArticle of raw) {
    const article = normalizeArticle(rawArticle, now);
    if (article === null) {
      rejected++;
      continue;
    }
    // Time window: ignore anything older than 72 hours.
    const ageHours =
      (now.getTime() - new Date(article.publishedAt).getTime()) / 3_600_000;
    if (ageHours > MAX_ARTICLE_AGE_HOURS) {
      rejected++;
      continue;
    }
    normalized.push(article);
    if (!rawByArticleId.has(article.id)) rawByArticleId.set(article.id, rawArticle);
  }

  const { unique, removed } = dedupeExact(normalized);
  const classificationWarnings = collectClassificationWarnings(unique, rawByArticleId);
  const clusters = rankClusters(clusterArticles(unique, now), now);
  const trending = deriveTrending(clusters);

  // Coverage age at ingest: how old accepted articles already are when we
  // pick them up (run time minus publishedAt).
  const ages = unique
    .map((a) => now.getTime() - new Date(a.publishedAt).getTime())
    .sort((a, b) => a - b);

  const finishedAt = new Date();
  const ingestion: IngestionStats = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    providers: providerStats,
    articlesReceived: raw.length,
    articlesAccepted: unique.length,
    articlesRejected: rejected,
    duplicatesRemoved: removed,
    clusterCount: clusters.length,
    articleAgeAtIngestMedianMs: percentile(ages, 0.5),
    articleAgeAtIngestP90Ms: percentile(ages, 0.9),
    highestRankingScore: clusters[0]?.rankingScore ?? 0,
    breakingCount: clusters.filter((c) => c.isBreaking).length,
    nearBreakingCount: clusters.filter((c) => c.rankingScore >= 75).length,
    classificationWarnings: classificationWarnings.length,
    classificationWarningSamples: classificationWarnings.slice(0, 10),
  };

  if (classificationWarnings.length > 0) {
    logger.warn("ingestion.classification_warnings", {
      count: classificationWarnings.length,
      samples: classificationWarnings.slice(0, 3).join(" | "),
    });
  }

  logger.info("ingestion.complete", {
    received: raw.length,
    accepted: unique.length,
    rejected,
    duplicates: removed,
    clusters: clusters.length,
    durationMs: ingestion.durationMs,
  });

  return {
    articles: unique,
    clusters,
    trending,
    generatedAt: finishedAt.toISOString(),
    dataMode: getDataMode(),
    ingestion,
  };
}

/**
 * Live sanity check over classified articles. Flags suspicious patterns for
 * the admin status page — never blocks or mutates ingestion:
 * - an espn.com article classified politics or world;
 * - a technology article whose title + description contain zero technology
 *   signals (the category came only from a provider hint, or from nothing);
 * - a specific category assigned with confidence < 0.2 (the world fallback
 *   is excluded — its confidence is 0 by design).
 */
function collectClassificationWarnings(
  articles: Article[],
  rawByArticleId: Map<string, RawArticle>,
): string[] {
  const warnings: string[] = [];
  for (const article of articles) {
    const raw = rawByArticleId.get(article.id);
    // Deterministic re-run with the same inputs normalization used, to
    // recover confidence and matched signals without widening Article.
    const result = classifyCategory({
      title: article.title,
      description: article.description,
      providerCategory: raw?.providerCategory,
      providerCategoryIsPrior: raw?.providerCategoryIsPrior,
    });
    const label = `"${article.title.slice(0, 80)}" (${article.sourceDomain})`;
    const domain = article.sourceDomain.toLowerCase();

    if (
      (domain === "espn.com" || domain.endsWith(".espn.com")) &&
      (article.category === "politics" || article.category === "world")
    ) {
      warnings.push(`espn.com article classified ${article.category}: ${label}`);
    }
    if (
      article.category === "technology" &&
      !result.matchedSignals.some((s) =>
        /^technology:(?:title|desc|entity):/.test(s),
      )
    ) {
      warnings.push(`technology article with zero technology signals: ${label}`);
    }
    if (article.category !== "world" && result.confidence < 0.2) {
      warnings.push(
        `${article.category} assigned with low confidence ${result.confidence.toFixed(2)}: ${label}`,
      );
    }
  }
  return warnings;
}
