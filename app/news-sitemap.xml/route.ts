import { getDataset } from "@/lib/cache/store";
import { getArchiveFirstSeen } from "@/lib/database/archive";
import { renderNewsSitemap } from "@/lib/seo/news-sitemap";
import type { StoryCluster } from "@/lib/news/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let clusters: StoryCluster[] = [];
  let firstSeenById: Map<string, string> | undefined;
  try {
    const dataset = await getDataset();
    // Google News must never see demo data: mock mode serves an empty urlset.
    // (Individual mock clusters are also excluded by the renderer.)
    if (dataset.dataMode !== "mock") {
      clusters = dataset.clusters;
      // Our real publication times from the archive, when a DB is attached.
      // Empty map / no DB falls back to first source coverage.
      firstSeenById = await getArchiveFirstSeen(clusters.map((c) => c.id));
    }
  } catch {
    // A data outage still answers 200 with a valid, empty urlset.
  }
  return new Response(renderNewsSitemap(clusters, new Date(), firstSeenById), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
