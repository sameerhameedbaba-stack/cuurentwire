import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getArchiveBrowse, type ArchiveDaySummary } from "@/lib/database/archive";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  BreadcrumbJsonLd,
  CollectionPageJsonLd,
} from "@/lib/seo/structured-data";

// ISR: past archive days are immutable and the index only gains a new day
// once every 24 hours, so an hourly re-render is already generous.
export const revalidate = 3600;

/** One string for <meta name="description"> and the CollectionPage JSON-LD. */
const DESCRIPTION =
  "Browse every story CurrentWire has covered, organized by the day it was first published. Story pages stay online permanently.";

export const metadata: Metadata = pageMetadata({
  title: "News Archive",
  description: DESCRIPTION,
  path: "/archive",
});

/** "August 17, 2026" for a YYYY-MM-DD UTC day (noon avoids TZ edge drift). */
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "August 2026" for a YYYY-MM month key. */
function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Group newest-first day buckets into contiguous month sections. */
function groupByMonth(
  days: ArchiveDaySummary[],
): { key: string; label: string; days: ArchiveDaySummary[] }[] {
  const months: { key: string; label: string; days: ArchiveDaySummary[] }[] = [];
  for (const day of days) {
    const key = day.day.slice(0, 7);
    const current = months[months.length - 1];
    if (current && current.key === key) {
      current.days.push(day);
    } else {
      months.push({ key, label: monthLabel(key), days: [day] });
    }
  }
  return months;
}

export default async function ArchivePage() {
  const days = await getArchiveBrowse();
  const months = groupByMonth(days);
  const totalStories = days.reduce((sum, day) => sum + day.storyCount, 0);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      {/*
        /archive is the HTML entry point to every permanent story URL — 5,891
        of them on 2026-08-24 — and it shipped no JSON-LD at all, while the
        /archive/<date> pages below it have carried BreadcrumbList + ItemList
        since 2026-08-19. Same CollectionPage shape as /topics: the value of
        this page IS the collection.

        Every listed day page answers 200 and is indexable, so unlike /topics
        there is no thin-collection filter to apply here — but the same rule
        holds and is the reason this maps day buckets rather than stories:
        schema must only ever advertise URLs that answer `index`.

        The empty guard is not defensive padding: getArchiveBrowse
        deliberately does NOT throw when the database is unreachable (this
        route is prerendered at build time, so throwing would fail `next
        build` during exactly the outage the fix has to deploy through — see
        seo/MEMORY/2026-08-21-an-outage-is-not-a-fact-about-the-world.md).
        A CollectionPage declaring numberOfItems: 0 during such an outage
        would be a well-formed, cacheable claim that the archive is empty,
        which is the same mistake the empty <urlset> was. The breadcrumb is
        true either way and stays.
      */}
      {days.length > 0 ? (
        <CollectionPageJsonLd
          path="/archive"
          name="News Archive"
          description={DESCRIPTION}
          items={days.map((day) => ({
            name: dayLabel(day.day),
            url: `/archive/${day.day}`,
          }))}
        />
      ) : null}
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Archive", path: "/archive" },
        ]}
      />
      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <h1 className="headline text-3xl sm:text-4xl">Archive</h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Every story CurrentWire has covered, organized by the day we first
          published it. Story pages stay online permanently. For current
          coverage, see{" "}
          <Link href="/latest" className="underline hover:text-brand-ink">
            Latest
          </Link>
          .
        </p>
        {days.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            {totalStories.toLocaleString("en-US")}{" "}
            {totalStories === 1 ? "story" : "stories"} across {days.length}{" "}
            {days.length === 1 ? "day" : "days"}
          </p>
        ) : null}
      </header>

      {days.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="The archive is empty"
            message="Archived stories appear here once the permanent archive has data."
          />
        </div>
      ) : (
        months.map((month) => (
          <section key={month.key} className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              {month.label}
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {month.days.map((day) => (
                <li key={day.day}>
                  <Link
                    href={`/archive/${day.day}`}
                    className="group flex items-baseline justify-between gap-3 border border-rule bg-surface px-4 py-3 transition-colors hover:border-brand"
                  >
                    <span className="font-display text-base font-bold group-hover:text-brand-ink">
                      {dayLabel(day.day)}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {day.storyCount} {day.storyCount === 1 ? "story" : "stories"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
