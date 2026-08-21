import { NextResponse, type NextRequest } from "next/server";
import {
  getArchiveSources,
  parseArchiveSourcesParams,
} from "@/lib/database/archive-sources";
import { describeDbError } from "@/lib/database/errors";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const NOTE = "aggregate statistics only";
const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Public, read-only aggregate statistics of the permanent story archive's
 * source union (lib/database/archive-sources.ts): per archived story, the
 * stored ACTIVE publication count next to the size of the permanent source
 * union and the peak coverage the update history recorded — counts only,
 * never article URLs, titles or names. Feeds scripts/audit-archive-unions.mjs.
 *
 *   GET /api/stats/archive-sources?ids=c0123456789ab,...        (max 500)
 *   GET /api/stats/archive-sources?from=<ISO|YYYY-MM-DD>&to=<ISO|YYYY-MM-DD>
 *       [&limit=1000][&offset=0]                               (max 9 days)
 *
 * 400 for bad params; 503 when the archive is configured but did not answer
 * (never an empty 200 on failure); 200 with empty rows when no database is
 * configured. No secrets, nothing a cron could be triggered through.
 */
export async function GET(request: NextRequest) {
  const parsed = parseArchiveSourcesParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, note: NOTE },
      { status: 400, headers: NO_STORE },
    );
  }
  try {
    const { rows, truncated } = await getArchiveSources(parsed.query);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        mode: parsed.query.mode,
        rows,
        truncated,
        note: NOTE,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    // ArchiveUnavailableError (or anything else): the answer is unknown,
    // say so with a retriable status and never let a shared cache keep it.
    logger.error("stats.archive_sources_unavailable", {
      error: describeDbError(error),
    });
    return NextResponse.json(
      { error: "archive temporarily unavailable", note: NOTE },
      { status: 503, headers: { ...NO_STORE, "Retry-After": "600" } },
    );
  }
}
