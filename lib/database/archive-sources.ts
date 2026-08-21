import { and, asc, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { logger } from "@/lib/utils/logger";
import { ArchiveUnavailableError, ensureArchiveSchema } from "./archive";
import { getDb } from "./client";
import { describeDbError } from "./errors";
import { storyArchive } from "./schema";

/**
 * Aggregate view of the story_archive source union — the read behind
 * GET /api/stats/archive-sources (public, read-only, aggregate-only).
 *
 * story_archive keeps two different coverage numbers for every story:
 * `source_count` is the ACTIVE publication count at the last upsert (what
 * every live surface shows), while `sources` is the PERMANENT union of every
 * source ever seen on the story. The `history` jsonb additionally records
 * coverage_change events ({from, to}) between refreshes. This module reports
 * all three per row — as counts only — so an audit can measure how far the
 * stored active count drifts from the union, without ever shipping the raw
 * jsonb (article URLs, titles) to the client. Everything is aggregated in
 * SQL via jsonb_array_elements subselects so Neon transfer stays small.
 *
 * `history` is runtime-migrated (ensureArchiveSchema): when the column is
 * not known to exist the history-derived fields are null / 0 and the query
 * never references the column.
 */

/** Cluster ids are `c` + 12 hex chars (stableId, lib/utils/text.ts). */
export const ARCHIVE_SOURCES_CLUSTER_ID_RE = /^c[0-9a-f]{12}$/;
export const ARCHIVE_SOURCES_MAX_IDS = 500;
export const ARCHIVE_SOURCES_DEFAULT_LIMIT = 1000;
export const ARCHIVE_SOURCES_MAX_LIMIT = 2000;
export const ARCHIVE_SOURCES_MAX_RANGE_DAYS = 9;
/** Matches the route's CDN s-maxage: one Neon read per distinct query per hour. */
const ARCHIVE_SOURCES_TTL_S = 3_600;

const DAY_MS = 86_400_000;

/** One archived story, counts only — no URLs, titles or names. */
export interface ArchiveSourcesRow {
  /** Cluster id. */
  id: string;
  slug: string;
  /** ISO — when CurrentWire first archived the story. */
  firstSeenAt: string;
  /** Stored ACTIVE publication count at the last upsert. */
  sourceCount: number;
  /** jsonb_array_length(sources) — every report ever seen, by URL. */
  unionSources: number;
  /** Distinct trimmed non-empty publication names in the union. */
  unionPublications: number;
  /**
   * Max over history coverage_change events of greatest(from, to); null
   * when the history is empty or the column is not migrated.
   */
  peakHistoryCoverage: number | null;
  /** jsonb_array_length(history); 0 when the column is not migrated. */
  historyEvents: number;
  /** Any sources element carries a firstSeenAt key — written by union-era code. */
  stamped: boolean;
  /** merged_into_cluster_id is set — the URL redirects to a survivor. */
  merged: boolean;
}

/** A validated query — plain, JSON-serialisable (it doubles as the cache key). */
export type ArchiveSourcesQuery =
  | { mode: "ids"; ids: string[] }
  | {
      mode: "range";
      /** ISO, inclusive lower bound on first_seen_at. */
      from: string;
      /** ISO, exclusive upper bound on first_seen_at. */
      to: string;
      limit: number;
      offset: number;
    };

export type ArchiveSourcesParseResult =
  | { ok: true; query: ArchiveSourcesQuery }
  | { ok: false; error: string };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;
const NON_NEGATIVE_INT_RE = /^\d+$/;

/**
 * ISO datetime or YYYY-MM-DD (taken as midnight UTC) → normalised ISO
 * string; null when the value is not one of those two shapes or does not
 * denote a real instant.
 */
export function parseArchiveSourcesInstant(value: string): string | null {
  const trimmed = value.trim();
  let candidate: string;
  if (DATE_ONLY_RE.test(trimmed)) candidate = `${trimmed}T00:00:00.000Z`;
  else if (ISO_DATETIME_RE.test(trimmed)) candidate = trimmed;
  else return null;
  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function parseBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (raw === null) return fallback;
  const trimmed = raw.trim();
  if (!NON_NEGATIVE_INT_RE.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

/**
 * Validate the route's query string into an ArchiveSourcesQuery.
 *
 * EITHER `ids` (comma-separated cluster ids, 1..500, each c + 12 hex) OR
 * `from` & `to` (ISO datetime or YYYY-MM-DD; [from, to) on first_seen_at,
 * at most 9 days) with optional `limit` (1..2000, default 1000) and `offset`
 * (>= 0, default 0). Anything else is a 400 with the returned message. Pure.
 */
export function parseArchiveSourcesParams(
  params: URLSearchParams,
): ArchiveSourcesParseResult {
  const idsRaw = params.get("ids");
  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const hasIds = idsRaw !== null;
  const hasRange = fromRaw !== null || toRaw !== null;

  if (hasIds && hasRange) {
    return { ok: false, error: "use either ids or from/to, not both" };
  }
  if (!hasIds && !hasRange) {
    return { ok: false, error: "ids or from/to is required" };
  }

  if (hasIds) {
    const tokens = idsRaw
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (tokens.length === 0) return { ok: false, error: "ids is empty" };
    if (tokens.length > ARCHIVE_SOURCES_MAX_IDS) {
      return { ok: false, error: `ids accepts at most ${ARCHIVE_SOURCES_MAX_IDS} cluster ids` };
    }
    if (!tokens.every((token) => ARCHIVE_SOURCES_CLUSTER_ID_RE.test(token))) {
      return {
        ok: false,
        error: "ids must be comma-separated cluster ids (c followed by 12 hex characters)",
      };
    }
    return { ok: true, query: { mode: "ids", ids: [...new Set(tokens)] } };
  }

  if (fromRaw === null || toRaw === null) {
    return { ok: false, error: "from and to are both required" };
  }
  const from = parseArchiveSourcesInstant(fromRaw);
  const to = parseArchiveSourcesInstant(toRaw);
  if (!from || !to) {
    return { ok: false, error: "from and to must be ISO datetimes or YYYY-MM-DD dates" };
  }
  const span = Date.parse(to) - Date.parse(from);
  if (span <= 0) return { ok: false, error: "to must be after from" };
  if (span > ARCHIVE_SOURCES_MAX_RANGE_DAYS * DAY_MS) {
    return {
      ok: false,
      error: `from/to may span at most ${ARCHIVE_SOURCES_MAX_RANGE_DAYS} days`,
    };
  }
  const limit = parseBoundedInt(
    params.get("limit"),
    ARCHIVE_SOURCES_DEFAULT_LIMIT,
    1,
    ARCHIVE_SOURCES_MAX_LIMIT,
  );
  if (limit === null) {
    return { ok: false, error: `limit must be an integer from 1 to ${ARCHIVE_SOURCES_MAX_LIMIT}` };
  }
  const offset = parseBoundedInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  if (offset === null) return { ok: false, error: "offset must be a non-negative integer" };
  return { ok: true, query: { mode: "range", from, to, limit, offset } };
}

/**
 * The per-row aggregate expressions, as SQL fragments. Exported so tests can
 * render them (PgDialect) without a database. Every jsonb column is wrapped
 * in a typeof guard so a malformed (non-array) value yields zeros instead of
 * failing the whole page of rows; numeric history fields are regex-guarded
 * before the int cast for the same reason.
 */
export function archiveSourcesAggregates(hasHistory: boolean): {
  unionSources: SQL<number>;
  unionPublications: SQL<number>;
  stamped: SQL<boolean>;
  peakHistoryCoverage: SQL<number | null>;
  historyEvents: SQL<number>;
} {
  const sourcesArray = sql`(case when jsonb_typeof(${storyArchive.sources}) = 'array' then ${storyArchive.sources} else '[]'::jsonb end)`;
  const historyArray = sql`(case when jsonb_typeof(${storyArchive.history}) = 'array' then ${storyArchive.history} else '[]'::jsonb end)`;
  const intField = (key: string) =>
    sql`(case when (e->>${key}) ~ '^[0-9]+$' then (e->>${key})::int else null end)`;
  return {
    unionSources: sql<number>`jsonb_array_length(${sourcesArray})::int`,
    unionPublications: sql<number>`(select count(distinct nullif(btrim(s->>'name'), '')) from jsonb_array_elements(${sourcesArray}) as s)::int`,
    stamped: sql<boolean>`exists (select 1 from jsonb_array_elements(${sourcesArray}) as s where jsonb_typeof(s) = 'object' and s ? 'firstSeenAt')`,
    peakHistoryCoverage: hasHistory
      ? sql<
          number | null
        >`(select max(greatest(${intField("from")}, ${intField("to")})) from jsonb_array_elements(${historyArray}) as e where e->>'kind' = 'coverage_change')::int`
      : sql<number | null>`null::int`,
    historyEvents: hasHistory
      ? sql<number>`jsonb_array_length(${historyArray})::int`
      : sql<number>`0::int`,
  };
}

/** Row shape as the driver returns it (counts may arrive as strings). */
export interface ArchiveSourcesDbRow {
  clusterId: string;
  slug: string;
  firstSeenAt: Date | string;
  sourceCount: number | string;
  unionSources: number | string | null;
  unionPublications: number | string | null;
  peakHistoryCoverage: number | string | null;
  historyEvents: number | string | null;
  stamped: boolean | null;
  merged: boolean | null;
}

function toInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** Pure driver-row → API-row mapping. */
export function mapArchiveSourcesRow(row: ArchiveSourcesDbRow): ArchiveSourcesRow {
  const peak =
    row.peakHistoryCoverage === null || row.peakHistoryCoverage === undefined
      ? null
      : toInt(row.peakHistoryCoverage);
  return {
    id: row.clusterId,
    slug: row.slug,
    firstSeenAt:
      row.firstSeenAt instanceof Date
        ? row.firstSeenAt.toISOString()
        : new Date(row.firstSeenAt).toISOString(),
    sourceCount: toInt(row.sourceCount),
    unionSources: toInt(row.unionSources),
    unionPublications: toInt(row.unionPublications),
    peakHistoryCoverage: peak,
    historyEvents: toInt(row.historyEvents),
    stamped: row.stamped === true,
    merged: row.merged === true,
  };
}

export interface ArchiveSourcesResult {
  rows: ArchiveSourcesRow[];
  /** Range mode only: more rows exist past limit+offset. Always false for ids. */
  truncated: boolean;
}

/**
 * unstable_cache with a fallback for non-Next runtimes (same shape as
 * lib/database/archive.ts): outside a server request context it throws
 * "Invariant: incrementalCache missing ...", so vitest and scripts run the
 * real uncached query instead. Failures are never cached.
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
 * Run a validated query. No DB configured → empty rows (that deployment has
 * no archive). A FAILED query throws ArchiveUnavailableError so the route
 * answers 503 — never an empty 200 that reads as "nothing archived".
 *
 * Range mode fetches limit+1 rows ordered by (first_seen_at, cluster_id) so
 * paging with offset is stable and `truncated` is exact.
 */
async function queryArchiveSourcesUncached(
  query: ArchiveSourcesQuery,
): Promise<ArchiveSourcesResult> {
  const db = getDb();
  if (!db) return { rows: [], truncated: false };
  try {
    const hasHistory = await ensureArchiveSchema();
    const aggregates = archiveSourcesAggregates(hasHistory);
    const selection = {
      clusterId: storyArchive.clusterId,
      slug: storyArchive.slug,
      firstSeenAt: storyArchive.firstSeenAt,
      sourceCount: storyArchive.sourceCount,
      unionSources: aggregates.unionSources,
      unionPublications: aggregates.unionPublications,
      peakHistoryCoverage: aggregates.peakHistoryCoverage,
      historyEvents: aggregates.historyEvents,
      stamped: aggregates.stamped,
      merged: sql<boolean>`${storyArchive.mergedIntoClusterId} is not null`,
    };
    if (query.mode === "ids") {
      const rows = await db
        .select(selection)
        .from(storyArchive)
        .where(inArray(storyArchive.clusterId, query.ids))
        .orderBy(asc(storyArchive.firstSeenAt), asc(storyArchive.clusterId));
      return { rows: rows.map(mapArchiveSourcesRow), truncated: false };
    }
    const rows = await db
      .select(selection)
      .from(storyArchive)
      .where(
        and(
          gte(storyArchive.firstSeenAt, new Date(query.from)),
          lt(storyArchive.firstSeenAt, new Date(query.to)),
        ),
      )
      .orderBy(asc(storyArchive.firstSeenAt), asc(storyArchive.clusterId))
      .limit(query.limit + 1)
      .offset(query.offset);
    const truncated = rows.length > query.limit;
    return {
      rows: (truncated ? rows.slice(0, query.limit) : rows).map(mapArchiveSourcesRow),
      truncated,
    };
  } catch (error) {
    logger.error("database.archive_sources_query_failed", {
      error: describeDbError(error),
    });
    throw new ArchiveUnavailableError("archive sources query", error);
  }
}

/** Cached read; the serialised query is the cache key (ids are de-duplicated). */
export const getArchiveSources = cachedRead(
  "archive-sources",
  ARCHIVE_SOURCES_TTL_S,
  queryArchiveSourcesUncached,
);
