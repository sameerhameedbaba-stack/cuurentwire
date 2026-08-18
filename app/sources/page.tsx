import type { Metadata } from "next";
import Link from "next/link";
import { LastUpdated } from "@/components/news/LastUpdated";
import { listActiveSources } from "@/lib/news/queries";
import { shouldIndexCollection } from "@/lib/seo/indexing";
import { pageMetadata } from "@/lib/seo/metadata";
import { LinkListJsonLd } from "@/lib/seo/structured-data";

// ISR (audit F1): serve from the edge cache and re-render at most every
// 5 minutes. The cron refresh calls revalidatePath() after each new
// dataset so a fresh generation flips this page promptly.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Sources",
  description:
    "Publications currently represented in CurrentWire coverage, grouped by authority tier.",
  path: "/sources",
});

const TIER_DESCRIPTIONS: Record<string, string> = {
  A: "Major wire services, public-service broadcasters and national publications.",
  B: "Strong regional and specialist publications.",
  C: "Smaller credible publications.",
};

export default async function SourcesPage() {
  const { sources, dataset } = await listActiveSources();
  const tiers = ["A", "B", "C"].filter((tier) =>
    sources.some((s) => s.tier === tier),
  );

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      {/* Only the publisher hubs that clear the thin-collection bar are listed:
          the ones below it answer noindex, and an ItemList must not point at
          pages we ask Google to drop. */}
      <LinkListJsonLd
        name="Sources"
        path="/sources"
        items={sources
          .filter((source) => shouldIndexCollection(source.articleCount))
          .map((source) => ({
            name: source.name,
            url: `/source/${source.slug}`,
          }))}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Sources</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Publications currently represented in CurrentWire coverage. Tiers
          reflect journalistic reputation and reach — never political
          orientation. See{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            how ranking works
          </Link>
          .
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {tiers.map((tier) => (
        <section key={tier} aria-label={`Tier ${tier} sources`} className="mt-8">
          <h2 className="headline text-xl">Tier {tier}</h2>
          <p className="mt-1 text-sm text-muted">{TIER_DESCRIPTIONS[tier]}</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sources
              .filter((source) => source.tier === tier)
              .map((source) => (
                <li key={source.slug}>
                  <Link
                    href={`/source/${source.slug}`}
                    className="group flex items-baseline justify-between gap-3 border border-rule bg-surface px-4 py-3 transition-colors hover:border-brand"
                  >
                    <span className="font-semibold group-hover:text-brand-ink">
                      {source.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {source.articleCount}{" "}
                      {source.articleCount === 1 ? "story" : "stories"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
