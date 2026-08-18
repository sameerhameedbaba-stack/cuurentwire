import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

/** Build consistent page metadata: title, description, canonical, OG, Twitter. */
export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
  noIndexFollow = false,
  rssPath,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  /**
   * Keep links crawlable while the page itself stays out of the index. Used by
   * out-of-range pagination, where the URL must not be indexed but the stories
   * it links to must still be discovered.
   */
  noIndexFollow?: boolean;
  /** Feed for this page, advertised via <link rel="alternate"> for auto-discovery. */
  rssPath?: string;
}): Metadata {
  const canonical = new URL(path, siteConfig.url).toString();
  return {
    title,
    description,
    alternates: {
      canonical,
      ...(rssPath
        ? {
            types: {
              "application/rss+xml": [
                { url: rssPath, title: `${siteConfig.name} — ${title}` },
              ],
            },
          }
        : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : noIndexFollow
        ? { index: false, follow: true }
        : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
