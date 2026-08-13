import { NextResponse, type NextRequest } from "next/server";
import { forceRefresh } from "@/lib/cache/store";
import { isDatabaseConfigured } from "@/lib/database/client";
import { persistDataset } from "@/lib/database/persist";
import { env } from "@/lib/env";
import { logger } from "@/lib/utils/logger";
import { secureCompare } from "@/lib/utils/secure-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Best-effort guard against unauthenticated hammering. Module state is
// per-instance (serverless instances each get their own window), so this is
// not a global limit — it only bounds abuse of a single warm instance.
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
 * Scheduled news refresh.
 * Protected by CRON_SECRET via `Authorization: Bearer <secret>` (Vercel Cron
 * convention) or an `x-cron-secret` header. Refreshes the in-process cache and
 * archives the dataset to PostgreSQL when configured.
 */
export async function GET(request: NextRequest) {
  if (rateLimited()) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const dataset = await forceRefresh();
    let persisted = false;
    if (isDatabaseConfigured()) {
      persisted = await persistDataset(dataset);
    }
    return NextResponse.json({
      ok: true,
      dataMode: dataset.dataMode,
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
    });
  } catch (error) {
    logger.error("cron.refresh_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, error: "Refresh failed" }, { status: 500 });
  }
}
