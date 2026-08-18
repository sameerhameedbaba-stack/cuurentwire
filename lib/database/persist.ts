import { lt, sql } from "drizzle-orm";
import type { NewsDataset } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";
import { getDb } from "./client";
import { describeDbError } from "./errors";
import {
  articleClusterMembers,
  articles,
  ingestionRuns,
  rankingSnapshots,
  storyClusters,
} from "./schema";

/**
 * Rows per INSERT statement. Keeps statements far below the 65535 bind
 * parameter protocol limit and, more importantly, bounds the blast radius of
 * a bad row to one chunk.
 */
const INSERT_CHUNK = 100;

/**
 * Retention caps for the two append-only tables. The cron runs every 5
 * minutes (ranking_snapshots +100 rows/run ≈ 29k/day, ingestion_runs
 * 288/day) and the database is a Neon free-tier instance — without a cap
 * these tables grow without bound.
 */
const RANKING_SNAPSHOT_RETENTION_DAYS = 3;
const INGESTION_RUN_RETENTION_DAYS = 30;

/**
 * The article/cluster archive tables are written every run but never read by
 * the app (story pages serve from story_archive, coherence from
 * dataset_snapshots). Left uncapped they alone would fill Neon's 0.5GB free
 * tier in ~4 months, so they get the same 30-day cap as ingestion_runs.
 */
const ARCHIVE_RETENTION_DAYS = 30;

/** Keep the first row per key — first occurrence wins, like dedupeExact. */
function dedupeBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const k = key(row);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(row);
  }
  return unique;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Persist a processed dataset to PostgreSQL (best-effort archive).
 * Called from the scheduled refresh endpoint; failures are logged and never
 * break serving, which always happens from the in-process cache.
 *
 * Rows are DEDUPED by their upsert conflict target before insert: a single
 * `INSERT ... ON CONFLICT DO UPDATE` statement fails with "cannot affect row
 * a second time" when two rows share a conflict-target value, so one
 * duplicate id in a dataset must never take down the whole write (this
 * exact failure happened live when a split story re-minted its old cluster
 * id — see the takenIds guard in clustering — and every cron persist failed
 * for a day).
 */
export async function persistDataset(dataset: NewsDataset): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  let step = "articles";
  try {
    // Defense in depth: the pipeline already dedupes articles by canonical
    // URL and mints unique cluster ids; a regression upstream downgrades to
    // one skipped duplicate here instead of a failed persist.
    const articleRows = dedupeBy(
      dedupeBy(dataset.articles, (a) => a.canonicalUrl).map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        description: a.description,
        url: a.url,
        canonicalUrl: a.canonicalUrl,
        source: a.source,
        sourceSlug: a.sourceSlug,
        sourceDomain: a.sourceDomain,
        sourceTier: a.sourceTier,
        publishedAt: new Date(a.publishedAt),
        updatedAt: a.updatedAt ? new Date(a.updatedAt) : null,
        imageUrl: a.imageUrl,
        author: a.author,
        country: a.country,
        category: a.category,
        categoriesAll: a.categories,
        entities: a.entities,
        provider: a.provider,
        isMock: a.isMock,
      })),
      (row) => row.id,
    );
    for (const chunk of chunks(articleRows, INSERT_CHUNK)) {
      await db
        .insert(articles)
        .values(chunk)
        .onConflictDoUpdate({
          target: articles.canonicalUrl,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            updatedAt: sql`excluded.updated_at`,
            imageUrl: sql`excluded.image_url`,
          },
        });
    }

    step = "story_clusters";
    // dataset.clusters is sorted by rank, so "first wins" keeps the
    // higher-ranked cluster if an upstream bug ever duplicates an id again.
    const clusterRows = dedupeBy(dataset.clusters, (c) => c.id).map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      category: c.category,
      country: c.country,
      imageUrl: c.imageUrl,
      leadArticleId: c.lead.id,
      sourceCount: c.sourceCount,
      entities: c.entities,
      firstPublishedAt: new Date(c.firstPublishedAt),
      lastPublishedAt: new Date(c.lastPublishedAt),
      rankingScore: c.rankingScore,
      rankingBreakdown: { ...c.rankingBreakdown },
      status: c.status,
      isBreaking: c.isBreaking,
      isMock: c.isMock,
    }));
    for (const chunk of chunks(clusterRows, INSERT_CHUNK)) {
      await db
        .insert(storyClusters)
        .values(chunk)
        .onConflictDoUpdate({
          target: storyClusters.id,
          set: {
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            sourceCount: sql`excluded.source_count`,
            lastPublishedAt: sql`excluded.last_published_at`,
            rankingScore: sql`excluded.ranking_score`,
            rankingBreakdown: sql`excluded.ranking_breakdown`,
            status: sql`excluded.status`,
            isBreaking: sql`excluded.is_breaking`,
            updatedAtRow: sql`now()`,
          },
        });
    }

    step = "article_cluster_members";
    const memberRows = dedupeBy(
      dataset.clusters.flatMap((c) =>
        c.articles.map((a) => ({ clusterId: c.id, articleId: a.id })),
      ),
      (row) => `${row.clusterId}|${row.articleId}`,
    );
    for (const chunk of chunks(memberRows, INSERT_CHUNK)) {
      await db.insert(articleClusterMembers).values(chunk).onConflictDoNothing();
    }

    step = "ingestion_runs";
    await db.insert(ingestionRuns).values({
      startedAt: new Date(dataset.ingestion.startedAt),
      finishedAt: new Date(dataset.ingestion.finishedAt),
      durationMs: dataset.ingestion.durationMs,
      dataMode: dataset.dataMode,
      articlesReceived: dataset.ingestion.articlesReceived,
      articlesAccepted: dataset.ingestion.articlesAccepted,
      articlesRejected: dataset.ingestion.articlesRejected,
      duplicatesRemoved: dataset.ingestion.duplicatesRemoved,
      clusterCount: dataset.ingestion.clusterCount,
      providerStats: dataset.ingestion.providers,
    });

    step = "ranking_snapshots";
    const snapshotRows = dedupeBy(dataset.clusters, (c) => c.id)
      .slice(0, 100)
      .map((c, i) => ({
        clusterId: c.id,
        rank: i + 1,
        score: c.rankingScore,
        breakdown: { ...c.rankingBreakdown },
      }));
    if (snapshotRows.length > 0) {
      await db.insert(rankingSnapshots).values(snapshotRows);
    }

    logger.info("database.persisted", {
      articles: articleRows.length,
      clusters: clusterRows.length,
    });

    await enforceRetention();
    return true;
  } catch (error) {
    logger.error("database.persist_failed", {
      step,
      error: describeDbError(error),
    });
    return false;
  }
}

/**
 * Cap the append-only tables. Best-effort and separate from the persist
 * result: the dataset IS persisted even if a retention delete fails.
 */
async function enforceRetention(now: Date = new Date()): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const snapshotCutoff = new Date(
      now.getTime() - RANKING_SNAPSHOT_RETENTION_DAYS * 86_400_000,
    );
    const runCutoff = new Date(
      now.getTime() - INGESTION_RUN_RETENTION_DAYS * 86_400_000,
    );
    const archiveCutoff = new Date(
      now.getTime() - ARCHIVE_RETENTION_DAYS * 86_400_000,
    );
    await db
      .delete(rankingSnapshots)
      .where(lt(rankingSnapshots.capturedAt, snapshotCutoff));
    await db.delete(ingestionRuns).where(lt(ingestionRuns.startedAt, runCutoff));
    await db
      .delete(articleClusterMembers)
      .where(lt(articleClusterMembers.addedAt, archiveCutoff));
    await db.delete(articles).where(lt(articles.publishedAt, archiveCutoff));
    await db
      .delete(storyClusters)
      .where(lt(storyClusters.lastPublishedAt, archiveCutoff));
  } catch (error) {
    logger.warn("database.retention_failed", { error: describeDbError(error) });
  }
}
