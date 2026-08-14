import { eq, inArray, or, sql } from "drizzle-orm";
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
            // first_seen_at is deliberately NOT in this set — written once.
          },
          // Only touch rows whose story content actually changed.
          setWhere: sql`${storyArchive.lastPublishedAt} is distinct from excluded.last_published_at
            or ${storyArchive.title} is distinct from excluded.title
            or ${storyArchive.summary} is distinct from excluded.summary
            or ${storyArchive.sourceCount} is distinct from excluded.source_count`,
        });
    }
    logger.info("database.archived", { clusters: clusters.length });
    return clusters.length;
  } catch (error) {
    logger.error("database.archive_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
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

const CONTENT_TYPES: ContentType[] = ["news", "opinion", "analysis", "press_release", "live"];

/**
 * Rebuild a renderable StoryCluster from an archived row so the story page
 * reuses the exact same layout and components. Fields the archive does not
 * keep (ranking breakdown, status flags) get neutral values; stored enum
 * values that no longer exist fall back to safe defaults.
 */
export function archivedStoryToCluster(story: ArchivedStory): StoryCluster {
  const category = isCategoryId(story.category) ? story.category : "world";
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
