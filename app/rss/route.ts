import { siteConfig } from "@/config/site";
import { getTop100 } from "@/lib/news/queries";
import { renderRss } from "@/lib/seo/rss";

export const dynamic = "force-dynamic";

export async function GET() {
  const { stories } = await getTop100({});
  const xml = renderRss({
    title: `${siteConfig.name} — Top Stories`,
    description: siteConfig.seo.defaultDescription,
    path: "/rss",
    clusters: stories.slice(0, 50),
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
