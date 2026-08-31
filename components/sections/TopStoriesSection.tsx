import type { StoryCluster } from "@/lib/news/types";
import { HeroStory } from "@/components/news/cards";
import { CompactStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";

/**
 * Rail thumbnails loaded eagerly, not lazily — but ONLY when the hero has no
 * image of its own.
 *
 * The rail sits beside the hero at `lg:` and above the fold there, which is
 * where this number came from. At `grid-cols-1` it stacks BELOW the hero:
 * measured 2026-08-31 on a 412x823 mobile viewport, the three eager
 * thumbnails render at y=1203/1319/1435 — 1.5 viewports down — and they are
 * raw publisher originals (976x549, 1024x683) because only the hero is
 * allowlisted through the optimizer. So on the viewport Google actually
 * scores, three full-size off-screen downloads competed with the LCP image
 * for a throttled connection: 6 image requests / 592 KB, with the hero's own
 * `loadTime` at 11,353 ms.
 *
 * The original reason for the eager rail still stands and is preserved: when
 * the hero cluster is imageless the page would otherwise render with every
 * image lazy and no protected LCP candidate. That case keeps its eager
 * thumbnails; the common case — a hero WITH an image, already
 * `fetchPriority="high"` — no longer pays for them.
 */
const EAGER_THUMBNAILS = 3;

/** Section A — dominant lead story with a rail of important secondaries. */
export function TopStoriesSection({
  hero,
  secondary,
}: {
  hero: StoryCluster | null;
  secondary: StoryCluster[];
}) {
  if (!hero) return null;
  // The hero is the LCP element whenever it has an image; the rail only has
  // to supply an LCP candidate when it does not.
  const eagerThumbnails = hero.imageUrl ? 0 : EAGER_THUMBNAILS;
  return (
    <section aria-labelledby="top-stories-heading" className="section-in">
      <div className="sr-only">
        <h2 id="top-stories-heading">Top stories</h2>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7 xl:col-span-8">
          <HeroStory cluster={hero} optimize />
        </div>
        <div className="lg:col-span-5 xl:col-span-4">
          <SectionHeader title="More top stories" />
          <div className="flex flex-col gap-5">
            {secondary.map((cluster, index) => (
              <CompactStory
                key={cluster.id}
                cluster={cluster}
                eagerThumbnail={index < eagerThumbnails}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
