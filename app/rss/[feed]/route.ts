import { notFound } from "next/navigation";
import { CATEGORIES, PUBLIC_CATEGORY_IDS } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getTop100, type Top100Filters } from "@/lib/news/queries";
import { renderRss } from "@/lib/seo/rss";

export const dynamic = "force-dynamic";

// Every public category gets a feed, plus the two country feeds.
const FEEDS: Record<string, { title: string; filters: Top100Filters }> = {
  us: { title: "United States", filters: { country: "us" } },
  canada: { title: "Canada", filters: { country: "canada" } },
  ...Object.fromEntries(
    PUBLIC_CATEGORY_IDS.map((id) => [
      id,
      { title: CATEGORIES[id].label, filters: { category: id } },
    ]),
  ),
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
