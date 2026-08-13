import { revalidateTag, unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { runPipeline } from "@/lib/news/pipeline";
import type { NewsDataset } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";

/**
 * News cache, layered for both serverless and long-lived servers:
 *
 * 1. Shared data cache (unstable_cache) — persisted by the platform and
 *    shared across serverless instances, so providers are hit roughly once
 *    per refresh interval globally, not once per instance. An empty pipeline
 *    result throws inside the cached function so an outage is NEVER cached.
 * 2. In-process last-good dataset — instant serving within a warm instance
 *    and the fallback when the shared layer has nothing.
 *
 * The homepage is never replaced by an error because one provider broke:
 * worst case an empty dataset is returned and the UI shows a friendly
 * "temporarily unavailable" state.
 */

export const NEWS_CACHE_TAG = "news-dataset";

interface CacheState {
  dataset: NewsDataset | null;
  refreshedAt: number;
}

const globalCache = globalThis as unknown as { __newsCache?: CacheState };

function state(): CacheState {
  globalCache.__newsCache ??= { dataset: null, refreshedAt: 0 };
  return globalCache.__newsCache;
}

/** Shared-cache producer. Throws on empty results so they are not cached. */
const fetchDatasetShared = unstable_cache(
  async (): Promise<NewsDataset> => {
    const dataset = await runPipeline();
    if (dataset.articles.length === 0) {
      throw new Error("Pipeline produced an empty dataset");
    }
    return dataset;
  },
  ["news-dataset-v1"],
  {
    tags: [NEWS_CACHE_TAG],
    // Seconds; NEWS_REFRESH_MINUTES governs the global refresh cadence
    // (30 min in production keeps GNews free-tier usage under its daily cap).
    revalidate: Math.max(60, Math.floor(env.refreshIntervalMs / 1000)),
  },
);

/**
 * Get the current dataset: shared cache first, then in-process last-good,
 * then a direct pipeline run as the final fallback.
 */
export async function getDataset(): Promise<NewsDataset> {
  const cache = state();

  try {
    const dataset = await fetchDatasetShared();
    cache.dataset = dataset;
    cache.refreshedAt = Date.now();
    return dataset;
  } catch (error) {
    logger.warn("cache.shared_layer_miss", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  if (cache.dataset && cache.dataset.articles.length > 0) {
    return cache.dataset;
  }

  // Last resort: run the pipeline directly (never throws; providers are
  // isolated). May legitimately be empty — the UI handles that state.
  const direct = await runPipeline();
  if (direct.articles.length > 0 || cache.dataset === null) {
    cache.dataset = direct;
    cache.refreshedAt = Date.now();
  }
  return cache.dataset ?? direct;
}

/** Force a refresh (cron endpoint): expire the shared entry and repopulate. */
export async function forceRefresh(): Promise<NewsDataset> {
  revalidateTag(NEWS_CACHE_TAG, "max");
  const cache = state();
  cache.refreshedAt = 0;

  try {
    const dataset = await fetchDatasetShared();
    cache.dataset = dataset;
    cache.refreshedAt = Date.now();
    return dataset;
  } catch (error) {
    logger.error("cache.force_refresh_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    if (cache.dataset) return cache.dataset;
    return runPipeline();
  }
}

/** Cache metadata for diagnostics. */
export function cacheInfo(): { refreshedAt: number; hasData: boolean; refreshing: boolean } {
  const cache = state();
  return {
    refreshedAt: cache.refreshedAt,
    hasData: cache.dataset !== null,
    refreshing: false,
  };
}
