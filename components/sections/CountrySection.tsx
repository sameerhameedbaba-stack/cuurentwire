import type { StoryCluster } from "@/lib/news/types";
import { HeadlineStory, MajorStory, StandardStory } from "@/components/news/cards";
import { SectionHeader } from "@/components/news/SectionHeader";

/** Sections C & D — United States / Canada: lead, supporting, headline list. */
export function CountrySection({
  title,
  href,
  accent,
  clusters,
}: {
  title: string;
  href: string;
  accent: "us" | "canada";
  clusters: StoryCluster[];
}) {
  if (clusters.length === 0) return null;
  const [lead, ...rest] = clusters;
  const supporting = rest.slice(0, 4);
  const headlines = rest.slice(4, 10);

  return (
    <section aria-label={title} className="section-in">
      <SectionHeader title={title} href={href} accent={accent} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <MajorStory cluster={lead} />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-4">
          {supporting.map((cluster) => (
            <StandardStory key={cluster.id} cluster={cluster} />
          ))}
        </div>
        {headlines.length > 0 ? (
          <div className="border-t border-rule pt-4 lg:col-span-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              More headlines
            </h3>
            <div className="mt-2 divide-y divide-rule">
              {headlines.map((cluster) => (
                <div key={cluster.id} className="py-2">
                  <HeadlineStory cluster={cluster} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
