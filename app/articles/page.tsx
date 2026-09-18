import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/config/categories";
import { getPublishedArticles } from "@/lib/editorial/store";
import { pageMetadata } from "@/lib/seo/metadata";
import { LinkListJsonLd } from "@/lib/seo/structured-data";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * Index of CurrentWire's original articles.
 *
 * This page exists primarily so the articles are not ORPHANED. Article pages
 * are built from files in the repo, and nothing else on the site links to
 * them — a sitemap entry alone is a weak discovery signal, and this project
 * has already paid for that lesson once (archive-sitemap.xml sat submitted and
 * uncrawled for 17 days while 92% of the site's URLs went unread; see
 * seo/MEMORY/2026-08-31-serving-200-is-not-being-read.md). A real, linked
 * index gives crawlers a path in and readers somewhere to browse.
 *
 * Static like the articles themselves: no database, no ISR.
 */

const DESCRIPTION =
  "Original CurrentWire articles — each written from reporting by two or more independent publications you can open and check.";

export const metadata: Metadata = pageMetadata({
  title: "Articles",
  description: DESCRIPTION,
  path: "/articles",
});

export default function ArticlesIndexPage() {
  const articles = getPublishedArticles();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
      <header className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          CurrentWire
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">Articles</h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          {DESCRIPTION}
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="mt-8 text-muted">
          No articles published yet.{" "}
          <Link href="/latest" className="underline underline-offset-2 hover:text-brand-ink">
            See the latest coverage
          </Link>
          .
        </p>
      ) : (
        <>
          <LinkListJsonLd
            items={articles.map((article) => ({
              name: article.title,
              url: `/article/${article.slug}`,
            }))}
            path="/articles"
            name="CurrentWire articles"
          />
          <ul className="mt-8 divide-y divide-rule">
            {articles.map((article) => (
              <li key={article.slug} className="py-5 first:pt-0">
                <Link
                  href={`/${article.category}`}
                  className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink hover:underline"
                >
                  {CATEGORIES[article.category].label}
                </Link>
                <h2 className="headline mt-1 text-xl">
                  <Link
                    href={`/article/${article.slug}`}
                    className="hover:text-brand-ink hover:underline"
                  >
                    {article.title}
                  </Link>
                </h2>
                <p className="mt-1.5 text-muted">{article.dek}</p>
                <p className="mt-2 text-sm text-muted">
                  <time dateTime={article.publishedAt}>
                    {fullTimestamp(article.publishedAt)}
                  </time>
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
