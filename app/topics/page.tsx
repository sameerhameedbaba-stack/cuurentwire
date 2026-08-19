import type { Metadata } from "next";
import Link from "next/link";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDataset } from "@/lib/cache/store";
import { deriveTrending } from "@/lib/news/trending";
import { shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { CollectionPageJsonLd } from "@/lib/seo/structured-data";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
export const revalidate = 300;

/** One string for both <meta name="description"> and the CollectionPage. */
const DESCRIPTION =
  "Browse current coverage by topic — institutions, places and themes derived from live reporting.";

export const metadata: Metadata = pageMetadata({
  title: "Topics",
  description: DESCRIPTION,
  path: "/topics",
});

export default async function TopicsPage() {
  const dataset = await getDataset();
  const topics = deriveTrending(dataset.clusters, 40);
  // Only hubs that clear the thin-collection bar go into the schema. The thin
  // ones answer `noindex, follow` (app/topic/[slug]/page.tsx) and app/sitemap.ts
  // filters this same list the same way — structured data must never advertise
  // a URL that tells crawlers to stay out. The visible <ul> below still links
  // all of them, which is correct: they are crawlable, just not indexable.
  const indexableTopics = topics.filter((topic) =>
    shouldIndexCollection(topic.clusterCount),
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <CollectionPageJsonLd
        path="/topics"
        name="Topics"
        description={DESCRIPTION}
        items={indexableTopics.map((topic) => ({
          name: topic.topic,
          url: `/topic/${topic.slug}`,
        }))}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Topics</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Topics are derived from entities in current coverage and update as the
          news changes.
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {topics.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No active topics right now" />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topics.map((topic) => (
            <li key={topic.slug}>
              <Link
                href={`/topic/${topic.slug}`}
                className="group flex items-baseline justify-between gap-3 border border-rule bg-surface px-4 py-3 transition-colors hover:border-brand"
              >
                <span className="font-display text-base font-bold group-hover:text-brand-ink">
                  {topic.topic}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {topic.clusterCount} {topic.clusterCount === 1 ? "story" : "stories"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
