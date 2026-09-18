import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/categories";
import { siteConfig } from "@/config/site";
import {
  ArticleBody,
  ArticleCorrections,
  ArticleSources,
} from "@/components/editorial/ArticleBody";
import { AI_DISCLOSURE_NOTICE } from "@/lib/editorial/article";
import { getArticleBySlug, getPublishedArticles } from "@/lib/editorial/store";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, OriginalArticleJsonLd } from "@/lib/seo/structured-data";
import { fullTimestamp } from "@/lib/utils/time";

/**
 * Original CurrentWire articles.
 *
 * FULLY STATIC — no ISR, no `revalidate`, no database. Every article is a file
 * in the repo, so every path is known at build time and each page is rendered
 * once and then served as a static asset. This is the cost decision that makes
 * the slim relaunch viable: the aggregator's `/story/` pages re-rendered on
 * demand and burned 4.8M ISR writes against a 200K allowance. These pages
 * generate zero.
 *
 * Publishing is therefore a deploy. A new article is a commit; the diff is the
 * review surface.
 */

/** Nothing outside the built set exists — a stray URL is a real 404. */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getPublishedArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return pageMetadata({ title: "Not found", description: "", path: `/article/${slug}`, noIndex: true });
  return pageMetadata({
    title: article.title,
    description: article.dek,
    path: `/article/${article.slug}`,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const category = CATEGORIES[article.category];
  const updated = article.updatedAt && article.updatedAt !== article.publishedAt;

  return (
    <article className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
      <OriginalArticleJsonLd article={article} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: category.label, path: category.path },
          { name: article.title, path: `/article/${article.slug}` },
        ]}
      />

      <header className="border-b-2 border-ink pb-6 dark:border-rule-strong">
        <Link
          href={category.path}
          className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink hover:underline"
        >
          {category.label}
        </Link>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{article.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">{article.dek}</p>
        <p className="mt-4 text-sm text-muted">
          By{" "}
          <Link href="/news-desk" className="underline underline-offset-2 hover:text-brand-ink">
            CurrentWire News Desk
          </Link>
          {" · "}
          <time dateTime={article.publishedAt}>{fullTimestamp(article.publishedAt)}</time>
          {updated ? (
            <>
              {" · updated "}
              <time dateTime={article.updatedAt}>{fullTimestamp(article.updatedAt!)}</time>
            </>
          ) : null}
        </p>
      </header>

      <div className="prose-cw mt-8 text-[1.0625rem]">
        <ArticleBody blocks={article.body} />
      </div>

      <ArticleCorrections corrections={article.corrections} />

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          Reporting this article draws on
        </h2>
        <p className="mt-2 text-sm text-muted">
          Every publication below reported this story independently. Open them and
          check the account yourself.
        </p>
        <ArticleSources sources={article.sources} />
      </section>

      <footer className="mt-8 rounded border border-rule bg-surface-2 p-4 text-sm text-muted">
        <p>{AI_DISCLOSURE_NOTICE}</p>
        <p className="mt-2">
          Spotted an error?{" "}
          <Link href="/corrections" className="underline underline-offset-2 hover:text-brand-ink">
            Tell us
          </Link>{" "}
          and we will correct it on this page, with the change noted.{" "}
          <a
            href={`mailto:${siteConfig.correctionsEmail}`}
            className="underline underline-offset-2 hover:text-brand-ink"
          >
            {siteConfig.correctionsEmail}
          </a>
        </p>
      </footer>
    </article>
  );
}
