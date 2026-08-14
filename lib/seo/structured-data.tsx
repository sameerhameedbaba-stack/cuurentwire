import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { CONTENT_TYPE_LABELS, type StoryCluster } from "@/lib/news/types";

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
  // NewsMediaOrganization (an Organization subtype) so the editorial policy
  // pages are machine-readable E-E-A-T signals. No sameAs: social profiles
  // are not published on the site, and schema must never claim what we
  // cannot verify.
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "NewsMediaOrganization",
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        email: siteConfig.contactEmail,
        logo: {
          "@type": "ImageObject",
          url: `${siteConfig.url}/logo.svg`,
        },
        publishingPrinciples: `${siteConfig.url}/editorial-standards`,
        correctionsPolicy: `${siteConfig.url}/corrections`,
        masthead: `${siteConfig.url}/news-desk`,
        actionableFeedbackPolicy: `${siteConfig.url}/contact`,
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
 * Dates are never our render time: datePublished prefers the archive's
 * first_seen_at (when CurrentWire actually published the story page, passed
 * in as `datePublished`), falling back to the earliest SOURCE coverage;
 * dateModified is the latest source coverage — matching the visible
 * "Published by CurrentWire" / "First coverage" / "Latest coverage" labels.
 * Authorship is the algorithmic news desk, never a fabricated human byline.
 */
/**
 * dateModified must never precede datePublished: our publication time
 * (archive first_seen_at) is usually AFTER the sources' latest coverage
 * time, so the raw pair can be logically inverted. Clamp to published.
 */
export function clampDateModified(published: string, modified: string): string {
  const p = new Date(published).getTime();
  const m = new Date(modified).getTime();
  if (!Number.isFinite(p) || !Number.isFinite(m)) return modified;
  return m >= p ? modified : published;
}

export function StoryJsonLd({
  cluster,
  datePublished,
}: {
  cluster: StoryCluster;
  /** Archive first_seen_at ISO string; falls back to firstPublishedAt. */
  datePublished?: string;
}) {
  const storyUrl = `${siteConfig.url}/story/${cluster.slug}`;
  const image = [
    // Self-hosted card first: always available, rights always clear.
    `${storyUrl}/opengraph-image`,
    ...(cluster.imageUrl?.startsWith("https://") ? [cluster.imageUrl] : []),
  ];
  const published = datePublished ?? cluster.firstPublishedAt;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        // Always a real NewsArticle summary page — the content type is
        // carried truthfully in NewsArticle-compatible fields below
        // (articleSection + genre), never as a fabricated schema type.
        "@type": "NewsArticle",
        headline: cluster.title,
        description: cluster.summary,
        articleSection: CATEGORIES[cluster.category].label,
        ...(cluster.contentType && cluster.contentType !== "news"
          ? { genre: CONTENT_TYPE_LABELS[cluster.contentType] }
          : {}),
        datePublished: published,
        dateModified: clampDateModified(published, cluster.lastPublishedAt),
        url: storyUrl,
        mainEntityOfPage: storyUrl,
        image,
        author: {
          "@type": "Organization",
          name: "CurrentWire News Desk",
          url: `${siteConfig.url}/news-desk`,
        },
        publishingPrinciples: `${siteConfig.url}/editorial-standards`,
        correctionsPolicy: `${siteConfig.url}/corrections`,
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
  startPosition = 1,
}: {
  clusters: StoryCluster[];
  path: string;
  name: string;
  /** Rank of the first item — paginated lists continue the ranking. */
  startPosition?: number;
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
          position: startPosition + index,
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
