import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CoverageReportBody,
  ReportArticleJsonLd,
} from "@/components/reports/ReportSections";
import {
  describeCoverageReport,
  getCoverageReport,
} from "@/lib/reports/coverage-report";
import {
  isReportableWeekId,
  nextWeekId,
  previousWeekId,
  reportWeekIds,
  weekRangeET,
  type WeekRange,
} from "@/lib/reports/weeks";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/structured-data";

// ISR: a completed week's archive rows never change, so its report is
// effectively immutable; hourly re-renders only pick up late merges.
export const revalidate = 3600;

/**
 * Required for `revalidate` to apply on a dynamic segment: empty array =
 * nothing prerendered at build, every week page ISR-cached on first visit
 * (same pattern as /briefing/[date] and /archive/[date]).
 */
export async function generateStaticParams(): Promise<{ week: string }[]> {
  return [];
}

const TITLE = "Media Coverage Report";

/** Null when the id is malformed, before the archive, the current week or in the future. */
function resolveWeek(week: string): WeekRange | null {
  if (!isReportableWeekId(week)) return null;
  return weekRangeET(week);
}

/** "Monday, August 17" for a YYYY-MM-DD calendar day. */
function dayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ week: string }>;
}): Promise<Metadata> {
  const { week } = await params;
  // notFound() here (before streaming starts) so the response is a real 404.
  const range = resolveWeek(week);
  if (!range) notFound();
  const report = await getCoverageReport(week);
  if (!report) notFound();
  return pageMetadata({
    title: `${TITLE} — ${range.label}`,
    description: describeCoverageReport(report, range.label),
    path: `/reports/media-coverage/${week}`,
  });
}

export default async function MediaCoverageWeekPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const range = resolveWeek(week);
  if (!range) notFound();
  // A valid-looking week with no archived stories (a gap in the archive, or
  // a run without a database) is a real 404, not an indexable empty page.
  const report = await getCoverageReport(week);
  if (!report) notFound();

  const path = `/reports/media-coverage/${week}`;
  const headline = `${TITLE} — ${range.label}`;
  const description = describeCoverageReport(report, range.label);
  const reportable = new Set(reportWeekIds());
  const prevId = previousWeekId(week);
  const nextId = nextWeekId(week);
  const previous = prevId && reportable.has(prevId) ? prevId : null;
  const next = nextId && reportable.has(nextId) ? nextId : null;
  const previousLabel = prevId ? (weekRangeET(prevId)?.label ?? null) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: TITLE, path: "/reports/media-coverage" },
          { name: range.label, path },
        ]}
      />
      <ReportArticleJsonLd
        headline={headline}
        description={description}
        path={path}
        dateISO={range.endDay}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          <Link href="/reports/media-coverage" className="hover:underline">
            Media Coverage Report
          </Link>{" "}
          &middot; {week}
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{range.label}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          {description} Computed from CurrentWire&rsquo;s own story archive for
          the week of {dayLong(range.startDay)} through {dayLong(range.endDay)},
          US Eastern time. See the{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            methodology
          </Link>{" "}
          or{" "}
          <Link href="/most-covered" className="underline hover:text-brand-ink">
            the most covered stories right now
          </Link>
          .
        </p>
      </header>

      <CoverageReportBody report={report} previousLabel={previousLabel} />

      <nav
        aria-label="Other weeks"
        className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5 text-sm"
      >
        <span>
          {previous ? (
            <Link
              href={`/reports/media-coverage/${previous}`}
              className="font-semibold underline hover:text-brand-ink"
            >
              &larr; {weekRangeET(previous)?.label ?? previous}
            </Link>
          ) : null}
        </span>
        <Link
          href="/reports/media-coverage"
          className="font-semibold underline hover:text-brand-ink"
        >
          This week so far
        </Link>
        <span>
          {next ? (
            <Link
              href={`/reports/media-coverage/${next}`}
              className="font-semibold underline hover:text-brand-ink"
            >
              {weekRangeET(next)?.label ?? next} &rarr;
            </Link>
          ) : null}
        </span>
      </nav>
    </div>
  );
}
