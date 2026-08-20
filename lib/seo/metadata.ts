import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

/**
 * The indexable robots directive, restated per page.
 *
 * Page-level `robots` REPLACES the root layout's wholesale in this Next
 * version — exactly like `openGraph` below — and returning `undefined` counts
 * as replacing it with nothing. Measured live 2026-08-19: `/us`, `/topics`,
 * `/top-100`, `/politics`, `/sources`, `/methodology` and `/about` shipped no
 * `<meta name="robots">` at all, while `/` and `/story/*` (which build their
 * metadata by hand) carried the full directive. Every one of those pages was
 * silently losing `max-image-preview:large` and `max-snippet:-1` — the
 * directives that make a page eligible for large Discover and Top Stories
 * thumbnails. Keep this in sync with app/layout.tsx.
 */
const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
} as const;

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
        : INDEXABLE_ROBOTS,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: "website",
      // Page-level openGraph REPLACES the layout's wholesale in this Next
      // version, so the shared card must be restated here or list pages
      // ship no preview image at all.
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.png"],
    },
  };
}
