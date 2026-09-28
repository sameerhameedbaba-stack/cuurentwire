import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/config/categories";
import { LAUNCH_CATEGORIES } from "@/lib/editorial/eligibility";
import { getPublishedArticles } from "@/lib/editorial/store";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, LinkListJsonLd } from "@/lib/seo/structured-data";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * STATIC-SITE OVERLAY for `/[category]`.
 *
 * Copied over `app/[category]/page.tsx` by scripts/build-static-site.mjs. The
 * original renders ranked aggregator clusters; this renders the original
 * articles in one category, read from the repo at build time.
 *
 * Which categories get a page: the launch verticals (always — they are in the
 * navigation, so they must never 404), plus any other category that has at
 * least one published article (an owner-approved health piece links to
 * /health, so /health must exist). Nothing else is generated, and
 * `dynamicParams = false` makes every other path a real 404.
 */

export const dynamicParams = false;

function categoriesToBuild(): CategoryId[] {
  const withArticles = new Set(getPublishedArticles().map((a) => a.category));
  return CATEGORY_IDS.filter(
    (id) => LAUNCH_CATEGORIES.includes(id) || withArticles.has(id),
  );
}

export function generateStaticParams(): { category: string }[] {
  return categoriesToBuild().map((category) => ({ category }));
}

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isCategoryId(category)) return {};
  const definition = CATEGORIES[category];
  const count = getPublishedArticles().filter((a) => a.category === category).length;
  return pageMetadata({
    title: `${definition.label} news`,
    description: `Original ${definition.label.toLowerCase()} articles from CurrentWire, each written from two or more independent reports you can open and check.`,
    path: definition.path,
    // An empty section is thin content. It must exist (it is in the nav) but
    // must not be indexed until it has something in it. noindex,FOLLOW: its
    // links (nav, /articles) should still be crawled.
    noIndexFollow: count === 0,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategoryId(category)) notFound();
  const definition = CATEGORIES[category];
  const articles = getPublishedArticles().filter((a) => a.category === category);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: definition.label, path: definition.path },
        ]}
      />
      <header className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">Section</p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{definition.label}</h1>
      </header>

      {articles.length === 0 ? (
        <p className="mt-8 text-muted">
          No {definition.label.toLowerCase()} articles yet.{" "}
          <Link href="/articles" className="underline underline-offset-2 hover:text-brand-ink">
            See all articles
          </Link>
          .
        </p>
      ) : (
        <>
          <LinkListJsonLd
            items={articles.map((a) => ({ name: a.title, url: `/article/${a.slug}` }))}
            path={definition.path}
            name={`CurrentWire ${definition.label}`}
          />
          <ul className="mt-8 divide-y divide-rule">
            {articles.map((article) => (
              <li key={article.slug} className="py-5 first:pt-0">
                <h2 className="headline text-xl">
                  <Link href={`/article/${article.slug}`} className="hover:text-brand-ink hover:underline">
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-1.5 text-muted">{article.dek}</p>
                <p className="mt-2 text-sm text-muted">
                  <time dateTime={article.publishedAt}>{fullTimestamp(article.publishedAt)}</time>
                  {" · "}
                  {article.sources.length} publications
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
