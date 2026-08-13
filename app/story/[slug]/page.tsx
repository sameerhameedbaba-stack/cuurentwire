import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { CATEGORIES } from "@/config/categories";
import { CategoryLabel, CountryBadge, SourceLine, StatusBadge, BreakingLabel } from "@/components/news/atoms";
import { CoverageSources, CoverageTimeline } from "@/components/news/CoverageSources";
import { StoryImage } from "@/components/news/StoryImage";
import { HeadlineStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";
import { ShareActions } from "@/components/ui/ShareActions";
import { siteConfig } from "@/config/site";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";
import { getClusterBySlug, getRelatedClusters } from "@/lib/news/queries";
import { COUNTRY_LABELS } from "@/lib/news/types";
import { entitySlug } from "@/lib/news/classification/entities";
import { truncate } from "@/lib/utils/text";
import { fullTimestamp } from "@/lib/utils/time";
import { BreadcrumbJsonLd, StoryJsonLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cluster = await getClusterBySlug(slug);
  // Real 404 status requires notFound() before the response starts streaming.
  if (!cluster) notFound();
  const description = cluster.summary
    ? truncate(cluster.summary, 160)
    : `Coverage of "${cluster.title}" from ${cluster.sourceNames.slice(0, 3).join(", ")}.`;
  const canonical = new URL(`/story/${cluster.slug}`, siteConfig.url).toString();
  return {
    title: cluster.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: cluster.title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: cluster.firstPublishedAt,
      modifiedTime: cluster.lastPublishedAt,
    },
    twitter: { card: "summary_large_image", title: cluster.title, description },
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cluster = await getClusterBySlug(slug);
  if (!cluster) notFound();
  // Old or shortened links resolve by stable id — send them to the canonical
  // URL. Temporary (307): cluster URLs are ephemeral, a 308 would strand
  // crawlers on retired aliases.
  if (slug !== cluster.slug) redirect(`/story/${cluster.slug}`);

  const related = await getRelatedClusters(cluster);
  const lead = cluster.lead;
  const categoryDef = CATEGORIES[cluster.category];
  const storyUrl = new URL(`/story/${cluster.slug}`, siteConfig.url).toString();
  const attributionNames =
    cluster.sourceNames.length > 1
      ? `${cluster.sourceNames.slice(0, -1).join(", ")} and ${cluster.sourceNames[cluster.sourceNames.length - 1]}`
      : cluster.sourceNames[0];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <StoryJsonLd cluster={cluster} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: categoryDef.label, path: categoryDef.path },
          { name: cluster.title, path: `/story/${cluster.slug}` },
        ]}
      />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="no-print text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-ink hover:underline">Home</Link>
          </li>
          <li aria-hidden>›</li>
          {cluster.country === "US" || cluster.country === "US_CA" ? (
            <>
              <li>
                <Link href="/us" className="hover:text-brand-ink hover:underline">United States</Link>
              </li>
              <li aria-hidden>›</li>
            </>
          ) : cluster.country === "CA" ? (
            <>
              <li>
                <Link href="/canada" className="hover:text-brand-ink hover:underline">Canada</Link>
              </li>
              <li aria-hidden>›</li>
            </>
          ) : null}
          <li>
            <Link href={categoryDef.path} className="hover:text-brand-ink hover:underline">
              {categoryDef.label}
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="max-w-48 truncate text-faint">
            {cluster.title}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <article className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-3">
            {cluster.isBreaking ? <BreakingLabel /> : null}
            <CategoryLabel category={cluster.category} />
            <CountryBadge country={cluster.country} />
            <StatusBadge status={cluster.status} />
          </div>

          <h1 className="headline mt-3 text-[1.75rem] leading-[1.12] sm:text-4xl lg:text-[2.75rem]">
            {cluster.title}
          </h1>

          {cluster.summary ? (
            <p className="mt-4 text-lg leading-relaxed text-ink/85 sm:text-xl sm:leading-relaxed dark:text-ink/90">
              {cluster.summary}
            </p>
          ) : null}

          <div className="mt-4 border-y border-rule py-3">
            <SourceLine
              source={lead.source}
              publishedAt={cluster.firstPublishedAt}
              isMock={cluster.isMock}
              sourceCount={cluster.sourceCount}
            />
            {/* SOURCE coverage times, labeled truthfully — these back the
                JSON-LD datePublished/dateModified, never our render time. */}
            <p className="mt-1.5 text-xs text-muted">
              First coverage{" "}
              <time dateTime={cluster.firstPublishedAt}>
                {fullTimestamp(cluster.firstPublishedAt)}
              </time>
              {cluster.lastPublishedAt !== cluster.firstPublishedAt ? (
                <>
                  {" "}
                  · Latest coverage{" "}
                  <time dateTime={cluster.lastPublishedAt}>
                    {fullTimestamp(cluster.lastPublishedAt)}
                  </time>
                </>
              ) : null}
            </p>
            <p className="mt-1.5 text-xs text-muted">
              Compiled by{" "}
              <Link
                href="/methodology"
                className="font-semibold underline hover:text-brand-ink"
              >
                CurrentWire News Desk
              </Link>
            </p>
            {cluster.sourceCount > 1 ? (
              <p className="mt-1.5 text-xs text-muted">
                Summary based on reporting from {attributionNames}.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted">
                Summary based on reporting from {lead.source}.
              </p>
            )}
          </div>

          <div className="mt-6">
            <StoryImage
              src={cluster.imageUrl}
              alt={cluster.title}
              category={cluster.category}
              aspect="16/9"
              sizes="(max-width: 1024px) 100vw, 66vw"
              priority
            />
          </div>

          {/* Primary CTA to original reporting */}
          {isSafeExternalUrl(lead.url) ? (
            <a
              href={lead.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-print mt-6 inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
            >
              Read the full report at {lead.source}
              <ExternalLink className="h-4 w-4" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}

          <div className="mt-6">
            <ShareActions url={storyUrl} title={cluster.title} />
          </div>

          {/* Entities / topics */}
          {cluster.entities.length > 0 ? (
            <div className="no-print mt-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                In this story
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {cluster.entities.map((entity) => (
                  <li key={entity}>
                    <Link
                      href={`/topic/${entitySlug(entity)}`}
                      className="block rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold transition-colors hover:border-brand hover:text-brand-ink"
                    >
                      {entity}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-10">
            <CoverageSources cluster={cluster} />
            <CoverageTimeline cluster={cluster} />
          </div>

          <p className="mt-10 border-t border-rule pt-4 text-xs leading-relaxed text-faint">
            {siteConfig.name} is a news discovery platform. This page summarizes
            and links to original reporting; full articles, imagery and copyright
            remain with the publishers listed above.
          </p>
        </article>

        <aside className="no-print lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          {related.length > 0 ? (
            <section aria-label="Related coverage">
              <SectionHeader title="Related coverage" />
              <div className="divide-y divide-rule">
                {related.map((relatedCluster) => (
                  <div key={relatedCluster.id} className="py-2.5">
                    <HeadlineStory cluster={relatedCluster} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section aria-label="Geographic relevance" className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Geography
            </h2>
            <p className="mt-2 text-sm font-semibold">{COUNTRY_LABELS[cluster.country]}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
