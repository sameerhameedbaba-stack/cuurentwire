import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CATEGORIES, isCategoryId } from "@/config/categories";
import { getBriefing } from "@/lib/database/briefing";
import { COUNTRY_LABELS, type Country } from "@/lib/news/types";
import { isValidDayString, newsDayET } from "@/lib/utils/news-day";
import { pageMetadata } from "@/lib/seo/metadata";
import { briefingMetaDescription, briefingMetaTitle } from "@/lib/seo/story-indexing";
import { BreadcrumbJsonLd, LinkListJsonLd } from "@/lib/seo/structured-data";

// ISR: a past briefing never changes once its day has rolled over.
export const revalidate = 3600;

/**
 * Required for `revalidate` to apply on a dynamic segment: empty array =
 * nothing prerendered at build, every day page ISR-cached on first visit
 * (same pattern as /archive/[date]).
 */
export async function generateStaticParams(): Promise<{ date: string }[]> {
  return [];
}

/**
 * A renderable briefing day: a real calendar date, not in the future
 * (Eastern time — the briefing's news-day clock). Today is valid too, but
 * the page redirects it to /briefing (one canonical home for "today").
 */
function parseBriefingDay(value: string): string | null {
  if (!isValidDayString(value)) return null;
  if (value > newsDayET()) return null;
  return value;
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

/** Display label for a stored category id (old ids fall back verbatim). */
function categoryLabel(category: string): string {
  if (isCategoryId(category)) return CATEGORIES[category].label;
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function countryLabel(country: string): string {
  return COUNTRY_LABELS[country as Country] ?? country;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  // notFound() here (before streaming starts) so the response is a real 404.
  if (!parseBriefingDay(date)) notFound();
  const label = dayLabel(date);
  // The stored items (cached read, the same one the page makes) drive the
  // description; today's date redirects to /briefing in the body, so it is
  // not read here. A day with no row falls back to the standing sentence —
  // the body then answers the real 404.
  const briefing = date === newsDayET() ? null : await getBriefing(date);
  const description =
    briefingMetaDescription(briefing?.items ?? [], { dayLabel: label }) ||
    `The top news stories of ${label} across the United States and Canada, ranked and summarized — CurrentWire's permanent briefing for the day.`;
  return pageMetadata({
    title: briefingMetaTitle(label),
    description,
    path: `/briefing/${date}`,
  });
}

export default async function BriefingDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!parseBriefingDay(date)) notFound();
  // One canonical home for today's briefing.
  if (date === newsDayET()) redirect("/briefing");
  const briefing = await getBriefing(date);
  // Days before the briefing existed (or a run without a database) are a
  // real 404, not an indexable empty page.
  if (!briefing || briefing.items.length === 0) notFound();
  const label = dayLabel(date);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Daily Briefing", path: "/briefing" },
          { name: label, path: `/briefing/${date}` },
        ]}
      />
      <LinkListJsonLd
        name={`Daily news briefing — ${label}`}
        path={`/briefing/${date}`}
        items={briefing.items.map((item) => ({
          name: item.title,
          url: `/story/${item.slug}`,
        }))}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          <Link href="/briefing" className="hover:underline">
            Daily Briefing
          </Link>
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{label}</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          The {briefing.items.length} stories that mattered most on {label},
          as ranked at the end of that day. Story pages stay online
          permanently.
        </p>
      </header>

      <ol className="mt-2 divide-y divide-rule">
        {briefing.items.map((item) => (
          <li key={item.slug} className="flex gap-4 py-4">
            <span
              aria-label={`Story ${item.rank}`}
              className="w-8 shrink-0 pt-0.5 font-display text-xl font-extrabold tabular-nums leading-none text-rule-strong dark:text-faint"
            >
              {String(item.rank).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold leading-snug">
                <Link
                  href={`/story/${item.slug}`}
                  className="hover:text-brand-ink"
                >
                  {item.title}
                </Link>
              </h2>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                  {item.summary}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-muted">
                {categoryLabel(item.category)} &middot;{" "}
                {countryLabel(item.country)} &middot; {item.sourceCount}{" "}
                {item.sourceCount === 1 ? "publication" : "publications"}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-center text-sm text-muted">
        <Link
          href={`/archive/${date}`}
          className="font-semibold underline hover:text-brand-ink"
        >
          Everything archived from this day &rarr;
        </Link>{" "}
        &middot;{" "}
        <Link
          href="/briefing"
          className="font-semibold underline hover:text-brand-ink"
        >
          Today&rsquo;s briefing &rarr;
        </Link>
      </p>
    </div>
  );
}
