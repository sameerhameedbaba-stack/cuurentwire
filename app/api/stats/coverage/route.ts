import { NextResponse } from "next/server";
import { getDataset } from "@/lib/cache/store";

export const dynamic = "force-dynamic";

/**
 * storySources is a join key for the GSC report (scripts/gsc-report.mjs):
 * slug → publication count for the LIVE dataset only. ~755 clusters per
 * refresh (2026-08-21), so the cap is headroom, not a truncation in practice.
 */
const MAX_STORY_SOURCES = 1_000;

/**
 * Public, read-only aggregate statistics of the current dataset: the
 * multi-source coverage distribution and per-feed value rows computed by
 * the pipeline (lib/news/stats.ts), plus the slug → publication-count join
 * key. No secrets, no per-reader data, nothing a cron could be triggered
 * through — it only reads the dataset every public page already serves.
 * Feeds the weekly SEO report and the GSC discovery script.
 */
export async function GET() {
  try {
    const dataset = await getDataset();
    const { coverage, feedStats } = dataset.ingestion;
    return NextResponse.json(
      {
        generatedAt: dataset.generatedAt,
        datasetVersion: dataset.datasetVersion,
        dataMode: dataset.dataMode,
        // Snapshots written before the stats landed carry neither field;
        // null keeps the shape stable for consumers.
        coverage: coverage ?? null,
        feedStats: [...(feedStats ?? [])].sort((a, b) => b.accepted - a.accepted),
        storySources: dataset.clusters
          .filter((cluster) => !cluster.isMock)
          .slice(0, MAX_STORY_SOURCES)
          .map((cluster) => ({ slug: cluster.slug, sourceCount: cluster.sourceCount })),
        note: "aggregate statistics only",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    // getDataset() isolates provider failures, so this is the no-data edge
    // (cold instance, empty snapshot). Say "unknown", never cache it.
    return NextResponse.json(
      { error: "statistics temporarily unavailable", note: "aggregate statistics only" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
