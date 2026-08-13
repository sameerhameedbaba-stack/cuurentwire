import type { StoryCluster } from "@/lib/news/types";
import { HeroStory } from "@/components/news/cards";
import { CompactStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";

/** Section A — dominant lead story with a rail of important secondaries. */
export function TopStoriesSection({
  hero,
  secondary,
}: {
  hero: StoryCluster | null;
  secondary: StoryCluster[];
}) {
  if (!hero) return null;
  return (
    <section aria-labelledby="top-stories-heading" className="section-in">
      <div className="sr-only">
        <h2 id="top-stories-heading">Top stories</h2>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7 xl:col-span-8">
          <HeroStory cluster={hero} />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <SectionHeader title="More top stories" />
          <div className="flex flex-col gap-5">
            {secondary.map((cluster) => (
              <CompactStory key={cluster.id} cluster={cluster} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
