import { revalidateTag, unstable_cache } from "next/cache";
import { env } from "@/lib/env";
import { runPipeline } from "@/lib/news/pipeline";
import { setPreviousDataset } from "@/lib/news/previous";
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
    // Seconds; RSS_REFRESH_MINUTES governs the dataset (fast lane) cadence.
    // GNews serves from its own slower cache entry (see providers/gnews.ts),
    // so a fast dataset cadence never spends extra GNews quota.
    revalidate: Math.max(60, env.rssRefreshMinutes * 60),
  },
);

// Coalescing locks: concurrent callers within one instance share a single
// pipeline run instead of stampeding providers.
let inFlightShared: Promise<NewsDataset> | null = null;
let inFlightDirect: Promise<NewsDataset> | null = null;

function fetchDatasetSharedCoalesced(): Promise<NewsDataset> {
  inFlightShared ??= fetchDatasetShared().finally(() => {
    inFlightShared = null;
  });
  return inFlightShared;
}

function runPipelineCoalesced(): Promise<NewsDataset> {
  inFlightDirect ??= runPipeline().finally(() => {
    inFlightDirect = null;
  });
  return inFlightDirect;
}

/**
 * Get the current dataset: shared cache first, then in-process last-good,
 * then a direct pipeline run as the final fallback.
 */
export async function getDataset(): Promise<NewsDataset> {
  const cache = state();

  try {
    const dataset = await fetchDatasetSharedCoalesced();
    cache.dataset = dataset;
    cache.refreshedAt = Date.now();
    // Feed the previous-run registry so the next clustering pass can keep
    // cluster ids (story URLs) stable.
    setPreviousDataset(dataset);
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
  const direct = await runPipelineCoalesced();
  if (direct.articles.length > 0 || cache.dataset === null) {
    cache.dataset = direct;
    cache.refreshedAt = Date.now();
    setPreviousDataset(direct);
  }
  return cache.dataset ?? direct;
}

/**
 * Force a refresh (cron endpoint): expire the shared dataset entry and
 * repopulate. Only the dataset tag is revalidated — the GNews layer keeps
 * its own revalidate window so cron calls never spend extra GNews quota.
 */
export async function forceRefresh(): Promise<NewsDataset> {
  revalidateTag(NEWS_CACHE_TAG, "max");
  const cache = state();
  cache.refreshedAt = 0;

  try {
    const dataset = await fetchDatasetSharedCoalesced();
    cache.dataset = dataset;
    cache.refreshedAt = Date.now();
    setPreviousDataset(dataset);
    return dataset;
  } catch (error) {
    logger.error("cache.force_refresh_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    if (cache.dataset) return cache.dataset;
    return runPipelineCoalesced();
  }
}

/** Age of a dataset in milliseconds, from its generatedAt stamp. */
export function datasetAgeMs(
  dataset: Pick<NewsDataset, "generatedAt">,
  now: Date = new Date(),
): number {
  return Math.max(0, now.getTime() - new Date(dataset.generatedAt).getTime());
}

/** Cache metadata for diagnostics. */
export function cacheInfo(): { refreshedAt: number; hasData: boolean; refreshing: boolean } {
  const cache = state();
  return {
    refreshedAt: cache.refreshedAt,
    hasData: cache.dataset !== null,
    refreshing: inFlightShared !== null || inFlightDirect !== null,
  };
}
