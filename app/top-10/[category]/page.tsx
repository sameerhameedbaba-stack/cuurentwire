import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  PUBLIC_CATEGORY_IDS,
  isCategoryId,
  type CategoryId,
} from "@/config/categories";
import { LastUpdated } from "@/components/news/LastUpdated";
import { RankedStory } from "@/components/news/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTop100 } from "@/lib/news/queries";
import { shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  BreadcrumbJsonLd,
  ItemListJsonLd,
} from "@/lib/seo/structured-data";

export const revalidate = 300;

/** Ranks 1–4 render above the fold: their thumbnails load eagerly. */
const EAGER_THUMBNAILS = 4;

/**
 * Title noun per section, phrased the way people actually search
 * ("top political news today", "top 10 tech news"), not the way our nav
 * labels the section. Keys are the public category ids only — the internal
 * "general" bucket never gets a Top 10 page.
 */
const SEARCH_NOUNS: Record<Exclude<CategoryId, "general">, string> = {
  politics: "Political News",
  business: "Business News",
  technology: "Tech News",
  world: "World News",
  climate: "Climate News",
  health: "Health News",
  science: "Science News",
  culture: "Entertainment News",
  sports: "Sports News",
};

function isPublicCategory(
  value: string,
): value is Exclude<CategoryId, "general"> {
  return (
    isCategoryId(value) &&
    (PUBLIC_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

function pageTitle(category: Exclude<CategoryId, "general">): string {
  return `Top 10 ${SEARCH_NOUNS[category]} Today`;
}

export function generateStaticParams() {
  return PUBLIC_CATEGORY_IDS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isPublicCategory(category)) notFound();
  const def = CATEGORIES[category];
  const { stories } = await getTop100({ category });
  // A near-empty list is not a page worth indexing — same bar as topic and
  // source hubs. Links stay crawlable so the stories are still discovered.
  const thin = !shouldIndexCollection(Math.min(stories.length, 10));
  return pageMetadata({
    title: pageTitle(category),
    description: `The 10 biggest ${def.label.toLowerCase()} stories in the United States and Canada right now — ranked by coverage, freshness and momentum, updated all day.`,
    path: `/top-10/${category}`,
    noIndexFollow: thin,
    rssPath: `/rss/${category}`,
  });
}

export default async function Top10CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isPublicCategory(category)) notFound();
  const def = CATEGORIES[category];
  const title = pageTitle(category);
  const { stories, dataset } = await getTop100({ category });
  const top10 = stories.slice(0, 10);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <BreadcrumbJsonLd
        items={[
          { name: "Top 10", path: "/top-10" },
          { name: def.label, path: `/top-10/${category}` },
        ]}
      />
      <ItemListJsonLd
        clusters={top10}
        path={`/top-10/${category}`}
        name={title}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          The ten most important {def.label.toLowerCase()} stories across the
          United States and Canada right now — ranked by freshness, coverage
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
        <Link
          href="/top-10"
          className="block whitespace-nowrap rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink"
        >
          All sections
        </Link>
        {PUBLIC_CATEGORY_IDS.map((id) => (
          <Link
            key={id}
            href={`/top-10/${id}`}
            aria-current={id === category ? "true" : undefined}
            className={`block whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              id === category
                ? "border-ink bg-ink text-paper dark:border-rule-strong"
                : "border-rule bg-surface text-ink hover:border-brand hover:text-brand-ink"
            }`}
          >
            {CATEGORIES[id].label}
          </Link>
        ))}
      </nav>

      {top10.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message={`No ranked ${def.label.toLowerCase()} stories are available right now. The list refreshes every few minutes.`}
            actionLabel={`Browse all ${def.label} coverage`}
            actionHref={def.path}
          />
        </div>
      ) : (
        <>
          <ol className="mt-2" aria-label={`Top 10 ${def.label} stories`}>
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
            <Link
              href={def.path}
              className="font-semibold underline hover:text-brand-ink"
            >
              All {def.label} coverage &rarr;
            </Link>{" "}
            &middot;{" "}
            <Link
              href="/top-100"
              className="font-semibold underline hover:text-brand-ink"
            >
              Full Top 100 &rarr;
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
