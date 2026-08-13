import { sql } from "drizzle-orm";
import type { NewsDataset } from "@/lib/news/types";
import { logger } from "@/lib/utils/logger";
import { getDb } from "./client";
import {
  articleClusterMembers,
  articles,
  ingestionRuns,
  rankingSnapshots,
  storyClusters,
} from "./schema";

/**
 * Persist a processed dataset to PostgreSQL (best-effort archive).
 * Called from the scheduled refresh endpoint; failures are logged and never
 * break serving, which always happens from the in-process cache.
 */
export async function persistDataset(dataset: NewsDataset): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    await db
      .insert(articles)
      .values(
        dataset.articles.map((a) => ({
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
      )
      .onConflictDoUpdate({
        target: articles.canonicalUrl,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          updatedAt: sql`excluded.updated_at`,
          imageUrl: sql`excluded.image_url`,
        },
      });

    await db
      .insert(storyClusters)
      .values(
        dataset.clusters.map((c) => ({
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
        })),
      )
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

    const memberRows = dataset.clusters.flatMap((c) =>
      c.articles.map((a) => ({ clusterId: c.id, articleId: a.id })),
    );
    if (memberRows.length > 0) {
      await db.insert(articleClusterMembers).values(memberRows).onConflictDoNothing();
    }

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

    const snapshotRows = dataset.clusters.slice(0, 100).map((c, i) => ({
      clusterId: c.id,
      rank: i + 1,
      score: c.rankingScore,
      breakdown: { ...c.rankingBreakdown },
    }));
    if (snapshotRows.length > 0) {
      await db.insert(rankingSnapshots).values(snapshotRows);
    }

    logger.info("database.persisted", {
      articles: dataset.articles.length,
      clusters: dataset.clusters.length,
    });
    return true;
  } catch (error) {
    logger.error("database.persist_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}
