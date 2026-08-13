import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getTop100, type Top100Filters } from "@/lib/news/queries";
import { renderRss } from "@/lib/seo/rss";

export const dynamic = "force-dynamic";

const FEEDS: Record<string, { title: string; filters: Top100Filters }> = {
  us: { title: "United States", filters: { country: "us" } },
  canada: { title: "Canada", filters: { country: "canada" } },
  business: { title: "Business", filters: { category: "business" } },
  technology: { title: "Technology", filters: { category: "technology" } },
  politics: { title: "Politics", filters: { category: "politics" } },
  world: { title: "World", filters: { category: "world" } },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feed: string }> },
) {
  const { feed } = await params;
  const config = FEEDS[feed];
  if (!config) notFound();

  const { stories } = await getTop100(config.filters);
  const xml = renderRss({
    title: `${siteConfig.name} — ${config.title}`,
    description: `Top ${config.title} stories, ranked by ${siteConfig.name}.`,
    path: `/rss/${feed}`,
    clusters: stories.slice(0, 50),
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
