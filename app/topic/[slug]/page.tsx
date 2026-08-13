import type { Metadata } from "next";
import { RankedStory } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTopicStories } from "@/lib/news/queries";
import { NOINDEX_FOLLOW, shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { topicName, stories } = await getTopicStories(slug);
  const name = topicName ?? "Topic";
  const metadata = pageMetadata({
    title: `${name} — Coverage`,
    description: `Current stories about ${name} across the United States and Canada, ranked by importance.`,
    path: `/topic/${slug}`,
  });
  // Thin topic pages stay crawlable (follow) but out of the index.
  if (!shouldIndexCollection(stories.length)) {
    metadata.robots = NOINDEX_FOLLOW;
  }
  return metadata;
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { topicName, stories, dataset } = await getTopicStories(slug);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Topics", path: "/topics" },
          { name: topicName ?? slug, path: `/topic/${slug}` },
        ]}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">Topic</p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{topicName}</h1>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {stories.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No current stories on this topic"
            message="Coverage changes continuously — this topic has no stories in the current news window."
            actionLabel="Browse all topics"
            actionHref="/topics"
          />
        </div>
      ) : (
        <>
          <ItemListJsonLd
            clusters={stories}
            path={`/topic/${slug}`}
            name={`${topicName} coverage`}
          />
          <ol className="mt-2">
            {stories.map((cluster, index) => (
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
