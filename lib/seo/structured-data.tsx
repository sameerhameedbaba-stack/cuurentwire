import { siteConfig } from "@/config/site";
import type { StoryCluster } from "@/lib/news/types";

/**
 * schema.org structured data. CurrentWire is an aggregator: clustered stories
 * are described as ItemLists/Articles that cite the original publishers —
 * CurrentWire is never marked as the original publisher of third-party work.
 */

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        email: siteConfig.contactEmail,
      }}
    />
  );
}

export function WebSiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteConfig.name,
        url: siteConfig.url,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

/**
 * Story page: summary NewsArticle citing the original publishers' reports.
 * Dates are SOURCE coverage times (never our render time): datePublished is
 * the earliest coverage, dateModified the latest — matching the visible
 * "First coverage" / "Latest coverage" labels on the page. Authorship is the
 * algorithmic news desk, never a fabricated human byline.
 */
export function StoryJsonLd({ cluster }: { cluster: StoryCluster }) {
  const storyUrl = `${siteConfig.url}/story/${cluster.slug}`;
  const image = [
    // Only https publisher images; the OG card is always available.
    ...(cluster.imageUrl?.startsWith("https://") ? [cluster.imageUrl] : []),
    `${storyUrl}/opengraph-image`,
  ];
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: cluster.title,
        description: cluster.summary,
        datePublished: cluster.firstPublishedAt,
        dateModified: cluster.lastPublishedAt,
        url: storyUrl,
        mainEntityOfPage: storyUrl,
        image,
        author: {
          "@type": "Organization",
          name: "CurrentWire News Desk",
          url: `${siteConfig.url}/methodology`,
        },
        isBasedOn: cluster.articles.map((a) => a.url),
        publisher: {
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
          logo: {
            "@type": "ImageObject",
            url: `${siteConfig.url}/logo.svg`,
          },
        },
        about: cluster.entities.map((name) => ({ "@type": "Thing", name })),
      }}
    />
  );
}

/** Ranked list (Top 100 and section lists). */
export function ItemListJsonLd({
  clusters,
  path,
  name,
}: {
  clusters: StoryCluster[];
  path: string;
  name: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        url: `${siteConfig.url}${path}`,
        numberOfItems: clusters.length,
        itemListElement: clusters.slice(0, 30).map((cluster, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: cluster.title,
          url: `${siteConfig.url}/story/${cluster.slug}`,
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${siteConfig.url}${item.path}`,
        })),
      }}
    />
  );
}
