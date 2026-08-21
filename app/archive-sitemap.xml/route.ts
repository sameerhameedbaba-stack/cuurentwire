import { and, desc, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import {
  ArchiveUnavailableError,
  ensureArchiveSchema,
  listArchivedStoriesForSitemap,
} from "@/lib/database/archive";
import { getDb } from "@/lib/database/client";
import { describeDbError } from "@/lib/database/errors";
import { storyArchive } from "@/lib/database/schema";
import {
  ARCHIVE_SITEMAP_MAX_ENTRIES,
  renderArchiveSitemap,
  type ArchiveSitemapEntry,
} from "@/lib/seo/archive-sitemap";
import {
  gscProtectedStoryIds,
  gscSignalsAvailable,
  gscSignalsVersion,
} from "@/lib/seo/gsc-signals";
import {
  archiveSitemapIndexableSql,
  THIN_STORY_NOINDEX_ENABLED,
} from "@/lib/seo/story-indexing";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * One hour, not the archive's 6h row TTL: stories cross the 336h evaluation
 * window boundary every refresh, and this TTL (plus the 1h CDN max-age
 * below) is the longest a URL that now answers noindex can stay advertised
 * here. One query per hour is nothing against Neon's transfer quota.
 */
const INDEXABLE_SITEMAP_TTL_S = 3_600;

/**
 * unstable_cache with a fallback for non-Next runtimes (same shape as
 * lib/database/briefing.ts): outside a server request context it throws
 * "Invariant: incrementalCache missing ...", so vitest and scripts run the
 * real uncached query instead.
 */
function cachedRead<Args extends unknown[], Result>(
  keyPrefix: string,
  ttlSeconds: number,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  const cached = unstable_cache(fn, [keyPrefix], { revalidate: ttlSeconds });
  return async (...args) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("incrementalCache missing")
      ) {
        return fn(...args);
      }
      throw error;
    }
  };
}

/**
 * Non-merged archived stories that the thin-story policy keeps INDEXABLE,
 * newest first — the sitemap must never advertise a URL whose page answers
 * noindex. The predicate is archiveSitemapIndexableSql (the SQL
 * approximation documented next to storyIndexDecision in
 * lib/seo/story-indexing.ts):
 *
 *   first_seen_at > now() - interval '336 hours'
 *   OR source_count >= 2
 *   OR jsonb_array_length(sources) >= 2
 *   OR jsonb_array_length(history) > 0
 *   OR cluster_id = any(<Search Console protected ids>)
 *
 * `signalsVersion` is the committed Search Console report's generatedAt
 * (gscSignalsVersion()): it is an argument only so the Data Cache key
 * changes when a new weekly report deploys — the protected ids themselves
 * are read inside, never passed (thousands of ids make a poor cache key).
 *
 * Same outage contract as listArchivedStoriesForSitemap: no DB configured
 * is an empty list (that deployment has no archive); a FAILED query — or a
 * schema that never migrated the runtime-added `history` column this
 * predicate reads — throws ArchiveUnavailableError so the route answers
 * 503, not an empty urlset.
 */
const listIndexableArchivedStories = cachedRead(
  "archive-sitemap-indexable",
  INDEXABLE_SITEMAP_TTL_S,
  async function listIndexableArchivedStoriesUncached(
    signalsVersion: string,
    limit: number = ARCHIVE_SITEMAP_MAX_ENTRIES,
  ): Promise<ArchiveSitemapEntry[]> {
    const db = getDb();
    if (!db) return [];
    try {
      if (!(await ensureArchiveSchema())) {
        throw new Error("archive schema not migrated (history column)");
      }
      const rows = await db
        .select({
          slug: storyArchive.slug,
          lastModifiedAt: storyArchive.lastModifiedAt,
        })
        .from(storyArchive)
        .where(
          and(
            isNull(storyArchive.mergedIntoClusterId),
            archiveSitemapIndexableSql(gscProtectedStoryIds()),
          ),
        )
        .orderBy(desc(storyArchive.firstSeenAt))
        .limit(limit);
      return rows.map((row) => ({
        slug: row.slug,
        lastModifiedAt:
          row.lastModifiedAt instanceof Date
            ? row.lastModifiedAt.toISOString()
            : String(row.lastModifiedAt),
      }));
    } catch (error) {
      logger.error("database.archive_sitemap_query_failed", {
        error: describeDbError(error),
        signalsVersion,
      });
      throw new ArchiveUnavailableError("archive sitemap query", error);
    }
  },
);

/**
 * The filtered listing only applies when the policy can actually noindex a
 * page: the switch is on AND a fresh Search Console report exists. With the
 * switch off (THIN_STORY_NOINDEX=off) or without a fresh report every story
 * page answers indexable (the policy never noindexes without Google data),
 * so the sitemap lists every non-merged archived story to match.
 */
function listSitemapEntries(): Promise<ArchiveSitemapEntry[]> {
  return THIN_STORY_NOINDEX_ENABLED && gscSignalsAvailable()
    ? listIndexableArchivedStories(gscSignalsVersion())
    : listArchivedStoriesForSitemap();
}

/** Every permanent, indexable /story/ URL (see lib/seo/archive-sitemap.ts). */
export async function GET() {
  let entries: ArchiveSitemapEntry[];
  try {
    entries = await listSitemapEntries();
  } catch (error) {
    if (!(error instanceof ArchiveUnavailableError)) throw error;
    // An empty <urlset> is not a neutral fallback. It is a well-formed
    // statement that this site has zero permanent story URLs, served with
    // a 200 that invites crawlers to believe it and a max-age that lets
    // them cache the claim for an hour. On 2026-08-21 that is exactly what
    // it said about 2,793 URLs while the archive was down.
    //
    // 503 says the opposite and says it correctly: the answer is unknown,
    // come back later, keep what you already have. Google's documented
    // handling of a 503 sitemap is to retry and retain the previous
    // contents, which is precisely the behaviour an outage needs.
    logger.error("seo.archive_sitemap_unavailable", { error: error.message });
    return new Response(
      "<!-- archive temporarily unavailable; retry later -->",
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Retry-After": "3600",
          // Never let a shared cache hold the outage past its end.
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return new Response(renderArchiveSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Changes at most once per refresh cycle; crawlers can cache longer.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    },
  });
}
