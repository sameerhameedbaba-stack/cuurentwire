import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CATEGORY_IDS, CATEGORIES } from "@/config/categories";
import { RankedStory } from "@/components/news/cards";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  parseCategoryFilter,
  parseCountryFilter,
  parseTimeFilter,
  searchStories,
} from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Search",
  description: "Search current coverage across the United States and Canada.",
  path: "/search",
  noIndex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const query = one(params.q).slice(0, 120);
  const country = parseCountryFilter(one(params.country) || undefined);
  const category = parseCategoryFilter(one(params.category) || undefined);
  const time = parseTimeFilter(one(params.time) || undefined);

  const hasQuery = query.trim().length > 0;
  const { results } = hasQuery
    ? await searchStories(query, { country, category, time })
    : { results: [] };

  const selectClass =
    "border border-rule bg-surface px-3 py-2 text-sm font-semibold text-ink focus:border-brand";

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <header className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Search CurrentWire</h1>
        <form action="/search" method="get" role="search" className="mt-5">
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search CurrentWire"
                aria-label="Search query"
                autoFocus={!hasQuery}
                className="w-full border border-rule bg-surface py-3 pl-11 pr-4 text-base focus:border-brand"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 bg-ink px-6 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
            >
              Search
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              Country
              <select name="country" defaultValue={country} className={selectClass}>
                <option value="all">All</option>
                <option value="us">United States</option>
                <option value="canada">Canada</option>
                <option value="global">Global</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              Category
              <select name="category" defaultValue={category} className={selectClass}>
                <option value="all">All</option>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              Time
              <select name="time" defaultValue={time} className={selectClass}>
                <option value="latest">Any time</option>
                <option value="3h">Past 3 hours</option>
                <option value="6h">Past 6 hours</option>
                <option value="12h">Past 12 hours</option>
                <option value="24h">Past 24 hours</option>
              </select>
            </label>
          </div>
        </form>
      </header>

      {!hasQuery ? (
        <p className="mt-8 text-sm text-muted">
          Search headlines, summaries, sources and topics across current
          coverage.
        </p>
      ) : results.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={`No results for “${query}”`}
            message="Try different keywords, widen the time window, or browse the Top 100."
            actionLabel="Go to Top 100"
            actionHref="/top-100"
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted" role="status">
            {results.length} {results.length === 1 ? "story" : "stories"} for{" "}
            <span className="font-semibold text-ink">“{query}”</span>
          </p>
          <ol className="mt-2">
            {results.map((cluster, index) => (
              <li key={cluster.id}>
                <RankedStory cluster={cluster} rank={index + 1} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
