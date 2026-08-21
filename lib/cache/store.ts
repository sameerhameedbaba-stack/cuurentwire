import { revalidateTag, unstable_cache } from "next/cache";
import {
  archivePublicDataset,
  isCronBurstActive,
  registerPublicClusters,
  shouldPersistNow,
} from "@/lib/database/persist-gate";
import { loadDatasetSnapshot, saveDatasetSnapshot } from "@/lib/database/snapshot";
import { env, getDataMode } from "@/lib/env";
import { runPipeline } from "@/lib/news/pipeline";
import { getPreviousDataset, setPreviousDataset } from "@/lib/news/previous";
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
 *    and the first fallback when the shared layer has nothing.
 * 3. Last COMPLETE snapshot from Postgres — the coherence guarantee: an
 *    instance with nothing serves the same snapshot every other instance
 *    saw, never a freshly generated partial reality of its own.
 * 4. Direct pipeline run — reachable only with no database configured
 *    (local dev) or an empty/stale snapshot table.
 *
 * Cluster-id continuity: before ANY pipeline run, the previous-run registry
 * is seeded from the DB snapshot when this instance has none in memory —
 * cold instances reuse the fleet's existing cluster ids instead of
 * re-deriving story URLs from scratch.
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

/**
 * Seed the previous-run registry from the persisted snapshot so clustering
 * keeps existing cluster ids even on a cold instance. No-op when memory
 * already has a previous dataset, in mock mode, or without a database.
 */
async function seedPreviousFromSnapshot(): Promise<void> {
  if (getPreviousDataset() || getDataMode() === "mock") return;
  const snapshot = await loadDatasetSnapshot();
  if (snapshot) setPreviousDataset(snapshot);
}

/** Shared-cache producer. Throws on empty results so they are not cached. */
const fetchDatasetShared = unstable_cache(
  async (): Promise<NewsDataset> => {
    await seedPreviousFromSnapshot();
    const dataset = await runPipeline();
    if (dataset.articles.length === 0) {
      throw new Error("Pipeline produced an empty dataset");
    }
    // Every public generation is recorded in the persist-gate registry, so
    // a cluster id born in a mid-window regeneration can never miss the
    // permanent archive even though writes are batched: if it vanishes
    // before the next burst, the burst carries it (the URL-survival probe
    // once caught exactly this class of loss).
    registerPublicClusters(dataset);
    // Database writes are batched to a ~30-minute cadence so Neon compute
    // can suspend between bursts (persist-gate.ts has the cost math).
    // Snapshot + archive used to run here on every generation; the dataset
    // itself still refreshes every cycle — only the writes are gated.
    if (shouldPersistNow()) {
      await saveDatasetSnapshot(dataset);
      // During a cron-route burst the route archives right after this
      // returns — with findNewClusterIds asked first, which is what lets
      // the IndexNow ping see genuinely new ids. Outside a cron burst
      // (traffic-triggered regeneration while the cron is down) this is
      // the safety net that still archives on the batch cadence.
      if (!isCronBurstActive()) {
        await archivePublicDataset(dataset);
      }
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
  inFlightDirect ??= (async () => {
    await seedPreviousFromSnapshot();
    return runPipeline();
  })().finally(() => {
    inFlightDirect = null;
  });
  return inFlightDirect;
}

/** The dataset with the newer generatedAt stamp; either side may be null. */
function newerDataset(
  a: NewsDataset | null,
  b: NewsDataset | null,
): NewsDataset | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(b.generatedAt).getTime() > new Date(a.generatedAt).getTime()
    ? b
    : a;
}

/**
 * Get the current dataset: shared cache first, then the NEWER of the
 * in-process last-good dataset and the last complete DB snapshot, then a
 * direct pipeline run as the final fallback (reachable only without a
 * usable snapshot). The in-process copy is never trusted on age alone —
 * comparing generatedAt against the shared snapshot stops a long-warm
 * instance from serving an older generation than the rest of the fleet.
 * Public routes therefore never invent a fresh partial dataset while a
 * complete shared one exists.
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

  // Bounded fallback: serve the newer of the instance-local last-good
  // dataset and the fleet-wide COMPLETE snapshot — never an unbounded-age
  // local copy, and never a new partial reality from this route's request.
  const local =
    cache.dataset && cache.dataset.articles.length > 0 ? cache.dataset : null;
  const best = newerDataset(local, await loadDatasetSnapshot());
  if (best) {
    if (best !== local) {
      cache.dataset = best;
      cache.refreshedAt = Date.now();
      setPreviousDataset(best);
    }
    return best;
  }

  // Last resort (no database / nothing persisted yet): run the pipeline
  // directly (never throws; providers are isolated). May legitimately be
  // empty — the UI handles that state.
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
    // Same fallback discipline as getDataset(): the newer of local
    // last-good and the last complete snapshot, before any per-request
    // pipeline reality.
    const local =
      cache.dataset && cache.dataset.articles.length > 0 ? cache.dataset : null;
    const best = newerDataset(local, await loadDatasetSnapshot());
    if (best) {
      if (best !== local) {
        cache.dataset = best;
        cache.refreshedAt = Date.now();
        setPreviousDataset(best);
      }
      return best;
    }
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
