import type { Metadata } from "next";
import { RankedStory } from "@/components/news/cards";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTopicStories } from "@/lib/news/queries";
import { NOINDEX_FOLLOW, shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/lib/seo/structured-data";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
export const revalidate = 300;

/**
 * Required for the `revalidate` above to do anything: a dynamic segment with
 * no generateStaticParams is server-rendered on every request. Empty array =
 * nothing prerendered at build, every topic hub ISR-cached on first visit.
 * See app/story/[slug]/page.tsx for the doc reference.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { topicName, canonicalSlug, stories } = await getTopicStories(slug);
  const name = topicName ?? "Topic";
  // Near-duplicate hubs are consolidated with rel=canonical, never a
  // redirect: this route answers 200 for ANY slug (verified live — a
  // nonsense slug returns 200, noindex/follow), so every variant URL stays
  // alive and simply points its equity at the canonical form.
  // `alternates.canonical` emits <link rel="canonical"> — see
  // node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md
  const metadata = pageMetadata({
    title: `${name} — Coverage`,
    description: `Current stories about ${name} across the United States and Canada, ranked by importance.`,
    path: `/topic/${canonicalSlug}`,
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
  const { topicName, canonicalSlug, stories, dataset } = await getTopicStories(slug);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Topics", path: "/topics" },
          { name: topicName ?? slug, path: `/topic/${canonicalSlug}` },
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
            path={`/topic/${canonicalSlug}`}
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
