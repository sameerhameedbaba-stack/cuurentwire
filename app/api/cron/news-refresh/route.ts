import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { forceRefresh } from "@/lib/cache/store";
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
import type { NewsDataset } from "@/lib/news/types";
import { pingIndexNow } from "@/lib/seo/indexnow";
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
 * ISR'd public surfaces (audit F1): revalidated after every successful
 * refresh so a fresh dataset flips pages promptly instead of waiting out
 * their 5-minute window. Dynamic patterns invalidate lazily — each cached
 * story/topic/source page re-renders on its next visit. Literal paths for
 * static pages; `type: "page"` is required for patterns.
 */
const ISR_SURFACES: { path: string; type?: "page" }[] = [
  { path: "/" },
  { path: "/us" },
  { path: "/canada" },
  { path: "/topics" },
  { path: "/sources" },
  { path: "/most-covered" },
  { path: "/[category]", type: "page" },
  { path: "/story/[slug]", type: "page" },
  { path: "/topic/[slug]", type: "page" },
  { path: "/source/[slug]", type: "page" },
];

/** Best-effort: a revalidation failure must never fail the cron response. */
function revalidateIsrSurfaces(): void {
  for (const surface of ISR_SURFACES) {
    try {
      if (surface.type) revalidatePath(surface.path, surface.type);
      else revalidatePath(surface.path);
    } catch (error) {
      logger.warn("cron.revalidate_path_failed", {
        path: surface.path,
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
    // Decide the write burst BEFORE forceRefresh, and claim it so the
    // shared-cache producer leaves the archive upsert to this route (the
    // producer runs inside forceRefresh; if it archived first, the
    // new-story check below could never see a new id).
    const persistDue = shouldPersistNow();
    if (persistDue) claimCronBurst();
    let dataset: NewsDataset;
    try {
      dataset = await forceRefresh();
    } finally {
      releaseCronBurst();
    }
    revalidateIsrSurfaces();
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
      dataMode: dataset.dataMode,
      datasetVersion: dataset.datasetVersion,
      generatedAt: dataset.generatedAt,
      articles: dataset.articles.length,
      clusters: dataset.clusters.length,
      duplicatesRemoved: dataset.ingestion.duplicatesRemoved,
      providers: dataset.ingestion.providers.map((p) => ({
        provider: p.provider,
        ok: p.ok,
        articles: p.articleCount,
      })),
      persistedToDatabase: persisted,
      archivedStories,
      briefingStored,
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
