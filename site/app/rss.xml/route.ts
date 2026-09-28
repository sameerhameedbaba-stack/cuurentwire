import { siteConfig } from "@/config/site";
import { renderArticleFeed } from "@/lib/editorial/feed";
import { getPublishedArticles } from "@/lib/editorial/store";

/**
 * STATIC-SITE OVERLAY: /rss.xml.
 *
 * A GET-only route handler that reads nothing from the request, so the static
 * export renders it once at build time into out/rss.xml. The `.xml` extension
 * matters on GitHub Pages: it picks the Content-Type from the file extension,
 * and the old extensionless /rss would be served as application/octet-stream.
 */
export const dynamic = "force-static";

export function GET(): Response {
  const body = renderArticleFeed({
    articles: getPublishedArticles(),
    base: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    path: "/rss.xml",
  });
  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
