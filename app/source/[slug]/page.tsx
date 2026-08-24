import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/categories";
import { TRACKED_PUBLISHER_COUNT } from "@/config/sources";
import { ArticleRow } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSourceStories } from "@/lib/news/queries";
import { sourceProfile, windowSpanLabel } from "@/lib/news/source-profile";
import { NOINDEX_FOLLOW, shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/lib/seo/structured-data";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
// COST floor, not a freshness choice: every ISR re-render is billed
// (Vercel Hobby-tier blowout, 2026-08-24 — ISR Writes 238%, CPU 307%).
// Do not lower this to chase TTFB; the cron's targeted revalidation
// keeps content fresh. Quota math lives in seo/PLAYBOOK.md.
export const revalidate = 3600;

/**
 * Required for the `revalidate` above to do anything: a dynamic segment with
 * no generateStaticParams is server-rendered on every request. Empty array =
 * nothing prerendered at build, every source hub ISR-cached on first visit.
 * See app/story/[slug]/page.tsx for the doc reference.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { sourceName, articles, dataset } = await getSourceStories(slug);
  // Real 404 status requires notFound() before the response starts streaming.
  if (!sourceName) notFound();
  const profile = sourceProfile(dataset, slug);
  // The old title was "<name> — Latest stories", which competes for the
  // publisher's own brand name against the publisher itself, a query this
  // site cannot win (seo/BACKLOG.md item 3). Name the durable thing the
  // page actually holds instead. Numbers stay OUT of the title: it is
  // ISR-cached, and a stale count in a SERP snippet reads as wrong, while
  // the same count inside the page is explicitly framed as a snapshot.
  const metadata = pageMetadata({
    title: `${sourceName} — coverage and corroboration`,
    // Kept near 140 characters so it survives a SERP snippet intact — the
    // mid-sentence truncation logged against story descriptions in
    // seo/BACKLOG.md item 4 is a length problem, and this is where length
    // is decided.
    description:
      profile.stories > 0
        ? `${sourceName} coverage: ${profile.stories} stories in the current window, ${profile.corroborated} also carried by other publications, each linked to the original reporting.`
        : `The CurrentWire coverage record for ${sourceName}, with links to the original reporting.`,
    path: `/source/${slug}`,
  });
  // Thin source pages stay crawlable (follow) but out of the index.
  if (!shouldIndexCollection(articles.length)) {
    metadata.robots = NOINDEX_FOLLOW;
  }
  return metadata;
}

export default async function SourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { source, sourceName, articles, dataset } = await getSourceStories(slug);
  if (!sourceName) notFound();

  const profile = sourceProfile(dataset, slug);
  const span = windowSpanLabel(profile.earliest, profile.latest);
  const storyWord = profile.stories === 1 ? "story" : "stories";

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Sources", path: "/sources" },
          { name: sourceName, path: `/source/${slug}` },
        ]}
      />
      {/* CollectionPage + `about` replaces the bare ItemList this page used
          to emit: the markup now says WHICH publisher the page is about,
          which is the only structured claim it can make here honestly.
          `about` never carries a rating — see collectionPageSchema. */}
      <CollectionPageJsonLd
        path={`/source/${slug}`}
        name={`${sourceName} — coverage and corroboration`}
        description={`Stories from ${sourceName} tracked by CurrentWire, with corroboration by other publications and links to the original reporting.`}
        about={{
          name: sourceName,
          url: source ? `https://${source.domain}` : undefined,
        }}
        items={articles
          .filter((article) => article.clusterSlug)
          .map((article) => ({
            name: article.title,
            url: `/story/${article.clusterSlug}`,
          }))}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          <Link href="/sources" className="hover:underline">
            Source
          </Link>
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{sourceName}</h1>
        <p className="mt-2 text-sm text-muted">
          Latest stories sourced from {sourceName}
          {source ? (
            <>
              {" · "}
              <Link
                href="/methodology/publisher-tiers"
                className="underline underline-offset-2 hover:text-brand-ink"
              >
                Authority tier {source.tier}
              </Link>
            </>
          ) : null}
          . Headlines link to CurrentWire story pages; original reporting is
          always linked and attributed there.
        </p>
        <p className="mt-1 text-xs text-faint">
          Listing here reflects aggregation only and does not imply any
          endorsement of or partnership with CurrentWire. Authority tiers
          reflect reach and journalistic reputation; CurrentWire publishes no
          bias or factuality rating.
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {/* Coverage profile — the durable, per-publisher facts this hub was
          missing entirely (seo/BACKLOG.md item 3, measured 2026-08-25:
          /source/bbc-news was 870 words of which essentially all were the
          headline text of its own story links). Every figure comes from
          sourceProfile() over the dataset already in memory — no new IO and
          no added ISR cost, the same contract as the topic-hub snapshot. */}
      {profile.stories > 0 ? (
        <section
          aria-label={`How CurrentWire tracks ${sourceName}`}
          className="mt-5 border-l-2 border-brand pl-4 text-sm text-muted"
        >
          <p>
            In the current snapshot CurrentWire is tracking {profile.articles}{" "}
            {profile.articles === 1 ? "report" : "reports"} from {sourceName}{" "}
            across {profile.stories} {storyWord}
            {span ? <> published over {span}</> : null}.{" "}
            {profile.corroborated > 0 ? (
              <>
                {profile.corroborated} of {profile.stories === 1 ? "it" : "them"}{" "}
                {profile.corroborated === 1 ? "is" : "are"} also carried by at
                least one other publication CurrentWire ingests
              </>
            ) : (
              <>
                {profile.stories === 1 ? "It is" : "None of them is"} carried by
                another publication CurrentWire ingests
              </>
            )}
            {profile.led > 0 ? (
              <>
                , and {sourceName} is the account this site leads with on{" "}
                {profile.led}.
              </>
            ) : (
              <>.</>
            )}
          </p>
          {profile.mostCorroborated ? (
            <p className="mt-2">
              The most widely corroborated is{" "}
              <Link
                href={`/story/${profile.mostCorroborated.slug}`}
                className="underline hover:text-brand-ink"
              >
                {profile.mostCorroborated.title}
              </Link>
              , carried by {profile.mostCorroborated.sourceCount} publications.
              {profile.topCoPublisher ? (
                <>
                  {" "}
                  Across the corroborated {storyWord}, the publication reporting
                  the same stories most often is {profile.topCoPublisher.name} (
                  {profile.topCoPublisher.shared} shared).
                </>
              ) : null}
            </p>
          ) : null}
          {profile.sections.length > 0 ? (
            <p className="mt-2">
              Sections filed in:{" "}
              {profile.sections.slice(0, 6).map((section, index) => (
                <span key={section.id}>
                  {index > 0 ? ", " : ""}
                  <Link
                    href={CATEGORIES[section.id].path}
                    className="underline underline-offset-2 hover:text-brand-ink"
                  >
                    {CATEGORIES[section.id].label}
                  </Link>{" "}
                  ({section.count})
                </span>
              ))}
              .
            </p>
          ) : null}
          {/* Honesty floor: these are counts over one window across the
              publications this site ingests, never a claim about all
              coverage anywhere. */}
          <p className="mt-2 text-xs text-faint">
            Counts cover the current news window only and are lower bounds
            across the {TRACKED_PUBLISHER_COUNT} publications CurrentWire
            tracks by name — other outlets may have covered the same stories.{" "}
            <Link
              href="/methodology/coverage-breadth"
              className="underline underline-offset-2 hover:text-brand-ink"
            >
              How coverage breadth is measured
            </Link>
            .
          </p>
        </section>
      ) : null}

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No current stories from this source"
            actionLabel="Browse all sources"
            actionHref="/sources"
          />
        </div>
      ) : (
        <div className="mt-2">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
