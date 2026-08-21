import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  CATEGORY_IDS,
  PUBLIC_CATEGORY_IDS,
  isCategoryId,
} from "@/config/categories";
import { hubsForCategory } from "@/config/hubs";
import { ArticleRow, HeroStory, StandardStory, HeadlineStory } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { SectionHeader } from "@/components/news/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCategoryData } from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

// ISR: category pages re-render at most every 5 minutes — the dataset only
// changes on the 30-minute refresh, so per-request rendering bought nothing.
export const revalidate = 300;

export function generateStaticParams() {
  return CATEGORY_IDS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  // notFound() here (before streaming starts) so the response is a real 404.
  if (!isCategoryId(category)) notFound();
  const def = CATEGORIES[category];
  // "general" is the internal low-confidence bucket: it renders if visited
  // directly but must never be indexed or promoted (it is absent from nav,
  // sitemap and feeds — see PUBLIC_CATEGORY_IDS).
  const isPublic = (PUBLIC_CATEGORY_IDS as readonly string[]).includes(category);
  return pageMetadata({
    // "Politics News" is how people search the section; the nav label and
    // on-page h1 stay the plain section name.
    title: def.seoTitle ?? `${def.label} News`,
    description: def.description,
    path: def.path,
    noIndex: !isPublic,
    // Every public category has a matching feed (app/rss/[feed]).
    rssPath: isPublic ? `/rss/${category}` : undefined,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();
  const def = CATEGORIES[category];
  const data = await getCategoryData(category);

  if (!data.hero) {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6">
        <EmptyState
          title={`No recent ${def.label} stories`}
          message="Try another category, or check Latest for newly published coverage."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={data.dataset.datasetVersion} />
      <BreadcrumbJsonLd
        items={[{ name: "Home", path: "/" }, { name: def.label, path: def.path }]}
      />
      <ItemListJsonLd
        clusters={[data.hero, ...data.secondary, ...data.more]}
        path={def.path}
        name={`Top ${def.label} stories`}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-5xl">{def.label}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          {def.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <LastUpdated generatedAt={data.dataset.generatedAt} />
          <div className="flex gap-2 text-xs font-semibold">
            {(PUBLIC_CATEGORY_IDS as readonly string[]).includes(category) ? (
              <>
                <Link
                  href={`/top-10/${category}`}
                  className="text-muted underline-offset-2 hover:text-brand-ink hover:underline"
                >
                  Top 10 today
                </Link>
                <span aria-hidden className="text-rule-strong">|</span>
              </>
            ) : null}
            <Link
              href={`/top-100?category=${category}`}
              className="text-muted underline-offset-2 hover:text-brand-ink hover:underline"
            >
              Ranked view
            </Link>
            <span aria-hidden className="text-rule-strong">|</span>
            <Link
              href={`/top-100?category=${category}&country=us`}
              className="text-muted underline-offset-2 hover:text-brand-ink hover:underline"
            >
              US only
            </Link>
            <span aria-hidden className="text-rule-strong">|</span>
            <Link
              href={`/top-100?category=${category}&country=canada`}
              className="text-muted underline-offset-2 hover:text-brand-ink hover:underline"
            >
              Canada only
            </Link>
          </div>
        </div>
        {hubsForCategory(category).length > 0 ? (
          <nav aria-label="Related topic hubs" className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Topics
            </span>
            {hubsForCategory(category).map((hub) => (
              <Link
                key={hub.id}
                href={`/${hub.id}`}
                className="rounded-full border border-rule bg-surface px-3 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-ink"
              >
                {hub.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {/* The page header above is the h1 — the hero headline demotes to
              h2 so the page never carries two h1s. */}
          <HeroStory cluster={data.hero} headingLevel="h2" />
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {data.secondary.map((cluster) => (
              <StandardStory key={cluster.id} cluster={cluster} showImage />
            ))}
          </div>
          {data.more.length > 0 ? (
            <section aria-label="More stories" className="mt-12">
              <SectionHeader title="More important stories" />
              <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                {data.more.map((cluster) => (
                  <div key={cluster.id} className="border-b border-rule py-2.5">
                    <HeadlineStory cluster={cluster} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {/* Stories whose PRIMARY category is different but that also touch
              this section — explicitly labeled, never mixed into the main
              feed above (category-page hard invariant). */}
          {data.related.length > 0 ? (
            <section aria-label="Related coverage" className="mt-12">
              <SectionHeader title="Related coverage from other sections" />
              <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                {data.related.map((cluster) => (
                  <div key={cluster.id} className="border-b border-rule py-2.5">
                    <HeadlineStory cluster={cluster} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-8">
          <SectionHeader title="Latest" href="/latest" />
          <div>
            {data.latest.slice(0, 8).map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
