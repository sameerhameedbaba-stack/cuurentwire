import { getDataset } from "@/lib/cache/store";
import { getNewsSitemapArchiveStatus } from "@/lib/database/archive";
import {
  renderNewsSitemap,
  type NewsSitemapArchiveInfo,
} from "@/lib/seo/news-sitemap";
import type { StoryCluster } from "@/lib/news/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let clusters: StoryCluster[] = [];
  let archive: NewsSitemapArchiveInfo | undefined;
  try {
    const dataset = await getDataset();
    // Google News must never see demo data: mock mode serves an empty urlset.
    // (Individual mock clusters are also excluded by the renderer.)
    if (dataset.dataMode !== "mock") {
      clusters = dataset.clusters;
      // Archive standing gates what gets advertised (see the renderer's
      // rules): only archived, unmerged clusters — the URLs every instance
      // can serve 200 regardless of dataset generation. null (no DB, or the
      // archive did not answer) falls back to unfiltered — never an empty
      // urlset because Neon blinked.
      archive =
        (await getNewsSitemapArchiveStatus(clusters.map((c) => c.id))) ??
        undefined;
    }
  } catch {
    // A data outage still answers 200 with a valid, empty urlset.
  }
  return new Response(renderNewsSitemap(clusters, new Date(), archive), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // No stale-while-revalidate: Googlebot-News fetches this sitemap near
      // continuously, and a slug rename or merge makes a stale copy advertise
      // a redirecting URL. max-age alone bounds that window at 5 minutes;
      // the origin cost is one force-dynamic render per CDN region per
      // window — function invocations, never ISR writes.
      "Cache-Control": "public, max-age=300",
    },
  });
}
