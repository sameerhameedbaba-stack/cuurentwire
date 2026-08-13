import { BreakingBanner } from "@/components/news/BreakingBanner";
import { LastUpdated } from "@/components/news/LastUpdated";
import { TrendingTopics } from "@/components/news/TrendingTopics";
import { CategoryBand } from "@/components/sections/CategoryBand";
import { CountrySection } from "@/components/sections/CountrySection";
import { LiveAndCoveredSection } from "@/components/sections/LiveAndCoveredSection";
import { Top100Preview } from "@/components/sections/Top100Preview";
import { TopStoriesSection } from "@/components/sections/TopStoriesSection";
import { AdSlot } from "@/components/ui/AdSlot";
import { EmptyState } from "@/components/ui/EmptyState";
import { NewsletterSignup } from "@/components/ui/NewsletterSignup";
import { getHomepageData } from "@/lib/news/queries";
import {
  ItemListJsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let data;
  try {
    data = await getHomepageData();
  } catch {
    return (
      <div className="mx-auto max-w-[1360px] px-4 py-16 sm:px-6">
        <EmptyState
          title="News feed temporarily unavailable"
          message="We couldn't load current coverage. Please try again in a few minutes."
          actionLabel="Retry"
          actionHref="/"
        />
      </div>
    );
  }

  const container = "mx-auto max-w-[1360px] px-4 sm:px-6";

  // A provider outage must never leave a silently blank front page.
  if (!data.hero) {
    return (
      <div className={`${container} py-16`}>
        <EmptyState
          title="News feed temporarily unavailable"
          message="Fresh coverage is being fetched. Please check back in a few minutes."
          actionLabel="Retry"
          actionHref="/"
        />
      </div>
    );
  }

  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <ItemListJsonLd
        clusters={data.top100Preview}
        path="/"
        name="Top stories right now"
      />

      <BreakingBanner cluster={data.breaking} />

      <div className={`${container} py-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TrendingTopics topics={data.trending} />
          <LastUpdated generatedAt={data.dataset.generatedAt} />
        </div>
      </div>

      <div className={`${container} flex flex-col gap-14 pb-4`}>
        <TopStoriesSection hero={data.hero} secondary={data.topSecondary} />
        <LiveAndCoveredSection
          liveDeveloping={data.liveDeveloping}
          mostCovered={data.mostCovered}
        />
        <CountrySection
          title="United States"
          href="/us"
          accent="us"
          clusters={data.us}
        />
        <CountrySection
          title="Canada"
          href="/canada"
          accent="canada"
          clusters={data.canada}
        />
        <AdSlot location="homepage-mid" />
        <CategoryBand
          category="business"
          title="Business & Economy"
          clusters={data.sections.business ?? []}
        />
      </div>

      <div className="my-10">
        <CategoryBand
          category="technology"
          clusters={data.sections.technology ?? []}
          tone="wash"
        />
      </div>

      <div className={`${container} flex flex-col gap-14`}>
        <CategoryBand category="world" clusters={data.sections.world ?? []} />
        <CategoryBand
          category="climate"
          title="Climate & Environment"
          clusters={data.sections.climate ?? []}
        />
        <CategoryBand
          category="health"
          title="Health & Science"
          clusters={[
            ...(data.sections.health ?? []),
            ...(data.sections.science ?? []),
          ].slice(0, 5)}
        />
        <CategoryBand category="culture" clusters={data.sections.culture ?? []} />
        <CategoryBand category="sports" clusters={data.sections.sports ?? []} />
        <NewsletterSignup />
        <Top100Preview clusters={data.top100Preview} />
      </div>
    </>
  );
}
