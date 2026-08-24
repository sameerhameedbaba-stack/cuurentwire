import type { Metadata } from "next";
import Link from "next/link";
import { RankedStory } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { TRACKED_PUBLISHER_COUNT } from "@/config/sources";
import {
  getMostCovered,
  MIN_COVERAGE_SOURCES,
} from "@/lib/news/queries";
import { NOINDEX_FOLLOW, shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

/**
 * ISR. /most-covered is a STATIC route segment, so `revalidate` alone engages
 * it — the "you must return an empty array from generateStaticParams ... in
 * order to revalidate (ISR) paths at runtime" requirement
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * generate-static-params.md, "All paths at runtime") is scoped to DYNAMIC
 * segments; its example is app/blog/[slug]/page.js. The ISR guide's own
 * time-based example is a static segment carrying nothing but the config
 * (node_modules/next/dist/docs/01-app/02-guides/
 * incremental-static-regeneration.md, "Time-based revalidation":
 * `export const revalidate = 3600` in app/blog/page.tsx, no
 * generateStaticParams). Live proof on this site: /us, /sources and /topics
 * declare only `revalidate` and answer X-Vercel-Cache: HIT.
 *
 * Do NOT add `export const dynamic` here — force-dynamic would silently turn
 * this back into an uncached route.
 */
// COST floor, not a freshness choice: every ISR re-render is billed
// (Vercel Hobby-tier blowout, 2026-08-24 — ISR Writes 238%, CPU 307%).
// Do not lower this to chase TTFB; the cron's targeted revalidation
// keeps content fresh. Quota math lives in seo/PLAYBOOK.md.
export const revalidate = 3600;

const TITLE = "Most Covered Stories";
// Search-phrased <title> only (seo/STRATEGY.md Sprint 1): "biggest news
// stories" is the query family, and the coverage-count ranking is the
// literal truth behind it. The on-page h1 and breadcrumb keep the plain
// name, same idiom as the category pages.
const META_TITLE = "Biggest News Stories Right Now — Ranked by Publisher Coverage";
const DESCRIPTION =
  "The current stories being reported by the most publishers at once — ranked by how many distinct outlets are covering each event, which is a measure of breadth, not of importance.";

/** Publications CurrentWire recognizes and tiers by authority (config/sources.ts). */
const TRACKED_PUBLISHERS = TRACKED_PUBLISHER_COUNT;

export async function generateMetadata(): Promise<Metadata> {
  const { stories } = await getMostCovered();
  const metadata = pageMetadata({
    title: META_TITLE,
    description: DESCRIPTION,
    path: "/most-covered",
  });
  // The same thin-collection rule the topic and source hubs use: when
  // coverage is so narrow that almost nothing clears the publisher floor,
  // the page stays crawlable but out of the index. No rssPath: there is no
  // feed of this slice, and metadata must never advertise one.
  if (!shouldIndexCollection(stories.length)) metadata.robots = NOINDEX_FOLLOW;
  return metadata;
}

export default async function MostCoveredPage() {
  const {
    stories,
    qualifying,
    rankedTotal,
    maxSourceCount,
    publishersRepresented,
    dataset,
  } = await getMostCovered();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: TITLE, path: "/most-covered" },
        ]}
      />
      {/* One page, no pagination, so positions are always 1..N and
          numberOfItems always equals the number of elements listed (the
          list is capped below the 30-item slice ItemListJsonLd applies). */}
      {stories.length > 0 ? (
        <ItemListJsonLd clusters={stories} path="/most-covered" name={TITLE} />
      ) : null}

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          Coverage breadth
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          The stories the most publishers are covering at the same time. This
          measures <strong>how widely an event is being reported</strong> — it
          is not a measure of how much the event matters. For the importance
          ranking, see the{" "}
          <Link href="/top-100" className="underline hover:text-brand-ink">
            Top 100
          </Link>
          .
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      <p className="mt-5 border-l-2 border-brand pl-4 text-sm text-muted">
        In the current snapshot, {qualifying} of {rankedTotal} ranked stories
        are being reported by {MIN_COVERAGE_SOURCES} or more publishers.{" "}
        {qualifying > 0 ? (
          <>
            The broadest story on the board carries {maxSourceCount}{" "}
            {maxSourceCount === 1 ? "publisher" : "publishers"}.{" "}
          </>
        ) : null}
        {publishersRepresented}{" "}
        {publishersRepresented === 1 ? "publisher is" : "publishers are"}{" "}
        represented in this snapshot, out of {TRACKED_PUBLISHERS} that
        CurrentWire tiers by authority.
      </p>

      {stories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No story clears the coverage floor right now"
            message={`Nothing in the current ranking is being reported by ${MIN_COVERAGE_SOURCES} or more publishers at once. That happens when coverage is fragmented across separate events rather than concentrated on one.`}
            actionLabel="Go to the Top 100"
            actionHref="/top-100"
          />
        </div>
      ) : (
        <section aria-labelledby="ranked-by-breadth" className="mt-2">
          <h2 id="ranked-by-breadth" className="sr-only">
            Stories ranked by the number of publishers covering them
          </h2>
          <ol>
            {stories.map((cluster, index) => (
              <li key={cluster.id}>
                <RankedStory
                  cluster={cluster}
                  rank={index + 1}
                  eagerThumbnail={index < 4}
                />
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-xs text-muted">
            Showing {stories.length} of {qualifying} stories reported by{" "}
            {MIN_COVERAGE_SOURCES} or more publishers.
          </p>
        </section>
      )}

      <section
        aria-labelledby="what-this-measures"
        className="mt-10 border-t-2 border-ink pt-6 dark:border-rule-strong"
      >
        <h2 id="what-this-measures" className="headline text-2xl">
          What “most covered” measures — and what it does not
        </h2>
        <div className="mt-3 max-w-3xl space-y-4 text-sm leading-relaxed text-muted sm:text-base">
          <p>
            Every entry here is a <strong>story cluster</strong>: separate
            reports about the same event, grouped into one story. The number
            beside each entry is the count of <strong>distinct publishers</strong>{" "}
            whose report landed in that cluster. A story reaches this page at{" "}
            {MIN_COVERAGE_SOURCES} publishers, because one publisher is not
            breadth — it is a single report.
          </p>
          <p>
            <strong>Breadth is not importance.</strong> Outlets cover the same
            event for reasons that have nothing to do with how much it matters:
            wire copy is widely republished, scheduled events are covered by
            everyone who planned for them, and cheap-to-cover stories attract
            more outlets than expensive-to-report ones. A single-outlet
            investigation can matter far more than an event twelve outlets
            attended. Importance is a separate, published calculation in which
            coverage breadth is one signal of six — see{" "}
            <Link href="/methodology" className="underline hover:text-brand-ink">
              how ranking works
            </Link>
            .
          </p>
          <p>
            <strong>
              Breadth is not agreement, consensus or verification.
            </strong>{" "}
            Counting publishers says nothing about whether their reports agree,
            how they frame the event, or whether any of them are correct. This
            page does not measure political lean, bias or reliability, and it
            is not designed to: CurrentWire’s authority tiers describe
            journalistic reputation and reach, never ideology.
          </p>
          <p>
            <strong>It is measured only over the publishers we ingest.</strong>{" "}
            CurrentWire recognizes and tiers {TRACKED_PUBLISHERS} publications
            in its source configuration, and {publishersRepresented}{" "}
            {publishersRepresented === 1 ? "is" : "are"} represented in the
            snapshot above — the full list is at{" "}
            <Link href="/sources" className="underline hover:text-brand-ink">
              Sources
            </Link>
            . A story covered by forty outlets we do not read still counts as
            zero here. The ceiling on this page is the width of our own feed
            list, not the width of the news industry, so every count is a{" "}
            <strong>lower bound</strong> on real-world coverage and is not
            comparable to another aggregator’s numbers.
          </p>
          <p>
            <strong>Syndication is not independent coverage.</strong> Copies of
            one press release travelling through several outlets are one
            distribution chain, not several reports. Clusters that are nothing
            but a press release and its syndicated copies are excluded from
            this page entirely, exactly as they are from the Top 100.
          </p>
          <p>
            <strong>Ties are real and common.</strong> Many stories sit at the
            same publisher count. When they do, the story with the higher
            overall ranking score is listed first, so the order is
            deterministic — but a story listed above another with the same
            count is not more widely covered than it.
          </p>
          <p>
            <strong>It is a snapshot, not a total.</strong> The count is what
            we had ingested at the timestamp above, inside the 72-hour ranking
            window. Coverage of a live event keeps arriving after this page is
            generated, and stories older than 72 hours leave the ranking
            altogether. Nothing here is a cumulative or historical total.
          </p>
          <p>
            Spotted a story we have mis-clustered or a publisher we have
            miscounted? That is a correctable error — see{" "}
            <Link href="/corrections" className="underline hover:text-brand-ink">
              corrections
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
