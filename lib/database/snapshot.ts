import { eq } from "drizzle-orm";
import type { NewsDataset } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";
import { getDb } from "./client";
import { datasetSnapshots } from "./schema";

/**
 * Last-complete-snapshot persistence (single row, id = 1).
 *
 * Written after every successful pipeline run; read in exactly two places:
 *  - store.ts fallback: shared cache miss + empty instance → serve the last
 *    COMPLETE snapshot instead of generating a fresh partial reality;
 *  - previous-run seeding: cold instances load it before clustering so
 *    cluster ids (story URLs) stay continuous across the whole fleet.
 *
 * Best-effort like every DB module here: no DATABASE_URL → no-ops.
 */

const SNAPSHOT_ROW_ID = 1;

/** Snapshots older than this are stale news — not worth serving. */
export const MAX_SNAPSHOT_AGE_MS = 24 * 3_600_000;

export async function saveDatasetSnapshot(dataset: NewsDataset): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  // Demo data must never become the fleet-wide fallback reality.
  if (dataset.dataMode === "mock" || dataset.articles.length === 0) return false;
  try {
    const now = new Date();
    await db
      .insert(datasetSnapshots)
      .values({
        id: SNAPSHOT_ROW_ID,
        datasetVersion: dataset.datasetVersion,
        generatedAt: new Date(dataset.generatedAt),
        articleCount: dataset.articles.length,
        clusterCount: dataset.clusters.length,
        data: dataset,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: datasetSnapshots.id,
        set: {
          datasetVersion: dataset.datasetVersion,
          generatedAt: new Date(dataset.generatedAt),
          articleCount: dataset.articles.length,
          clusterCount: dataset.clusters.length,
          data: dataset,
          updatedAt: now,
        },
      });
    return true;
  } catch (error) {
    logger.error("database.snapshot_save_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

/**
 * Load the last complete snapshot, or null when there is no database, no
 * row, the stored shape is unusable, or the snapshot is older than
 * maxAgeMs. Never throws.
 */
export async function loadDatasetSnapshot(
  maxAgeMs: number = MAX_SNAPSHOT_AGE_MS,
  now: Date = new Date(),
): Promise<NewsDataset | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(datasetSnapshots)
      .where(eq(datasetSnapshots.id, SNAPSHOT_ROW_ID))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const dataset = row.data as NewsDataset;
    if (
      !dataset ||
      !Array.isArray(dataset.articles) ||
      dataset.articles.length === 0 ||
      !Array.isArray(dataset.clusters) ||
      typeof dataset.generatedAt !== "string"
    ) {
      return null;
    }
    const age = now.getTime() - new Date(dataset.generatedAt).getTime();
    if (!Number.isFinite(age) || age > maxAgeMs) return null;
    // Rows written before versioning still deserve a debuggable stamp.
    dataset.datasetVersion ??= `legacy-${dataset.generatedAt}`;
    return dataset;
  } catch (error) {
    logger.error("database.snapshot_load_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
