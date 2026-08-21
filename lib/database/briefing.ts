import { desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { filterClusters } from "@/lib/news/queries";
import { isTop100Eligible } from "@/lib/news/ranking/score";
import type { NewsDataset } from "@/lib/news/types";
import { newsDayET } from "@/lib/utils/news-day";
import { logger } from "@/lib/utils/logger";
import { getDb } from "./client";
import { describeDbError } from "./errors";
import { dailyBriefings, type BriefingItem } from "./schema";

/**
 * Daily briefing store (best-effort, fully optional — like the archive).
 *
 * Every successful live refresh upserts today's Eastern-time row with the
 * current top stories, so the row for a date freezes naturally when the
 * date rolls over. Past rows are immutable and power the permanent
 * /briefing/<date> pages; a broken write must never break the cron.
 */

const BRIEFING_SIZE = 10;

/** How many past days /briefing lists. */
export const BRIEFING_INDEX_LIMIT = 366;

const briefingSchemaEnsured = new WeakMap<object, Promise<boolean>>();

/**
 * Runtime table creation, same policy as ensureArchiveSchema: Neon is only
 * reachable through DATABASE_URL in the deployment, so the app applies its
 * own additive DDL. `create table if not exists` is idempotent; the
 * existence check first keeps the steady-state cost to one cheap read per
 * process.
 */
export function ensureBriefingSchema(): Promise<boolean> {
  const db = getDb();
  if (!db) return Promise.resolve(false);
  const cached = briefingSchemaEnsured.get(db);
  if (cached) return cached;
  const attempt = runBriefingSchemaMigration(db).catch((error) => {
    logger.warn("database.briefing_schema_ensure_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  });
  briefingSchemaEnsured.set(db, attempt);
  return attempt;
}

async function runBriefingSchemaMigration(
  db: NonNullable<ReturnType<typeof getDb>>,
): Promise<boolean> {
  const existing = await db.execute(sql`
    select 1 from pg_tables
    where schemaname = current_schema() and tablename = 'daily_briefings'
  `);
  if (existing.rows.length === 0) {
    await db.execute(sql`
      create table if not exists daily_briefings (
        briefing_date varchar(10) primary key,
        items jsonb not null default '[]'::jsonb,
        updated_at timestamptz not null default now()
      )
    `);
  }
  return true;
}

/** The dataset's current top stories in stored-briefing shape. */
export function briefingItemsFrom(dataset: NewsDataset): BriefingItem[] {
  return filterClusters(dataset.clusters.filter(isTop100Eligible), {})
    .slice(0, BRIEFING_SIZE)
    .map((cluster, index) => ({
      rank: index + 1,
      slug: cluster.slug,
      title: cluster.title,
      summary: cluster.summary ?? null,
      category: cluster.category,
      country: cluster.country,
      sourceCount: cluster.sourceCount,
      leadSource: cluster.lead.source,
    }));
}

/**
 * Upsert today's briefing row. Best-effort: failures are logged, never
 * thrown. Mock datasets are skipped — demo stories must never freeze into
 * a permanent briefing.
 */
export async function upsertDailyBriefing(dataset: NewsDataset): Promise<boolean> {
  if (dataset.dataMode === "mock") return false;
  const items = briefingItemsFrom(dataset);
  if (items.length === 0) return false;
  try {
    if (!(await ensureBriefingSchema())) return false;
    const db = getDb();
    if (!db) return false;
    await db
      .insert(dailyBriefings)
      .values({ briefingDate: newsDayET(), items })
      .onConflictDoUpdate({
        target: dailyBriefings.briefingDate,
        set: { items, updatedAt: sql`now()` },
      });
    return true;
  } catch (error) {
    logger.warn("database.briefing_upsert_failed", {
      error: describeDbError(error),
    });
    return false;
  }
}

export interface StoredBriefing {
  date: string;
  items: BriefingItem[];
  updatedAt: string;
}

/**
 * Read-through cache, mirroring archive.ts cachedRead: Neon's free-plan
 * transfer quota cannot afford a query per ISR render, and past briefings
 * are immutable. Falls back to the raw query outside a Next request scope
 * (vitest, scripts).
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
 * A stored briefing for a past day, or null when no row exists. Query
 * failures THROW (they must fail the ISR revalidation and keep the last
 * good page, not replace a real briefing with a 404).
 */
export const getBriefing = cachedRead(
  "briefing-day",
  3_600,
  async (date: string): Promise<StoredBriefing | null> => {
    if (!(await ensureBriefingSchema())) return null;
    const db = getDb();
    if (!db) return null;
    const rows = await db
      .select()
      .from(dailyBriefings)
      .where(eq(dailyBriefings.briefingDate, date))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      date: row.briefingDate,
      items: row.items,
      updatedAt: row.updatedAt.toISOString(),
    };
  },
);

/**
 * Past briefing dates, newest first, today excluded (today lives at
 * /briefing itself). Fail-soft: without a database — or during an outage —
 * the index page still renders today's live briefing with no history list.
 */
export const listBriefingDates = cachedRead(
  "briefing-dates",
  1_800,
  async (): Promise<string[]> => {
    try {
      if (!(await ensureBriefingSchema())) return [];
      const db = getDb();
      if (!db) return [];
      const rows = await db
        .select({ briefingDate: dailyBriefings.briefingDate })
        .from(dailyBriefings)
        .orderBy(desc(dailyBriefings.briefingDate))
        .limit(BRIEFING_INDEX_LIMIT);
      const today = newsDayET();
      return rows.map((r) => r.briefingDate).filter((d) => d < today);
    } catch (error) {
      logger.warn("database.briefing_dates_failed", {
        error: describeDbError(error),
      });
      return [];
    }
  },
);
