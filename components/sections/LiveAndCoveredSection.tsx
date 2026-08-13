import Link from "next/link";
import type { StoryCluster } from "@/lib/news/types";
import { LiveStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";
import { Timestamp } from "@/components/news/atoms";

/** Section B — live/developing stream beside the Most Covered module. */
export function LiveAndCoveredSection({
  liveDeveloping,
  mostCovered,
}: {
  liveDeveloping: StoryCluster[];
  mostCovered: StoryCluster[];
}) {
  if (liveDeveloping.length === 0 && mostCovered.length === 0) return null;
  return (
    <section aria-label="Developing stories and most covered" className="section-in">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {liveDeveloping.length > 0 ? (
          <div className="lg:col-span-7 xl:col-span-8">
            <SectionHeader title="Live & Developing" href="/latest" />
            <div>
              {liveDeveloping.map((cluster) => (
                <LiveStory key={cluster.id} cluster={cluster} />
              ))}
            </div>
          </div>
        ) : null}
        {mostCovered.length > 0 ? (
          <div className={liveDeveloping.length > 0 ? "lg:col-span-5 xl:col-span-4" : "lg:col-span-12"}>
            <SectionHeader title="Most Covered" />
            <p className="-mt-2 mb-3 text-xs text-muted">
              Stories currently receiving the broadest credible reporting.
            </p>
            <ol className="divide-y divide-rule">
              {mostCovered.map((cluster) => (
                <li key={cluster.id} className="py-3">
                  <article>
                    <h3 className="text-[0.9375rem] font-semibold leading-snug">
                      <Link href={`/story/${cluster.slug}`} className="hover:text-brand-ink">
                        <span className="story-link">{cluster.title}</span>
                      </Link>
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-bold text-brand-ink">
                        {cluster.sourceCount} sources
                      </span>{" "}
                      · <Timestamp iso={cluster.lastPublishedAt} />
                    </p>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
