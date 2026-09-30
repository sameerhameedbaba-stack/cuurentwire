import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { LAUNCH_CATEGORIES } from "@/lib/editorial/eligibility";
import { getPublishedArticles } from "@/lib/editorial/store";
import { pageMetadata } from "@/lib/seo/metadata";
import { LinkListJsonLd, OrganizationJsonLd, WebSiteJsonLd } from "@/lib/seo/structured-data";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * STATIC-SITE OVERLAY for `/`.
 *
 * This file is copied over `app/(home)/page.tsx` by scripts/build-static-site.mjs
 * when building the GitHub Pages site. The original home page renders the
 * aggregator's ranked clusters, which need the dataset, the database and a
 * server; this one renders original articles from `content/articles/`, read at
 * build time. Nothing here runs per request.
 *
 * It lives outside `app/` so the Vercel app keeps its own home page untouched.
 * It is still type-checked and linted with the rest of the repo.
 */

export const metadata: Metadata = {
  ...pageMetadata({
    title: siteConfig.seo.defaultTitle,
    description: siteConfig.seo.defaultDescription,
    path: "/",
    rssPath: siteConfig.social.rss,
  }),
  // `absolute`, not the site template: defaultTitle already carries the
  // brand, and the template would append "| CurrentWire" a second time.
  title: { absolute: siteConfig.seo.defaultTitle },
  // Identifies the GitHub Pages build. The uptime probe checks for it, so a
  // domain that answers 200 while serving something else (the old Vercel app,
  // a parking page, a mis-pointed DNS record) is caught rather than passed.
  other: { "cw-site": "static" },
};

/** How many articles the front page leads with before the section lists. */
const LEAD_COUNT = 6;
/** Per-category preview length. */
const SECTION_COUNT = 4;

export default function HomePage() {
  const articles = getPublishedArticles();
  const lead = articles.slice(0, LEAD_COUNT);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <section className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          CurrentWire
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">
          Original news, checked against more than one report.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          Every CurrentWire article is written from reporting by at least two
          independent publications — and at least two of them are free to read,
          so you can open them and check the account yourself.{" "}
          <Link href="/editorial-standards" className="underline underline-offset-2 hover:text-brand-ink">
            How we work
          </Link>
          .
        </p>
      </section>

      {articles.length === 0 ? (
        <p className="mt-10 text-muted">
          The first articles are on their way.{" "}
          <Link href="/about" className="underline underline-offset-2 hover:text-brand-ink">
            Read about CurrentWire
          </Link>
          .
        </p>
      ) : (
        <>
          <LinkListJsonLd
            items={lead.map((a) => ({ name: a.title, url: `/article/${a.slug}` }))}
            path="/"
            name="Latest from CurrentWire"
          />

          <section className="mt-8" aria-labelledby="latest-heading">
            <h2 id="latest-heading" className="text-sm font-bold uppercase tracking-wide">
              Latest
            </h2>
            <ul className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {lead.map((article, index) => (
                <li
                  key={article.slug}
                  className={index === 0 ? "sm:col-span-2 border-b border-rule pb-6" : ""}
                >
                  <Link
                    href={`/${article.category}`}
                    className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink hover:underline"
                  >
                    {CATEGORIES[article.category].label}
                  </Link>
                  <h3 className={`headline mt-1 ${index === 0 ? "text-2xl sm:text-3xl" : "text-lg"}`}>
                    <Link href={`/article/${article.slug}`} className="hover:text-brand-ink hover:underline">
                      {article.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-muted">{article.dek}</p>
                  <p className="mt-2 text-sm text-muted">
                    <time dateTime={article.publishedAt}>{fullTimestamp(article.publishedAt)}</time>
                    {" · "}
                    {article.sources.length} publications
                  </p>
                </li>
              ))}
            </ul>
            {articles.length > LEAD_COUNT ? (
              <p className="mt-6">
                <Link href="/articles" className="text-sm font-bold underline underline-offset-2 hover:text-brand-ink">
                  All {articles.length} articles →
                </Link>
              </p>
            ) : null}
          </section>

          {LAUNCH_CATEGORIES.map((categoryId) => {
            const inCategory = articles.filter((a) => a.category === categoryId);
            if (inCategory.length === 0) return null;
            const category = CATEGORIES[categoryId];
            return (
              <section
                key={categoryId}
                className="mt-10 border-t border-rule pt-6"
                aria-labelledby={`section-${categoryId}`}
              >
                <h2 id={`section-${categoryId}`} className="headline text-xl">
                  <Link href={category.path} className="hover:text-brand-ink hover:underline">
                    {category.label}
                  </Link>
                </h2>
                <ul className="mt-3 space-y-3">
                  {inCategory.slice(0, SECTION_COUNT).map((article) => (
                    <li key={article.slug}>
                      <Link href={`/article/${article.slug}`} className="font-semibold hover:text-brand-ink hover:underline">
                        {article.title}
                      </Link>
                      <span className="ml-2 text-sm text-muted">
                        <time dateTime={article.publishedAt}>{fullTimestamp(article.publishedAt)}</time>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
