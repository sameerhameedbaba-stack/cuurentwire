import {
  ArchiveUnavailableError,
  listArchivedStoriesForSitemap,
} from "@/lib/database/archive";
import { renderArchiveSitemap } from "@/lib/seo/archive-sitemap";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/** Every permanent /story/ URL (see lib/seo/archive-sitemap.ts). */
export async function GET() {
  let entries: Awaited<ReturnType<typeof listArchivedStoriesForSitemap>>;
  try {
    entries = await listArchivedStoriesForSitemap();
  } catch (error) {
    if (!(error instanceof ArchiveUnavailableError)) throw error;
    // An empty <urlset> is not a neutral fallback. It is a well-formed
    // statement that this site has zero permanent story URLs, served with
    // a 200 that invites crawlers to believe it and a max-age that lets
    // them cache the claim for an hour. On 2026-08-21 that is exactly what
    // it said about 2,793 URLs while the archive was down.
    //
    // 503 says the opposite and says it correctly: the answer is unknown,
    // come back later, keep what you already have. Google's documented
    // handling of a 503 sitemap is to retry and retain the previous
    // contents, which is precisely the behaviour an outage needs.
    logger.error("seo.archive_sitemap_unavailable", { error: error.message });
    return new Response(
      "<!-- archive temporarily unavailable; retry later -->",
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Retry-After": "3600",
          // Never let a shared cache hold the outage past its end.
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return new Response(renderArchiveSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Changes at most once per refresh cycle; crawlers can cache longer.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    },
  });
}
