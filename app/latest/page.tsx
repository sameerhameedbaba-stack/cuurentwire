import type { Metadata } from "next";
import Link from "next/link";
import { ArticleRow } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getLatest, parseCountryFilter, type CountryFilter } from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Latest News",
  description:
    "The newest reporting across the United States, Canada and the world, in reverse chronological order.",
  path: "/latest",
});

const TABS: { value: CountryFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/latest" },
  { value: "us", label: "United States", href: "/latest?country=us" },
  { value: "canada", label: "Canada", href: "/latest?country=canada" },
  { value: "global", label: "World", href: "/latest?country=global" },
];

export default async function LatestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.country) ? params.country[0] : params.country;
  const country = parseCountryFilter(raw);
  const { articles, dataset } = await getLatest(country, 80);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
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
    </div>
  );
}
