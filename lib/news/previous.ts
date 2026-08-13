import type { NewsDataset } from "@/lib/news/types";

/**
 * Previous-run registry: the last successfully served dataset, kept on
 * globalThis so refreshes within a warm instance (and cron runs hitting it)
 * can reuse cluster ids and keep story URLs stable as coverage grows.
 *
 * Fully deterministic: for a fixed input + registry state clustering always
 * produces the same ids, and an empty registry behaves exactly like a cold
 * start.
 */

const globalPrevious = globalThis as unknown as {
  __newsPreviousDataset?: NewsDataset | null;
};

/** Record the last good dataset. Empty datasets never overwrite a good one. */
export function setPreviousDataset(dataset: NewsDataset): void {
  if (dataset.articles.length > 0) {
    globalPrevious.__newsPreviousDataset = dataset;
  }
}

export function getPreviousDataset(): NewsDataset | null {
  return globalPrevious.__newsPreviousDataset ?? null;
}

/** Reset the registry — used by tests. */
export function clearPreviousDataset(): void {
  globalPrevious.__newsPreviousDataset = null;
}
