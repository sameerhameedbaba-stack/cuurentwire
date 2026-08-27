import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { forceRefresh, getDataset } from "@/lib/cache/store";
import { upsertDailyBriefing } from "@/lib/database/briefing";
import { isDatabaseConfigured } from "@/lib/database/client";
import { persistDataset } from "@/lib/database/persist";
import {
  archivePublicDataset,
  claimCronBurst,
  drainPendingIndexNowIds,
  markPersisted,
  releaseCronBurst,
  shouldPersistNow,
} from "@/lib/database/persist-gate";
import { env } from "@/lib/env";
import { compactDataset } from "@/lib/news/compact";
import type { NewsDataset } from "@/lib/news/types";
import { pingIndexNow } from "@/lib/seo/indexnow";
import { warmHomepageHero } from "@/lib/seo/warm-hero";
import { logger } from "@/lib/utils/logger";
import { secureCompare } from "@/lib/utils/secure-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Best-effort guard against unauthenticated hammering. Module state is
// per-instance (serverless instances each get their own window), so this is
// not a global limit — it only bounds abuse of a single warm instance.
// Only UNAUTHORIZED attempts count toward the window (audit F5): counting
// before auth let an attacker 429 the real scheduled cron out of its slot.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
let rateWindowStart = 0;
let rateWindowCount = 0;

function rateLimited(): boolean {
  const now = Date.now();
  if (now - rateWindowStart >= RATE_LIMIT_WINDOW_MS) {
    rateWindowStart = now;
    rateWindowCount = 0;
  }
  rateWindowCount += 1;
  return rateWindowCount > RATE_LIMIT_MAX;
}

/**
 * ISR'd public surfaces, revalidated only on persist bursts (~30 min).
 * COST constraint, 2026-08-24: the original audit-F1 version also nuked the
 * four dynamic patterns (/story/[slug], /topic/[slug], /source/[slug],
 * /[category]) on EVERY run, which invalidated every cached page site-wide
 * and turned each bot crawl of ~3,600 archive story URLs into a billed ISR
 * write + a billed render — 238% of the Hobby ISR-write tier and 307% of
 * its CPU tier, which paused the whole account. Literal core pages stay;
 * live-story freshness is handled per-slug by revalidateLiveStories below;
 * everything else ages out on its segment revalidate. Do not add dynamic
 * patterns back — the quota math lives in seo/PLAYBOOK.md.
 */
const ISR_SURFACES: string[] = [
  "/",
  "/us",
  "/canada",
  "/topics",
  "/sources",
  "/most-covered",
];

/** Best-effort: a revalidation failure must never fail the cron response. */
function revalidateIsrSurfaces(): void {
  for (const path of ISR_SURFACES) {
    try {
      revalidatePath(path);
    } catch (error) {
      logger.warn("cron.revalidate_path_failed", {
        path,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

/**
 * Targeted freshness for the stories that are actually live: mark each
 * current (non-mock) cluster's story path for lazy re-render on its next
 * visit. Bounded and burst-gated, so the write cost is capped at
 * ~150 pages × ~48 bursts/day realized only when a page is visited —
 * instead of the site-wide pattern nuke that blew the Hobby tier.
 * Archived stories (the ~3,600-URL long tail) are intentionally NOT
 * revalidated here; they change only via merge pointers and age out on
 * the story route's own revalidate window.
 */
const LIVE_REVALIDATE_MAX = 150;

function revalidateLiveStories(dataset: NewsDataset): void {
  const live = dataset.clusters.filter((c) => !c.isMock);
  for (const cluster of live.slice(0, LIVE_REVALIDATE_MAX)) {
    try {
      revalidatePath(`/story/${cluster.slug}`);
    } catch (error) {
      logger.warn("cron.revalidate_story_failed", {
        slug: cluster.slug,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

/**
 * Scheduled news refresh.
 * Protected by CRON_SECRET via `Authorization: Bearer <secret>` (Vercel Cron
 * convention) or an `x-cron-secret` header. Refreshes the in-process cache on
 * every run; the database work (dataset persist, archive upsert, briefing)
 * runs only on the ~30-minute batch cadence decided by persist-gate.ts, so
 * Neon compute can suspend between bursts instead of being kept awake by the
 * 5-minute cron (owner's $30/mo cap — seo/PLAYBOOK.md). Deferred runs report
 * `persistenceDeferred: true` with the persistence fields at their idle
 * values, so a false `persistedToDatabase` still means what it always did.
 */
/** Diagnostics only — a measurement failure must never fail the refresh. */
function safeCacheEntryBytes(dataset: NewsDataset): number | undefined {
  try {
    return JSON.stringify(compactDataset(dataset)).length;
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  const secret = env.cronSecret;
  if (!secret) {
    // Refuse to run unauthenticated in production; allow locally for testing.
    if (env.isProduction) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 503 },
      );
    }
  } else {
    const auth = request.headers.get("authorization");
    const headerSecret = request.headers.get("x-cron-secret");
    const authorized =
      secureCompare(auth, `Bearer ${secret}`) ||
      secureCompare(headerSecret, secret);
    if (!authorized) {
      // Auth verified first; only failed attempts spend the rate window, so
      // hammering can never 429 the genuine scheduled cron (audit F5).
      if (rateLimited()) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Cadence guard: the scheduler may ping more often than the refresh
    // interval (RSS_REFRESH_MINUTES, default 15). A dataset younger than
    // the interval is served as-is — each real refresh costs ~1s of
    // function CPU with ~100 feeds, and the Fluid CPU allowance is a
    // standing cost constraint. `?force=1` bypasses the guard.
    const force = request.nextUrl.searchParams.get("force") === "1";
    const current = force ? null : await getDataset();
    const ageMs = current
      ? Date.now() - new Date(current.generatedAt).getTime()
      : Number.NaN;
    // One-minute slack so a scheduler that fires a few seconds early
    // still refreshes on its intended tick.
    const datasetIsFresh =
      current !== null &&
      Number.isFinite(ageMs) &&
      ageMs < env.rssRefreshMinutes * 60_000 - 60_000;

    // The write burst is decided BEFORE anything else, and a fresh dataset
    // skips the REFRESH ONLY — never the burst.
    //
    // Why (measured 2026-08-26): this guard used to return early, so the
    // persist decision was only ever evaluated on the ~4 ticks per hour
    // that actually refreshed. A cold instance opens the gate only in
    // minutes 0-4 and 30-34 (persist-gate.ts), and refresh ticks drift
    // slowly against that half-hour grid — so for 14 hours no refresh tick
    // landed in a window, no burst ran, and every story published in that
    // window got no archive row: no permanent URL, no news-sitemap entry
    // (it is gated on archive standing), no IndexNow ping. The site looked
    // perfectly healthy the whole time. Evaluating the gate on EVERY tick
    // puts the burst back on its intended ~2/hour cadence with the 5-minute
    // scheduler beat, and costs nothing extra: the gate itself is still the
    // only thing that decides whether Neon is woken.
    const persistDue = shouldPersistNow(new Date(), "cron");
    if (datasetIsFresh && !persistDue) {
      return NextResponse.json({
        ok: true,
        skipped: "fresh",
        dataMode: current.dataMode,
        datasetVersion: current.datasetVersion,
        generatedAt: current.generatedAt,
        ageSeconds: Math.round(ageMs / 1000),
        refreshIntervalMinutes: env.rssRefreshMinutes,
      });
    }
    let dataset: NewsDataset;
    if (datasetIsFresh) {
      dataset = current;
    } else {
      // Claim the burst so the shared-cache producer leaves the archive
      // upsert to this route (the producer runs inside forceRefresh; if it
      // archived first, the new-story check below could never see a new id).
      if (persistDue) claimCronBurst();
      try {
        dataset = await forceRefresh();
      } finally {
        releaseCronBurst();
      }
    }
    // Revalidation is burst-gated with the database writes: page caches are
    // refreshed on the ~30-minute cadence, not on every 5-minute tick — the
    // difference is billed ISR writes (see ISR_SURFACES comment).
    if (persistDue) {
      revalidateIsrSurfaces();
      revalidateLiveStories(dataset);
    }
    // Warm the homepage hero's optimized image variants so the first reader
    // (or a PageSpeed lab run) after a hero change gets an optimizer cache
    // HIT instead of paying the 1-3s transform — lib/seo/warm-hero.ts.
    // Production only, best-effort, network wait only.
    const heroWarmed = env.isProduction ? await warmHomepageHero(siteConfig.url) : 0;
    let persisted = false;
    let archivedStories = 0;
    let indexNowSubmitted = 0;
    let briefingStored = false;
    if (isDatabaseConfigured() && persistDue) {
      persisted = await persistDataset(dataset);
      // Permanent story archive (plus any clusters that went public and
      // vanished since the last burst): best-effort, catches its own
      // failures, so a broken archive write never breaks the cron response.
      // It asks findNewClusterIds which ids are brand new BEFORE the
      // upsert makes everything look old, and stashes them for the ping.
      archivedStories = await archivePublicDataset(dataset);
      // Daily briefing row for today (ET): best-effort, skips mock data.
      briefingStored = await upsertDailyBriefing(dataset);
      if (archivedStories > 0) {
        // Only a successful archive advances the batch clock — a failed
        // burst is retried on every tick until it lands.
        markPersisted();
        // Tell IndexNow about genuinely new story URLs — production only,
        // so localhost URLs are never submitted. Best-effort: never throws.
        const newIds = drainPendingIndexNowIds();
        if (env.isProduction && newIds.length > 0) {
          const byId = new Map(
            dataset.clusters.filter((c) => !c.isMock).map((c) => [c.id, c]),
          );
          const urls = newIds
            .map((id) => byId.get(id))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
            .map((c) => `${siteConfig.url}/story/${c.slug}`);
          if (urls.length > 0 && (await pingIndexNow(urls))) {
            indexNowSubmitted = urls.length;
          }
        }
      }
    }
    return NextResponse.json({
      ok: true,
      // The dataset was young enough to reuse; this tick ran for the write
      // burst alone.
      refreshSkipped: datasetIsFresh,
      dataMode: dataset.dataMode,
      datasetVersion: dataset.datasetVersion,
      generatedAt: dataset.generatedAt,
      articles: dataset.articles.length,
      clusters: dataset.clusters.length,
      // Serialized size of the shared cache entry / snapshot row (the
      // compact wire form, lib/news/compact.ts) — the Data Cache refuses
      // items over 2 MB, so this is the number to watch as feeds grow.
      cacheEntryBytes: safeCacheEntryBytes(dataset),
      duplicatesRemoved: dataset.ingestion.duplicatesRemoved,
      providers: dataset.ingestion.providers.map((p) => ({
        provider: p.provider,
        ok: p.ok,
        articles: p.articleCount,
        // Fetch+parse wall time; the gap to ingestion.durationMs is the
        // CPU-bound normalize/cluster/rank work — the number that drives
        // the function-CPU budget.
        durationMs: p.durationMs,
      })),
      ingestionDurationMs: dataset.ingestion.durationMs,
      // Feed-level health at a glance: the slowest three set the refresh
      // wall time; failures are per-feed (one dead feed never fails a run).
      slowestFeeds: (dataset.ingestion.providers.find((p) => p.provider === "rss")?.feeds ?? [])
        .slice()
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 3)
        .map((f) => ({ url: f.url, ms: f.durationMs, ok: f.ok })),
      failedFeeds: (dataset.ingestion.providers.find((p) => p.provider === "rss")?.feeds ?? [])
        .filter((f) => !f.ok)
        .map((f) => f.url),
      persistedToDatabase: persisted,
      archivedStories,
      briefingStored,
      heroWarmed,
      indexNowSubmitted,
      // True when database work was intentionally skipped this run (the
      // batch cadence), distinguishing a deliberate skip from a failure.
      persistenceDeferred: isDatabaseConfigured() && !persistDue,
    });
  } catch (error) {
    logger.error("cron.refresh_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
