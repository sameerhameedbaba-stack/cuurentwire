import { env } from "@/lib/env";
import { runPipeline } from "@/lib/news/pipeline";
import type { NewsDataset } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";

/**
 * In-process news cache with stale-while-revalidate semantics.
 *
 * - Data refreshes roughly every NEWS_REFRESH_MINUTES (default 5).
 * - A stale dataset is served immediately while a background refresh runs.
 * - If every provider fails, the last successful dataset keeps serving —
 *   the homepage is never replaced by an error because one provider broke.
 *
 * The module-level singleton survives across requests within a server
 * process. The scheduled /api/cron/news-refresh endpoint forces refreshes in
 * serverless deployments where processes are short-lived.
 */

interface CacheState {
  dataset: NewsDataset | null;
  refreshedAt: number;
  refreshing: Promise<NewsDataset> | null;
}

const globalCache = globalThis as unknown as { __newsCache?: CacheState };

function state(): CacheState {
  globalCache.__newsCache ??= { dataset: null, refreshedAt: 0, refreshing: null };
  return globalCache.__newsCache;
}

async function refresh(): Promise<NewsDataset> {
  const cache = state();
  if (cache.refreshing) return cache.refreshing;

  cache.refreshing = runPipeline()
    .then((dataset) => {
      // Keep the previous dataset if the new run produced nothing usable.
      if (dataset.articles.length > 0 || cache.dataset === null) {
        cache.dataset = dataset;
      } else {
        logger.warn("cache.empty_refresh_kept_previous");
      }
      cache.refreshedAt = Date.now();
      return cache.dataset as NewsDataset;
    })
    .catch((error: unknown) => {
      logger.error("cache.refresh_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      cache.refreshedAt = Date.now();
      if (cache.dataset) return cache.dataset;
      throw error;
    })
    .finally(() => {
      cache.refreshing = null;
    });

  return cache.refreshing;
}

/**
 * Get the current dataset. Fresh-enough data returns instantly; stale data
 * returns instantly while a background refresh starts; no data blocks on the
 * first pipeline run.
 */
export async function getDataset(): Promise<NewsDataset> {
  const cache = state();
  const age = Date.now() - cache.refreshedAt;

  if (cache.dataset === null) {
    return refresh();
  }
  if (age > env.refreshIntervalMs && !cache.refreshing) {
    // Stale: kick off a background refresh, serve current data now.
    void refresh();
  }
  return cache.dataset;
}

/** Force a refresh (used by the cron endpoint). */
export async function forceRefresh(): Promise<NewsDataset> {
  const cache = state();
  cache.refreshedAt = 0;
  return refresh();
}

/** Cache metadata for diagnostics. */
export function cacheInfo(): { refreshedAt: number; hasData: boolean; refreshing: boolean } {
  const cache = state();
  return {
    refreshedAt: cache.refreshedAt,
    hasData: cache.dataset !== null,
    refreshing: cache.refreshing !== null,
  };
}
