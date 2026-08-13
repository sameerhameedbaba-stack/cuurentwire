import type { CategoryId } from "@/config/categories";
import { CATEGORIES } from "@/config/categories";
import type { StoryCluster } from "@/lib/news/types";
import { MajorStory, StandardStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";

/**
 * Sections E–K — reusable category band: one lead plus supporting stories.
 * `tone="wash"` alternates the background for section rhythm.
 */
export function CategoryBand({
  category,
  clusters,
  title,
  tone = "paper",
}: {
  category: CategoryId;
  clusters: StoryCluster[];
  title?: string;
  tone?: "paper" | "wash";
}) {
  if (clusters.length === 0) return null;
  const def = CATEGORIES[category];
  const [lead, ...rest] = clusters;
  const supporting = rest.slice(0, 4);

  const inner = (
    <section aria-label={title ?? def.label} className="section-in">
      <SectionHeader title={title ?? def.label} href={def.path} />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5 lg:col-span-4">
          <MajorStory cluster={lead} />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:col-span-7 lg:col-span-8 lg:grid-cols-4">
          {supporting.map((cluster, index) => (
            <StandardStory
              key={cluster.id}
              cluster={cluster}
              showImage={index < 2}
            />
          ))}
        </div>
      </div>
    </section>
  );

  if (tone === "wash") {
    return (
      <div className="bg-wash py-10 dark:bg-wash">
        <div className="mx-auto max-w-[1360px] px-4 sm:px-6">{inner}</div>
      </div>
    );
  }
  return inner;
}
