import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { forceRefresh } from "@/lib/cache/store";
import { archiveDataset, findNewClusterIds } from "@/lib/database/archive";
import { isDatabaseConfigured } from "@/lib/database/client";
import { persistDataset } from "@/lib/database/persist";
import { env } from "@/lib/env";
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
 * convention) or an `x-cron-secret` header. Refreshes the in-process cache and
 * archives the dataset to PostgreSQL when configured.
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
    const dataset = await forceRefresh();
    revalidateIsrSurfaces();
    let persisted = false;
    let archivedStories = 0;
    let indexNowSubmitted = 0;
    if (isDatabaseConfigured()) {
      persisted = await persistDataset(dataset);
      // Which stories are brand new? Must be answered before the archive
      // upsert makes everything look old.
      const liveClusters = dataset.clusters.filter((c) => !c.isMock);
      const newIds =
        dataset.dataMode === "mock"
          ? []
          : await findNewClusterIds(liveClusters.map((c) => c.id));
      // Permanent story archive: best-effort (archiveDataset catches its own
      // failures), so a broken archive write never breaks the cron response.
      archivedStories = await archiveDataset(dataset);
      // Tell IndexNow about genuinely new story URLs — production only, so
      // localhost URLs are never submitted. Best-effort: never throws.
      if (env.isProduction && archivedStories > 0 && newIds.length > 0) {
        const byId = new Map(liveClusters.map((c) => [c.id, c]));
        const urls = newIds
          .map((id) => byId.get(id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map((c) => `${siteConfig.url}/story/${c.slug}`);
        if (await pingIndexNow(urls)) indexNowSubmitted = urls.length;
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
      indexNowSubmitted,
    });
  } catch (error) {
    logger.error("cron.refresh_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
