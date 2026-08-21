import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/config/categories";
import { LastUpdated } from "@/components/news/LastUpdated";
import { EmptyState } from "@/components/ui/EmptyState";
import { listBriefingDates } from "@/lib/database/briefing";
import { getTop100 } from "@/lib/news/queries";
import { COUNTRY_LABELS, type Country } from "@/lib/news/types";
import { newsDayET } from "@/lib/utils/news-day";
import { pageMetadata } from "@/lib/seo/metadata";
import { briefingMetaDescription, briefingMetaTitle } from "@/lib/seo/story-indexing";
import { ItemListJsonLd } from "@/lib/seo/structured-data";

export const revalidate = 300;

const TITLE = "Daily News Briefing";
const DESCRIPTION =
  "Today's news in five minutes: the stories that matter most across the United States and Canada, ranked and summarized in one place — updated all day, archived every evening.";

/**
 * Title names the region and today's ET news day; the description quotes
 * the live top headlines (same cached dataset the page renders, no extra
 * read) so the snippet changes with the news instead of repeating the
 * standing sentence every day. The standing sentence remains the fallback
 * for an empty dataset.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { stories } = await getTop100({});
  const description = briefingMetaDescription(stories.slice(0, 10)) || DESCRIPTION;
  return pageMetadata({
    title: briefingMetaTitle(dayLabel(newsDayET())),
    description,
    path: "/briefing",
    rssPath: "/rss",
  });
}

/** "August 21, 2026" for a YYYY-MM-DD day string. */
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function countryLabel(country: string): string {
  return COUNTRY_LABELS[country as Country] ?? country;
}

export default async function BriefingPage() {
  const [{ stories, dataset }, pastDates] = await Promise.all([
    getTop100({}),
    listBriefingDates(),
  ]);
  const top10 = stories.slice(0, 10);
  const today = newsDayET();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <meta name="cw-dataset-version" content={dataset.datasetVersion} />
      <ItemListJsonLd clusters={top10} path="/briefing" name={TITLE} />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          {dayLabel(today)}
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Today&rsquo;s news in five minutes: the stories that matter most
          across the United States and Canada, ranked by freshness, coverage
          breadth, publisher authority and momentum.{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            How ranking works
          </Link>
        </p>
        <div className="mt-3">
          <LastUpdated generatedAt={dataset.generatedAt} />
        </div>
      </header>

      {top10.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message="No ranked stories are available right now. The briefing refreshes every few minutes."
            actionLabel="Browse the latest headlines"
            actionHref="/latest"
          />
        </div>
      ) : (
        <ol className="mt-2 divide-y divide-rule">
          {top10.map((cluster, index) => (
            <li key={cluster.id} className="flex gap-4 py-4">
              <span
                aria-label={`Story ${index + 1}`}
                className="w-8 shrink-0 pt-0.5 font-display text-xl font-extrabold tabular-nums leading-none text-rule-strong dark:text-faint"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold leading-snug">
                  <Link
                    href={`/story/${cluster.slug}`}
                    className="hover:text-brand-ink"
                  >
                    {cluster.title}
                  </Link>
                </h2>
                {cluster.summary ? (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                    {cluster.summary}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  {CATEGORIES[cluster.category].label} &middot;{" "}
                  {countryLabel(cluster.country)} &middot; {cluster.sourceCount}{" "}
                  {cluster.sourceCount === 1 ? "publication" : "publications"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Want more depth?{" "}
        <Link
          href="/top-10"
          className="font-semibold underline hover:text-brand-ink"
        >
          Top 10 with pictures &rarr;
        </Link>{" "}
        &middot;{" "}
        <Link
          href="/top-100"
          className="font-semibold underline hover:text-brand-ink"
        >
          Full Top 100 &rarr;
        </Link>
      </p>

      {pastDates.length > 0 ? (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="font-display text-lg font-bold">Past briefings</h2>
          <p className="mt-1 text-sm text-muted">
            Each day&rsquo;s briefing is archived permanently at the end of the
            day.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pastDates.map((date) => (
              <li key={date}>
                <Link
                  href={`/briefing/${date}`}
                  className="text-sm font-semibold underline-offset-2 hover:text-brand-ink hover:underline"
                >
                  {dayLabel(date)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
