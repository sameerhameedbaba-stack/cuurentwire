import Link from "next/link";
import type { StoryCluster } from "@/lib/news/types";
import { RankedStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";

/** Section L — Top 100 preview: first ten ranked stories plus the full list. */
export function Top100Preview({ clusters }: { clusters: StoryCluster[] }) {
  if (clusters.length === 0) return null;
  return (
    <section aria-label="Top 100 right now" className="section-in">
      <SectionHeader
        title="Top 100 Right Now"
        href="/top-100"
        description="Every important story across the United States and Canada — ranked by freshness, coverage breadth, source authority and momentum."
      />
      <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
        <div>
          {clusters.slice(0, 5).map((cluster, index) => (
            <RankedStory key={cluster.id} cluster={cluster} rank={index + 1} showThumbnail={false} />
          ))}
        </div>
        <div className="border-t border-rule lg:border-t-0">
          {clusters.slice(5, 10).map((cluster, index) => (
            <RankedStory key={cluster.id} cluster={cluster} rank={index + 6} showThumbnail={false} />
          ))}
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <Link
          href="/top-100"
          className="border border-ink bg-ink px-6 py-3 text-sm font-bold text-paper transition-colors hover:bg-brand hover:border-brand hover:text-white dark:border-rule-strong"
        >
          See the full Top 100
        </Link>
      </div>
    </section>
  );
}
