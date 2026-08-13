import { getDataMode } from "@/lib/env";
import { clusterArticles } from "@/lib/news/clustering/cluster";
import { dedupeExact, normalizeArticle } from "@/lib/news/normalization/normalize";
import { activeProviders } from "@/lib/news/providers";
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

  // Normalize + validate.
  const normalized: Article[] = [];
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
  }

  const { unique, removed } = dedupeExact(normalized);
  const clusters = rankClusters(clusterArticles(unique, now), now);
  const trending = deriveTrending(clusters);

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
  };

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
