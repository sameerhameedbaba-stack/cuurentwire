import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, PUBLIC_CATEGORY_IDS } from "@/config/categories";
import { LastUpdated } from "@/components/news/LastUpdated";
import { RankedStory } from "@/components/news/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getTop100,
  parseCategoryFilter,
  parseCountryFilter,
  parseTimeFilter,
  type CountryFilter,
  type SortOrder,
  type TimeFilter,
} from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";
import { ItemListJsonLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

const DESCRIPTION =
  "The 100 most important current stories across the United States and Canada — ranked by freshness, coverage breadth, source authority and momentum.";

// Pages 2-4 carry ranks 26-100: each needs its own canonical and title so
// Google doesn't treat them as duplicates of page 1 (same pattern as /latest).
// Filtered variants still canonicalize to the plain page.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  return pageMetadata({
    title: page > 1 ? `Top 100 Right Now — Page ${page}` : "Top 100 Right Now",
    description: DESCRIPTION,
    path: page > 1 ? `/top-100?page=${page}` : "/top-100",
    rssPath: "/rss",
  });
}

const PAGE_SIZE = 25;

const COUNTRY_OPTIONS: { value: CountryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "us", label: "United States" },
  { value: "canada", label: "Canada" },
  { value: "us-canada", label: "US + Canada" },
  { value: "global", label: "Global Relevant" },
];

const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "3h", label: "3 hours" },
  { value: "6h", label: "6 hours" },
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
];

function filterHref(params: {
  country: CountryFilter;
  category: string;
  time: TimeFilter;
  sort: SortOrder;
  page?: number;
}): string {
  const query = new URLSearchParams();
  if (params.country !== "all") query.set("country", params.country);
  if (params.category !== "all") query.set("category", params.category);
  if (params.time !== "latest") query.set("time", params.time);
  if (params.sort !== "importance") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return qs ? `/top-100?${qs}` : "/top-100";
}

export default async function Top100Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const country = parseCountryFilter(one(params.country));
  const category = parseCategoryFilter(one(params.category));
  const time = parseTimeFilter(one(params.time));
  const sort: SortOrder =
    one(params.sort) === "most-covered" ? "most-covered" : "importance";
  const page = Math.max(1, Number.parseInt(one(params.page) ?? "1", 10) || 1);

  const { stories, totalAvailable, dataset } = await getTop100({
    country,
    category,
    time,
    sort,
  });

  const totalPages = Math.max(1, Math.ceil(stories.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = stories.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const current = { country, category, time, sort };

  const chip = (active: boolean) =>
    `block whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      active
        ? "border-ink bg-ink text-paper dark:border-rule-strong"
        : "border-rule bg-surface text-ink hover:border-brand hover:text-brand-ink"
    }`;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <ItemListJsonLd
        clusters={visible}
        path="/top-100"
        name="Top 100 Right Now"
        startPosition={(currentPage - 1) * PAGE_SIZE + 1}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Top 100 Right Now</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Every important story across the United States and Canada — ranked by
          freshness, coverage breadth, source authority and momentum.{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            How ranking works
          </Link>
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {/* Filters — plain links so state lives in the URL. */}
      <div className="sticky top-[41px] z-30 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <nav aria-label="Country filter" className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {COUNTRY_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={filterHref({ ...current, country: option.value })}
              aria-current={country === option.value ? "true" : undefined}
              className={chip(country === option.value)}
            >
              {option.label}
            </Link>
          ))}
          <span aria-hidden className="mx-1 my-auto h-4 w-px shrink-0 bg-rule" />
          <Link
            href={filterHref({ ...current, category: "all" })}
            aria-current={category === "all" ? "true" : undefined}
            className={chip(category === "all")}
          >
            All topics
          </Link>
          {PUBLIC_CATEGORY_IDS.map((id) => (
            <Link
              key={id}
              href={filterHref({ ...current, category: id })}
              aria-current={category === id ? "true" : undefined}
              className={chip(category === id)}
            >
              {CATEGORIES[id].label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Time and sort" className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto">
          {TIME_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={filterHref({ ...current, time: option.value })}
              aria-current={time === option.value ? "true" : undefined}
              className={chip(time === option.value)}
            >
              {option.label}
            </Link>
          ))}
          <span aria-hidden className="mx-1 my-auto h-4 w-px shrink-0 bg-rule" />
          <Link
            href={filterHref({ ...current, sort: "importance" })}
            aria-current={sort === "importance" ? "true" : undefined}
            className={chip(sort === "importance")}
          >
            Importance
          </Link>
          <Link
            href={filterHref({ ...current, sort: "most-covered" })}
            aria-current={sort === "most-covered" ? "true" : undefined}
            className={chip(sort === "most-covered")}
          >
            Most Covered
          </Link>
        </nav>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="No stories match these filters right now. Widen the time window or try another category."
            actionLabel="Reset filters"
            actionHref="/top-100"
          />
        </div>
      ) : (
        <>
          <ol className="mt-2" aria-label="Ranked stories">
            {visible.map((cluster, index) => (
              <li key={cluster.id}>
                <RankedStory
                  cluster={cluster}
                  rank={(currentPage - 1) * PAGE_SIZE + index + 1}
                />
              </li>
            ))}
          </ol>

          {totalPages > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex items-center justify-center gap-2"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={filterHref({ ...current, page: p })}
                  aria-current={p === currentPage ? "page" : undefined}
                  className={`flex h-9 min-w-9 items-center justify-center border px-2 text-sm font-bold transition-colors ${
                    p === currentPage
                      ? "border-ink bg-ink text-paper dark:border-rule-strong"
                      : "border-rule bg-surface hover:border-brand hover:text-brand-ink"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          ) : null}

          <p className="mt-6 text-center text-xs text-muted">
            Showing {visible.length} of {Math.min(totalAvailable, 100)} ranked
            stories
            {totalAvailable > 100 ? ` (${totalAvailable} matched)` : ""}.
          </p>
        </>
      )}
    </div>
  );
}
