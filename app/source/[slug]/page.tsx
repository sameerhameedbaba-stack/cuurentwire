import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleRow } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSourceStories } from "@/lib/news/queries";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { sourceName } = await getSourceStories(slug);
  // Real 404 status requires notFound() before the response starts streaming.
  if (!sourceName) notFound();
  return pageMetadata({
    title: `${sourceName} — Latest stories`,
    description: `Latest stories sourced from ${sourceName}, with links to the original reporting.`,
    path: `/source/${slug}`,
  });
}

export default async function SourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { source, sourceName, articles, dataset } = await getSourceStories(slug);
  if (!sourceName) notFound();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Sources", path: "/sources" },
          { name: sourceName, path: `/source/${slug}` },
        ]}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">Source</p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{sourceName}</h1>
        <p className="mt-2 text-sm text-muted">
          Latest stories sourced from {sourceName}
          {source ? ` · Authority tier ${source.tier}` : ""}. Headlines link to
          CurrentWire story pages; original reporting is always linked and
          attributed there.
        </p>
        <p className="mt-1 text-xs text-faint">
          Listing here reflects aggregation only and does not imply any
          endorsement of or partnership with CurrentWire.
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {articles.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No current stories from this source"
            actionLabel="Browse all sources"
            actionHref="/sources"
          />
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
