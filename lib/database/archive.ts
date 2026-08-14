import { and, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { isCategoryId } from "@/config/categories";
import type { SourceTier } from "@/config/sources";
import type {
  Article,
  ContentType,
  Country,
  NewsDataset,
  StoryCluster,
} from "@/lib/news/types";
import { COUNTRY_LABELS } from "@/lib/news/types";
import { slugify } from "@/lib/utils/text";
import { logger } from "@/lib/utils/logger";
import { getDb } from "./client";
import { storyArchive, type ArchivedSourceRef } from "./schema";

/**
 * Permanent story archive (best-effort, fully optional).
 *
 * The live dataset only holds ~72h of stories, but published /story/ URLs
 * are crawled and revisited for days. Every refresh upserts the current
 * clusters here so the story page can fall back to archived data when the
 * live dataset no longer knows a URL. Everything in this module is a no-op
 * when DATABASE_URL is unset — the app behaves exactly as before.
 */

/** Archived story as read back from the database (all dates ISO strings). */
export interface ArchivedStory {
  clusterId: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  geography: string;
  contentType: string | null;
  imageUrl: string | null;
  firstPublishedAt: string;
  lastPublishedAt: string;
  /** When WE first archived the story — CurrentWire's real publication time. */
  firstSeenAt: string;
  lastModifiedAt: string;
  rankingScore: number;
  sourceCount: number;
  sources: ArchivedSourceRef[];
  entities: string[];
  /**
   * When set, this story's cluster merged into another: its URL must
   * 308-redirect to the survivor instead of rendering a stale copy.
   * Always flattened to the final destination.
   */
  mergedIntoClusterId: string | null;
}

/** Insert-shaped row for the story_archive table. Pure, unit-testable. */
export function clusterToArchiveRow(cluster: StoryCluster, now: Date = new Date()) {
  return {
    clusterId: cluster.id,
    slug: cluster.slug,
    title: cluster.title,
    summary: cluster.summary ?? null,
    category: cluster.category,
    geography: cluster.country,
    contentType: cluster.contentType ?? null,
    imageUrl: cluster.imageUrl ?? null,
    firstPublishedAt: new Date(cluster.firstPublishedAt),
    lastPublishedAt: new Date(cluster.lastPublishedAt),
    // firstSeenAt is intentionally absent: the DB default stamps it on the
    // first insert and the upsert never touches it afterwards.
    lastModifiedAt: now,
    rankingScore: cluster.rankingScore,
    sourceCount: cluster.sourceCount,
    sources: cluster.articles.map(
      (a): ArchivedSourceRef => ({
        name: a.source,
        domain: a.sourceDomain,
        tier: a.sourceTier,
        url: a.url,
        publishedAt: a.publishedAt,
        title: a.title,
      }),
    ),
    entities: [...cluster.entities],
    updatedAt: now,
  };
}

/** Map a database row (Date-typed timestamps) to an ArchivedStory. */
export function rowToArchivedStory(
  row: typeof storyArchive.$inferSelect,
): ArchivedStory {
  return {
    clusterId: row.clusterId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    geography: row.geography,
    contentType: row.contentType,
    imageUrl: row.imageUrl,
    firstPublishedAt: row.firstPublishedAt.toISOString(),
    lastPublishedAt: row.lastPublishedAt.toISOString(),
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastModifiedAt: row.lastModifiedAt.toISOString(),
    rankingScore: row.rankingScore,
    sourceCount: row.sourceCount,
    sources: Array.isArray(row.sources) ? row.sources : [],
    entities: Array.isArray(row.entities) ? row.entities : [],
    mergedIntoClusterId: row.mergedIntoClusterId ?? null,
  };
}

const UPSERT_CHUNK = 100;

/**
 * Upsert every real cluster of the dataset into story_archive.
 * Best-effort: one try/catch, never throws into the cron flow. Returns the
 * number of clusters written (0 when no DB / mock mode / failure).
 */
export async function archiveDataset(dataset: NewsDataset): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  // Demo data must never occupy permanent story URLs.
  if (dataset.dataMode === "mock") return 0;
  const clusters = dataset.clusters.filter((c) => !c.isMock);
  if (clusters.length === 0) return 0;

  try {
    const now = new Date();
    for (let i = 0; i < clusters.length; i += UPSERT_CHUNK) {
      const rows = clusters
        .slice(i, i + UPSERT_CHUNK)
        .map((c) => clusterToArchiveRow(c, now));
      await db
        .insert(storyArchive)
        .values(rows)
        .onConflictDoUpdate({
          target: storyArchive.clusterId,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            summary: sql`excluded.summary`,
            category: sql`excluded.category`,
            geography: sql`excluded.geography`,
            contentType: sql`excluded.content_type`,
            imageUrl: sql`excluded.image_url`,
            firstPublishedAt: sql`excluded.first_published_at`,
            lastPublishedAt: sql`excluded.last_published_at`,
            lastModifiedAt: sql`excluded.last_modified_at`,
            rankingScore: sql`excluded.ranking_score`,
            sourceCount: sql`excluded.source_count`,
            sources: sql`excluded.sources`,
            entities: sql`excluded.entities`,
            updatedAt: sql`excluded.updated_at`,
            // A cluster id present in the CURRENT dataset is live again —
            // any old merge pointer is stale and must not redirect it.
            mergedIntoClusterId: sql`null`,
            // first_seen_at is deliberately NOT in this set — written once.
          },
          // Only touch rows whose story content actually changed (or that
          // carry a stale merge pointer needing to be cleared).
          setWhere: sql`${storyArchive.lastPublishedAt} is distinct from excluded.last_published_at
            or ${storyArchive.title} is distinct from excluded.title
            or ${storyArchive.summary} is distinct from excluded.summary
            or ${storyArchive.sourceCount} is distinct from excluded.source_count
            or ${storyArchive.mergedIntoClusterId} is not null`,
        });
    }
    const merges = await recordClusterMerges(dataset, now);
    logger.info("database.archived", { clusters: clusters.length, merges });
    return clusters.length;
  } catch (error) {
    logger.error("database.archive_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
}

/**
 * Pure merge detection: for each archived story whose cluster id vanished
 * from the current dataset, find where its member articles live now. If any
 * of its source URLs belong to a current cluster, the story merged there —
 * majority of URL votes wins, ties broken lexicographically for
 * determinism. Rows whose articles simply aged out produce no votes and are
 * left untouched (archived, not merged).
 */
export function computeClusterMerges(
  vanishedRows: { clusterId: string; sources: ArchivedSourceRef[] | null }[],
  urlToClusterId: Map<string, string>,
): { from: string; to: string }[] {
  const merges: { from: string; to: string }[] = [];
  for (const row of vanishedRows) {
    const votes = new Map<string, number>();
    for (const source of Array.isArray(row.sources) ? row.sources : []) {
      const target = urlToClusterId.get(source.url);
      if (target && target !== row.clusterId) {
        votes.set(target, (votes.get(target) ?? 0) + 1);
      }
    }
    if (votes.size === 0) continue;
    const survivor = [...votes.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    merges.push({ from: row.clusterId, to: survivor });
  }
  return merges;
}

/** Map every member article URL (raw and canonical) to its cluster id. */
export function buildUrlToClusterId(dataset: NewsDataset): Map<string, string> {
  const map = new Map<string, string>();
  for (const cluster of dataset.clusters) {
    for (const article of cluster.articles) {
      map.set(article.url, cluster.id);
      map.set(article.canonicalUrl, cluster.id);
    }
  }
  return map;
}

const MERGE_SCAN_WINDOW_HOURS = 72;
const MERGE_SCAN_CHUNK = 200;

/**
 * Record cluster merges as permanent redirects (audit invariant: merge →
 * redirect, never deletion). Chains are flattened at write time: recording
 * A → B also repoints every row that previously pointed at A, so a URL is
 * always one hop from its final destination. Only rows with coverage inside
 * the live 72h window are scanned — older rows cannot share articles with
 * the current dataset. Returns the number of merges recorded.
 */
async function recordClusterMerges(
  dataset: NewsDataset,
  now: Date,
): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const currentIds = new Set(dataset.clusters.map((c) => c.id));
  const cutoff = new Date(now.getTime() - MERGE_SCAN_WINDOW_HOURS * 3_600_000);

  // Cheap id-only pass first; sources jsonb is fetched only for the few
  // rows whose cluster id actually vanished from the current dataset.
  const idRows = await db
    .select({ clusterId: storyArchive.clusterId })
    .from(storyArchive)
    .where(
      and(
        isNull(storyArchive.mergedIntoClusterId),
        gte(storyArchive.lastPublishedAt, cutoff),
      ),
    );
  const vanished = idRows
    .map((r) => r.clusterId)
    .filter((id) => !currentIds.has(id));
  if (vanished.length === 0) return 0;

  const urlToClusterId = buildUrlToClusterId(dataset);
  let recorded = 0;
  for (let i = 0; i < vanished.length; i += MERGE_SCAN_CHUNK) {
    const rows = await db
      .select({ clusterId: storyArchive.clusterId, sources: storyArchive.sources })
      .from(storyArchive)
      .where(inArray(storyArchive.clusterId, vanished.slice(i, i + MERGE_SCAN_CHUNK)));
    for (const merge of computeClusterMerges(rows, urlToClusterId)) {
      await db
        .update(storyArchive)
        .set({ mergedIntoClusterId: merge.to, updatedAt: now })
        .where(eq(storyArchive.clusterId, merge.from));
      // Flatten: everything that pointed at the vanished id now points
      // straight at the survivor — never a redirect chain.
      await db
        .update(storyArchive)
        .set({ mergedIntoClusterId: merge.to, updatedAt: now })
        .where(eq(storyArchive.mergedIntoClusterId, merge.from));
      recorded++;
    }
  }
  return recorded;
}

/** The token after the last hyphen — the stable id suffix of story slugs. */
export function idTokenFromSlug(slug: string): string {
  return slug.slice(slug.lastIndexOf("-") + 1);
}

/**
 * Look up an archived story by slug, exact cluster id, or the trailing id
 * token of the slug (same alias rules as the live dataset). Returns null
 * when the DB is not configured, nothing matches, or the query fails.
 */
export async function findArchivedStory(slug: string): Promise<ArchivedStory | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const idToken = idTokenFromSlug(slug);
    const rows = await db
      .select()
      .from(storyArchive)
      .where(
        or(
          eq(storyArchive.slug, slug),
          // Bare cluster ids and re-titled old links resolve by the stable
          // id token — same alias rules as the live dataset.
          inArray(storyArchive.clusterId, [slug, idToken]),
        ),
      )
      .limit(3);
    if (rows.length === 0) return null;
    const exact = rows.find((r) => r.slug === slug) ?? rows.find((r) => r.clusterId === slug);
    return rowToArchivedStory(exact ?? rows[0]);
  } catch (error) {
    logger.error("database.archive_lookup_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * Batch lookup of first_seen_at for live clusters: our real publication
 * times, used as datePublished when available. Empty map when no DB.
 */
export async function getArchiveFirstSeen(
  clusterIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const db = getDb();
  if (!db || clusterIds.length === 0) return map;
  try {
    const rows = await db
      .select({
        clusterId: storyArchive.clusterId,
        firstSeenAt: storyArchive.firstSeenAt,
      })
      .from(storyArchive)
      .where(inArray(storyArchive.clusterId, clusterIds));
    for (const row of rows) map.set(row.clusterId, row.firstSeenAt.toISOString());
    return map;
  } catch (error) {
    logger.error("database.archive_first_seen_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return map;
  }
}

/**
 * URL-health counters for the admin dashboard: how many stories the
 * permanent archive knows, and how many of them are merge redirects.
 * Null when no database is configured or the query fails.
 */
export async function getArchiveStats(): Promise<{
  archived: number;
  merged: number;
} | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db
      .select({
        archived: sql<string>`count(*)`,
        merged: sql<string>`count(*) filter (where ${storyArchive.mergedIntoClusterId} is not null)`,
      })
      .from(storyArchive);
    if (!row) return null;
    return { archived: Number(row.archived), merged: Number(row.merged) };
  } catch (error) {
    logger.error("database.archive_stats_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

const CONTENT_TYPES: ContentType[] = ["news", "opinion", "analysis", "press_release", "live"];

/**
 * Rebuild a renderable StoryCluster from an archived row so the story page
 * reuses the exact same layout and components. Fields the archive does not
 * keep (ranking breakdown, status flags) get neutral values; stored enum
 * values that no longer exist fall back to safe defaults.
 */
export function archivedStoryToCluster(story: ArchivedStory): StoryCluster {
  const category = isCategoryId(story.category) ? story.category : "general";
  const country: Country =
    story.geography in COUNTRY_LABELS ? (story.geography as Country) : "GLOBAL";
  const contentType = CONTENT_TYPES.includes(story.contentType as ContentType)
    ? (story.contentType as ContentType)
    : undefined;

  const articles: Article[] = story.sources.map((s, index) => ({
    id: `${story.clusterId}-src${index}`,
    slug: "",
    title: s.title,
    url: s.url,
    canonicalUrl: s.url,
    source: s.name,
    sourceSlug: slugify(s.name, 60),
    sourceDomain: s.domain,
    sourceTier: (["A", "B", "C"].includes(s.tier) ? s.tier : "C") as SourceTier,
    publishedAt: s.publishedAt,
    country,
    category,
    categories: [category],
    entities: [],
    provider: "archive",
    isMock: false,
  }));
  // The archive always stores at least the lead source; guard anyway.
  const lead =
    articles[0] ??
    ({
      id: `${story.clusterId}-src0`,
      slug: "",
      title: story.title,
      url: "",
      canonicalUrl: "",
      source: "CurrentWire archive",
      sourceSlug: "currentwire-archive",
      sourceDomain: "",
      sourceTier: "C",
      publishedAt: story.firstPublishedAt,
      country,
      category,
      categories: [category],
      entities: [],
      provider: "archive",
      isMock: false,
    } satisfies Article);

  return {
    id: story.clusterId,
    slug: story.slug,
    title: story.title,
    summary: story.summary ?? undefined,
    category,
    country,
    contentType,
    imageUrl: story.imageUrl ?? undefined,
    articles: articles.length > 0 ? articles : [lead],
    lead,
    sourceCount: story.sourceCount,
    sourceNames: [...new Set(articles.map((a) => a.source))],
    entities: [...story.entities],
    firstPublishedAt: story.firstPublishedAt,
    lastPublishedAt: story.lastPublishedAt,
    rankingScore: story.rankingScore,
    rankingBreakdown: {
      freshness: 0,
      authority: 0,
      coverage: 0,
      geography: 0,
      prominence: 0,
      velocity: 0,
      total: story.rankingScore,
    },
    status: null,
    isBreaking: false,
    isMock: false,
  };
}
