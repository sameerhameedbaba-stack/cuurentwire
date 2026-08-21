import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { cache } from "react";
import { ExternalLink } from "lucide-react";
import { CATEGORIES } from "@/config/categories";
import { CategoryLabel, ContentTypeBadge, CountryBadge, SourceLine, StatusBadge, BreakingLabel } from "@/components/news/atoms";
import { CoverageIntelligence } from "@/components/news/CoverageIntelligence";
import { CoverageSources, CoverageTimeline } from "@/components/news/CoverageSources";
import { StoryContext } from "@/components/news/StoryContext";
import { StoryImage } from "@/components/news/StoryImage";
import { HeadlineStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";
import { ShareActions } from "@/components/ui/ShareActions";
import { siteConfig } from "@/config/site";
import {
  archivedStoryToCluster,
  ArchiveUnavailableError,
  findArchivedStory,
  findEarlierCoverage,
  getArchiveFirstSeen,
  getStoryArchiveExtras,
} from "@/lib/database/archive";
import { corroboratedDetails } from "@/lib/news/coverage-analysis";
import { coverageCounts, coverageGlance } from "@/lib/news/coverage-glance";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";
import {
  getClusterBySlugWithVersion,
  getMoreInCategory,
  getRelatedClusters,
  getTopicIndex,
} from "@/lib/news/queries";
import { resolveStoryRequest, type StoryResolution } from "@/lib/news/story-resolution";
import { isTopicEligible, topicKey } from "@/lib/news/topics";
import { COUNTRY_LABELS, type StoryCluster } from "@/lib/news/types";
import { metaDescription } from "@/lib/utils/text";
import { fullTimestamp, hoursSince } from "@/lib/utils/time";
import {
  applyStoryIndexDecision,
  countStoryValueEvents,
  storyIndexDecision,
} from "@/lib/seo/story-indexing";
import {
  BreadcrumbJsonLd,
  StoryJsonLd,
  clampDateModified,
} from "@/lib/seo/structured-data";

// ISR (audit F1): each story page is cached up to 5 minutes. notFound()/
// redirect() results share the same window, so a wrongly cached 404 or a
// stale pre-merge page self-heals within 300s — and the cron refresh
// revalidates /story/[slug] after every new dataset as a faster bound.
export const revalidate = 300;

/**
 * ISR only engages for a dynamic segment when generateStaticParams returns an
 * array — "You must return an empty array from generateStaticParams ... in
 * order to revalidate (ISR) paths at runtime"
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md).
 * Without it the `revalidate` above is inert: every request server-renders and
 * answers `Cache-Control: private, no-cache, no-store`. Empty (not the story
 * list) on purpose — prerendering 2,000+ archived stories at build time would
 * blow up build duration for pages that are read once a month; each URL is
 * cached on its first visit instead, and the cron's revalidatePath keeps them
 * fresh.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

interface StoryRequest {
  resolution: StoryResolution;
  /** Version of the live snapshot the cluster was read from (live hits only). */
  liveDatasetVersion: string | null;
}

/**
 * Resolution order: live dataset first (current behavior), then the
 * permanent story archive when a database is configured — published /story/
 * URLs keep resolving after they rotate out of the 72h dataset. 404 only
 * when neither knows the URL. The live lookup also captures the snapshot's
 * datasetVersion so the page can stamp cw-dataset-version from the exact
 * data it renders.
 *
 * React cache(): generateMetadata and the page body run in the same request
 * (in parallel since streaming metadata) and both resolve the slug — the
 * memo makes that one lookup, and hands both the SAME request object so the
 * cache()d loaders below (keyed by object identity) dedupe too.
 */
const resolveStory = cache(async function resolveStory(slug: string): Promise<StoryRequest> {
  let liveDatasetVersion: string | null = null;
  const resolution = await resolveStoryRequest(slug, {
    getLive: async (slugOrId) => {
      const { cluster, datasetVersion } = await getClusterBySlugWithVersion(slugOrId);
      liveDatasetVersion = datasetVersion;
      return cluster;
    },
    getArchived: findArchivedStory,
  });
  return { resolution, liveDatasetVersion };
});

interface StoryView {
  cluster: StoryCluster;
  isArchived: boolean;
  /** first_seen_at from the archive — our real publication time, if known. */
  publishedByUsAt?: string;
  /**
   * cw-dataset-version meta value, derived from the same data the body
   * renders: the live snapshot's version stamp, or "archive:" plus the
   * archived record's last-modified timestamp.
   */
  datasetVersion: string;
}

const buildStoryView = cache(async function buildStoryView(
  request: StoryRequest,
): Promise<StoryView | null> {
  const { resolution } = request;
  if (resolution.kind === "live") {
    const cluster = resolution.cluster;
    const publishedByUsAt = (await getArchiveFirstSeen([cluster.id])).get(cluster.id);
    return {
      cluster,
      isArchived: false,
      publishedByUsAt,
      datasetVersion: request.liveDatasetVersion ?? "unknown",
    };
  }
  if (resolution.kind === "archived") {
    return {
      cluster: archivedStoryToCluster(resolution.story),
      isArchived: true,
      publishedByUsAt: resolution.story.firstSeenAt,
      datasetVersion: `archive:${resolution.story.lastModifiedAt}`,
    };
  }
  return null;
});

/**
 * Depth signals the page already loads for its body modules — related live
 * coverage (entity overlap in the cached dataset), the archive extras
 * (update history + all-time source union) and earlier archive coverage —
 * shared with generateMetadata, which reads the same three values for the
 * index decision. One cache() entry per cluster object, so the two callers
 * issue each (already cached) read once per request. Archived stories can
 * still surface related live coverage via entities; the archive reads are
 * best-effort (empty without a database).
 */
const loadStoryDepth = cache(async function loadStoryDepth(cluster: StoryCluster) {
  const [related, archiveExtras, earlierCoverage] = await Promise.all([
    getRelatedClusters(cluster),
    getStoryArchiveExtras(cluster.id),
    findEarlierCoverage({
      id: cluster.id,
      title: cluster.title,
      entities: cluster.entities,
      // Earliest coverage of THIS story — the bar an archived story has to
      // be older than to count as earlier coverage.
      firstPublishedAt: cluster.firstPublishedAt,
    }),
  ]);
  return { related, archiveExtras, earlierCoverage };
});


/**
 * The archive is configured but did not answer, and this slug carries a
 * real cluster-id token — so it is a URL we plausibly published.
 *
 * Throwing here produces a 500 through app/error.tsx. That is deliberate:
 * `notFound()` is the ONLY other status this page can set (Next 16 gives a
 * page no way to emit 503 — next/navigation exports notFound, forbidden
 * and unauthorized, and nothing else), and a 404 is a permanent "gone"
 * that survives the outage. A 5xx is retriable, so crawlers come back and
 * the URL keeps its standing. Mass 5xx does slow crawling while an outage
 * lasts; mass 404 deletes the archive from the index, which is worse and
 * does not heal on its own.
 *
 * It must be thrown before the response starts streaming — same
 * constraint as notFound() — which is why both call sites are at the top.
 */
function archiveUnavailable(slug: string): never {
  throw new ArchiveUnavailableError(`/story/${slug}`, new Error("archive read failed"));
}

/**
 * Headline length past which the " | CurrentWire" suffix is dropped. Google
 * renders roughly 60 characters of a title; the suffix costs 14 of them.
 */
const TITLE_SUFFIX_BUDGET = 46;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const request = await resolveStory(slug);
  const { resolution } = request;
  // Real 404 status requires notFound() before the response starts streaming.
  if (resolution.kind === "not-found") notFound();
  if (resolution.kind === "unavailable") archiveUnavailable(slug);
  // The page itself 307s (alias) or 308s (merge); never rendered.
  if (resolution.kind === "redirect" || resolution.kind === "merged") {
    return { title: siteConfig.name };
  }
  const view = await buildStoryView(request);
  if (!view) notFound();
  const { cluster, publishedByUsAt } = view;
  const description = cluster.summary
    ? metaDescription(cluster.summary)
    : `Coverage of "${cluster.title}" from ${cluster.sourceNames.slice(0, 3).join(", ")}.`;
  const canonical = new URL(`/story/${cluster.slug}`, siteConfig.url).toString();
  // Thin single-source lifecycle (lib/seo/story-indexing.ts): the same depth
  // signals the body renders decide whether this URL stays in the index.
  // Age runs from first coverage — our archive first-seen time when known,
  // else the earliest publisher time — never from this render.
  const { related, archiveExtras, earlierCoverage } = await loadStoryDepth(cluster);
  const indexDecision = storyIndexDecision({
    ageHours: hoursSince(publishedByUsAt ?? cluster.firstPublishedAt),
    independentPublications: coverageCounts(cluster.articles).independentPublications,
    historyEvents: countStoryValueEvents(archiveExtras.history),
    corroboratedDetails: corroboratedDetails(cluster).length,
    relatedCoverage: related.length + earlierCoverage.length,
    hasSummary: Boolean(cluster.summary),
  });
  return applyStoryIndexDecision(
    {
      // Long headlines are kept truthful and whole, so the " | CurrentWire"
      // suffix is what gets dropped: it costs 14 characters of SERP width that
      // the headline itself needs. Short headlines keep the brand.
      title:
        cluster.title.length > TITLE_SUFFIX_BUDGET
          ? { absolute: cluster.title }
          : cluster.title,
      description,
      alternates: { canonical },
      openGraph: {
        title: cluster.title,
        description,
        url: canonical,
        siteName: siteConfig.name,
        type: "article",
        publishedTime: publishedByUsAt ?? cluster.firstPublishedAt,
        modifiedTime: clampDateModified(
          publishedByUsAt ?? cluster.firstPublishedAt,
          cluster.lastPublishedAt,
        ),
      },
      twitter: { card: "summary_large_image", title: cluster.title, description },
    },
    indexDecision,
  );
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const request = await resolveStory(slug);
  const { resolution } = request;
  if (resolution.kind === "not-found") notFound();
  if (resolution.kind === "unavailable") archiveUnavailable(slug);
  if (resolution.kind === "redirect") redirect(`/story/${resolution.slug}`);
  // Cluster merge: permanent — crawlers transfer the old URL's standing to
  // the surviving canonical story (audit: merge → redirect, never deletion).
  if (resolution.kind === "merged") permanentRedirect(`/story/${resolution.slug}`);
  const view = await buildStoryView(request);
  if (!view) notFound();
  const { cluster, isArchived, publishedByUsAt } = view;

  // Depth signals are shared with generateMetadata (see loadStoryDepth); the
  // topic index is body-only.
  const [{ related, archiveExtras, earlierCoverage }, topicIndex] = await Promise.all([
    loadStoryDepth(cluster),
    getTopicIndex(),
  ]);
  // Excludes what Related coverage already shows, so it waits for `related` —
  // still the same cached dataset, not an extra fetch.
  const moreInCategory = await getMoreInCategory(
    cluster,
    related.map((c) => c.id),
  );
  // Chip hygiene: an "In this story" chip must lead somewhere. For a live
  // story the current cluster itself contributes 1 to its entities' counts,
  // so a chip needs a second live cluster; an archived story is absent from
  // the live dataset, so any live match at all makes the topic page useful.
  // Counts and links come from the topic INDEX, so variants of one topic
  // ("Big Bend" / "Big Bend National Park") pool their coverage and the
  // chip points at the canonical URL. isTopicEligible additionally blocks
  // uncorroborated one-story phrases — the archived branch used to let
  // those through and link straight into a noindex hub.
  const minTopicClusters = isArchived ? 1 : 2;
  const chipKeys = new Set<string>();
  const topicChips: { slug: string; display: string }[] = [];
  // Live cluster counts for this story's topics, keyed by topic identity —
  // StoryContext states how much OTHER live coverage each topic has. Read off
  // the index already loaded above, so it costs no extra query, and keyed the
  // same way as the chips so variants of one topic pool their counts.
  const topicCounts = new Map<string, number>();
  for (const entity of cluster.entities) {
    const key = topicKey(entity);
    const entry = topicIndex.byKey.get(key);
    if (entry) topicCounts.set(key, entry.clusterCount);
    if (!entry || chipKeys.has(entry.key)) continue;
    if (entry.clusterCount < minTopicClusters || !isTopicEligible(entry)) continue;
    chipKeys.add(entry.key);
    topicChips.push({ slug: entry.slug, display: entry.display });
  }
  const history = archiveExtras.history;
  // "Coverage at a glance": deterministic lines from the members, the
  // stored history and our first-seen time; empty for a single report.
  const glance = coverageGlance({
    articles: cluster.articles,
    history,
    firstSeenAt: publishedByUsAt,
  });
  const lead = cluster.lead;
  const categoryDef = CATEGORIES[cluster.category];
  const storyUrl = new URL(`/story/${cluster.slug}`, siteConfig.url).toString();
  const attributionNames =
    cluster.sourceNames.length > 1
      ? `${cluster.sourceNames.slice(0, -1).join(", ")} and ${cluster.sourceNames[cluster.sourceNames.length - 1]}`
      : cluster.sourceNames[0];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      {/* Snapshot stamp for cache-coherence probes — derived from the same
          data this page renders (React hoists it into <head>). */}
      <meta name="cw-dataset-version" content={view.datasetVersion} />
      <StoryJsonLd cluster={cluster} datePublished={publishedByUsAt} />
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
          {isArchived ? (
            <p className="mb-4 border-l-2 border-rule-strong bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
              This story is from the CurrentWire archive. Coverage details
              reflect the last time it was updated.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {cluster.isBreaking ? <BreakingLabel /> : null}
            <CategoryLabel category={cluster.category} />
            <CountryBadge country={cluster.country} />
            <StatusBadge status={cluster.status} />
            <ContentTypeBadge contentType={cluster.contentType} />
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
            {/* Truthfully labeled timestamps: "Published by CurrentWire" is
                our own archive first-seen time; "First/Latest coverage" are
                SOURCE times. These back the JSON-LD datePublished (archive
                first — falling back to first coverage) and dateModified —
                never our render time. */}
            <p className="mt-1.5 text-xs text-muted">
              {publishedByUsAt ? (
                <>
                  Published by CurrentWire{" "}
                  <time dateTime={publishedByUsAt}>
                    {fullTimestamp(publishedByUsAt)}
                  </time>
                  {" · "}
                </>
              ) : null}
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
                href="/news-desk"
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

          {/* Coverage at a glance — lib/news/coverage-glance.ts decides the
              lines; nothing renders for a single report. "First observed" is
              the earliest publisher timestamp we hold, never "broke the
              story"; counts say "publications"/"reports", never "N sources"
              (a production probe regex-anchors that string). */}
          {glance.length > 0 ? (
            <section
              aria-label="Coverage at a glance"
              className="mt-3 border-l-2 border-rule-strong bg-surface px-3 py-2 text-xs leading-relaxed text-muted"
            >
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Coverage at a glance
              </h2>
              <ul className="mt-1 space-y-0.5">
                {glance.map((line) => (
                  <li key={line.kind}>
                    <span className="font-semibold text-ink">{line.label}:</span>{" "}
                    {line.value}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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

          {/* Entities / topics — only chips whose /topic page has coverage
              beyond this story (see topicChips above). */}
          {topicChips.length > 0 ? (
            <div className="no-print mt-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                In this story
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {topicChips.map((chip) => (
                  <li key={chip.slug}>
                    <Link
                      href={`/topic/${chip.slug}`}
                      className="block rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold transition-colors hover:border-brand hover:text-brand-ink"
                    >
                      {chip.display}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <CoverageIntelligence
            cluster={cluster}
            history={history}
            earlierCoverage={earlierCoverage}
            allTimeSources={archiveExtras.sources}
          />

          <div className="mt-10">
            <CoverageSources cluster={cluster} />
            <CoverageTimeline cluster={cluster} history={history} />
          </div>

          {/* Backlog item 3: CurrentWire's own record of how this page was
              produced — the original main content on a single-source story.
              Deliberately per-story values only, no standing prose: see the
              header of StoryContext.tsx. topicCounts is built from the index
              already loaded above, so this costs no extra query. */}
          <StoryContext
            cluster={cluster}
            publishedByUsAt={publishedByUsAt}
            topicCounts={topicCounts}
            isArchived={isArchived}
          />

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
          {moreInCategory.length > 0 ? (
            <section aria-label={`More in ${categoryDef.label}`} className="mt-8">
              <SectionHeader
                title={`More in ${categoryDef.label}`}
                href={categoryDef.path}
              />
              <div className="divide-y divide-rule">
                {moreInCategory.map((categoryCluster) => (
                  <div key={categoryCluster.id} className="py-2.5">
                    <HeadlineStory cluster={categoryCluster} />
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
