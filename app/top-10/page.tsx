import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, PUBLIC_CATEGORY_IDS } from "@/config/categories";
import { LastUpdated } from "@/components/news/LastUpdated";
import { RankedStory } from "@/components/news/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTop100 } from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";
import { ItemListJsonLd } from "@/lib/seo/structured-data";

// ISR like the section pages: the list only changes when the dataset
// refreshes, and this page has no query-string state to keep dynamic.
// COST floor, not a freshness choice: every ISR re-render is billed
// (Vercel Hobby-tier blowout, 2026-08-24 — ISR Writes 238%, CPU 307%).
// Do not lower this to chase TTFB; the cron's targeted revalidation
// keeps content fresh. Quota math lives in seo/PLAYBOOK.md.
export const revalidate = 3600;

const TITLE = "Top 10 News Stories Right Now";
const DESCRIPTION =
  "The 10 biggest news stories in the United States and Canada right now — ranked by freshness, coverage breadth, publisher authority and momentum, all day.";

/** Ranks 1–4 render above the fold: their thumbnails load eagerly. */
const EAGER_THUMBNAILS = 4;

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/top-10",
  rssPath: "/rss",
});

export default async function Top10Page() {
  const { stories, dataset } = await getTop100({});
  const top10 = stories.slice(0, 10);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <ItemListJsonLd clusters={top10} path="/top-10" name={TITLE} />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">{TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          The ten stories that matter most across the United States and Canada
          at this moment — the essentials, ranked by freshness, coverage
          breadth, publisher authority and momentum.{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            How ranking works
          </Link>
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      <nav
        aria-label="Top 10 by section"
        className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto border-b border-rule px-4 py-3 sm:-mx-6 sm:px-6"
      >
        {PUBLIC_CATEGORY_IDS.map((id) => (
          <Link
            key={id}
            href={`/top-10/${id}`}
            className="block whitespace-nowrap rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink"
          >
            {CATEGORIES[id].label}
          </Link>
        ))}
      </nav>

      {top10.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="No ranked stories are available right now. The list refreshes every few minutes."
            actionLabel="Browse the latest headlines"
            actionHref="/latest"
          />
        </div>
      ) : (
        <>
          <ol className="mt-2" aria-label="Top 10 ranked stories">
            {top10.map((cluster, index) => (
              <li key={cluster.id}>
                <RankedStory
                  cluster={cluster}
                  rank={index + 1}
                  eagerThumbnail={index < EAGER_THUMBNAILS}
                />
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-muted">
            Want the full picture?{" "}
            <Link
              href="/top-100"
              className="font-semibold underline hover:text-brand-ink"
            >
              See the Top 100 Right Now &rarr;
            </Link>{" "}
            &middot; In a hurry?{" "}
            <Link
              href="/briefing"
              className="font-semibold underline hover:text-brand-ink"
            >
              Daily Briefing &rarr;
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
