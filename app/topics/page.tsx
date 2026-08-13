import type { Metadata } from "next";
import Link from "next/link";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDataset } from "@/lib/cache/store";
import { deriveTrending } from "@/lib/news/trending";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Topics",
  description:
    "Browse current coverage by topic — institutions, places and themes derived from live reporting.",
  path: "/topics",
});

export default async function TopicsPage() {
  const dataset = await getDataset();
  const topics = deriveTrending(dataset.clusters, 40);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
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
