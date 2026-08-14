import { listArchivedStoriesForSitemap } from "@/lib/database/archive";
import { renderArchiveSitemap } from "@/lib/seo/archive-sitemap";

export const dynamic = "force-dynamic";

/** Every permanent /story/ URL (see lib/seo/archive-sitemap.ts). */
export async function GET() {
  const entries = await listArchivedStoriesForSitemap();
  return new Response(renderArchiveSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Changes at most once per refresh cycle; crawlers can cache longer.
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    },
  });
}
