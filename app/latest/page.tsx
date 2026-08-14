import type { Metadata } from "next";
import Link from "next/link";
import { ArticleRow } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { siteConfig } from "@/config/site";
import {
  getLatest,
  parseCountryFilter,
  parsePageParam,
  type CountryFilter,
} from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Crawlable href for a page of the feed, preserving the country tab. */
function pageHref(country: CountryFilter, page: number): string {
  const query = new URLSearchParams();
  if (country !== "all") query.set("country", country);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `/latest?${qs}` : "/latest";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = parsePageParam(first(params.page));
  // Country tabs canonicalize to the full feed (as before); deeper pages
  // get their own canonical so paginated content is indexed distinctly.
  return pageMetadata({
    title: page > 1 ? `Latest News — Page ${page}` : "Latest News",
    description:
      "The newest reporting across the United States, Canada and the world, in reverse chronological order.",
    path: page > 1 ? `/latest?page=${page}` : "/latest",
  });
}

const TABS: { value: CountryFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/latest" },
  { value: "us", label: "United States", href: "/latest?country=us" },
  { value: "canada", label: "Canada", href: "/latest?country=canada" },
  { value: "global", label: "World", href: "/latest?country=global" },
];

/** Page numbers to render: ends plus a window around the current page. */
function pageWindow(current: number, pageCount: number): number[] {
  const pages = new Set<number>([1, pageCount]);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

export default async function LatestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const country = parseCountryFilter(first(params.country));
  const requestedPage = parsePageParam(first(params.page));
  const { articles, page, pageCount, dataset } = await getLatest(
    country,
    PAGE_SIZE,
    requestedPage,
  );
  const numbers = pageWindow(page, pageCount);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      {/* Pagination discovery hints for crawlers (hoisted into <head>). */}
      {page > 1 ? (
        <link
          rel="prev"
          href={new URL(pageHref("all", page - 1), siteConfig.url).toString()}
        />
      ) : null}
      {page < pageCount ? (
        <link
          rel="next"
          href={new URL(pageHref("all", page + 1), siteConfig.url).toString()}
        />
      ) : null}

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Latest</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Newest reporting first. For ranked importance, see the{" "}
          <Link href="/top-100" className="underline hover:text-brand-ink">
            Top 100
          </Link>
          .
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      <nav aria-label="Region tabs" className="border-b border-rule">
        <ul className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = country === tab.value;
            return (
              <li key={tab.value}>
                <Link
                  href={tab.href}
                  aria-current={active ? "true" : undefined}
                  className={`block whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-brand text-brand-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState actionLabel="View all latest" actionHref="/latest" />
        </div>
      ) : (
        <div className="mt-2">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex flex-wrap items-center gap-2 border-t border-rule pt-5 text-sm"
        >
          {page > 1 ? (
            <Link
              href={pageHref(country, page - 1)}
              rel="prev"
              className="border border-rule px-3 py-1.5 font-semibold hover:border-brand hover:text-brand-ink"
            >
              ← Previous
            </Link>
          ) : null}
          <ul className="flex flex-wrap items-center gap-1">
            {numbers.map((number, index) => (
              <li key={number} className="flex items-center gap-1">
                {index > 0 && numbers[index - 1] !== number - 1 ? (
                  <span aria-hidden className="px-1 text-faint">
                    …
                  </span>
                ) : null}
                {number === page ? (
                  <span
                    aria-current="page"
                    className="border border-brand bg-brand px-3 py-1.5 font-bold text-white"
                  >
                    {number}
                  </span>
                ) : (
                  <Link
                    href={pageHref(country, number)}
                    className="border border-rule px-3 py-1.5 font-semibold hover:border-brand hover:text-brand-ink"
                  >
                    {number}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {page < pageCount ? (
            <Link
              href={pageHref(country, page + 1)}
              rel="next"
              className="border border-rule px-3 py-1.5 font-semibold hover:border-brand hover:text-brand-ink"
            >
              Next →
            </Link>
          ) : null}
          <span className="ml-auto text-xs text-muted">
            Page {page} of {pageCount}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
