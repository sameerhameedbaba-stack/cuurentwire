import type { Metadata } from "next";
import Link from "next/link";
import { CoverageReportBody } from "@/components/reports/ReportSections";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCoverageReport } from "@/lib/reports/coverage-report";
import {
  currentWeekIdET,
  previousWeekId,
  reportWeekIds,
  weekRangeET,
} from "@/lib/reports/weeks";
import { pageMetadata } from "@/lib/seo/metadata";
import { BreadcrumbJsonLd } from "@/lib/seo/structured-data";

/**
 * ISR. /reports/media-coverage is a STATIC route segment, so `revalidate`
 * alone engages it (see app/most-covered/page.tsx for the doc reference).
 * 30 minutes matches the cached current-week read: the archive gains rows
 * every 15-minute refresh, and a half-hour-old "this week so far" is honest.
 */
export const revalidate = 1800;

const TITLE = "Media Coverage Report";
const DESCRIPTION =
  "Weekly statistics from CurrentWire's own coverage data for US and Canada news: the stories the most publications covered, how fast coverage spread, category and geography mix, and which publishers joined multi-publication stories.";

export const metadata: Metadata = pageMetadata({
  title: `${TITLE} — US & Canada News, This Week`,
  description: DESCRIPTION,
  path: "/reports/media-coverage",
});

export default async function MediaCoverageReportPage() {
  const now = new Date();
  const weekId = currentWeekIdET(now);
  const range = weekRangeET(weekId);
  const report = await getCoverageReport(weekId, now);
  const pastWeeks = reportWeekIds(now);
  const prevId = previousWeekId(weekId);
  const previousLabel = prevId ? (weekRangeET(prevId)?.label ?? null) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: TITLE, path: "/reports/media-coverage" },
        ]}
      />

      <header className="border-b-2 border-ink pb-5 dark:border-rule-strong">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink">
          Weekly report &middot; {range?.label ?? weekId} &middot; this week so far
        </p>
        <h1 className="headline mt-1 text-3xl sm:text-4xl">{TITLE}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Statistics from CurrentWire&rsquo;s own coverage archive for the
          current week (Monday to Sunday, US Eastern time), refreshed through
          the week and frozen into a permanent page when the week ends. Which
          stories the most independent publications covered, how fast coverage
          spread, and who took part. See{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            how CurrentWire works
          </Link>{" "}
          or{" "}
          <Link href="/most-covered" className="underline hover:text-brand-ink">
            the most covered stories right now
          </Link>
          .
        </p>
      </header>

      {report ? (
        <CoverageReportBody report={report} previousLabel={previousLabel} />
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Not enough data yet this week"
            message="The report appears once CurrentWire has archived stories for the current week. Past weeks are listed below when available."
            actionLabel="See the most covered stories right now"
            actionHref="/most-covered"
          />
        </div>
      )}

      <section
        id="past-weeks"
        aria-labelledby="past-weeks-heading"
        className="mt-10 border-t border-rule pt-6"
      >
        <h2 id="past-weeks-heading" className="font-display text-lg font-bold">
          Past weeks
        </h2>
        <p className="mt-1 text-sm text-muted">
          Each completed week has a permanent report page.
        </p>
        {pastWeeks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            The first weekly report will appear when the current week ends.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pastWeeks.map((id) => (
              <li key={id}>
                <Link
                  href={`/reports/media-coverage/${id}`}
                  className="text-sm font-semibold underline-offset-2 hover:text-brand-ink hover:underline"
                >
                  {weekRangeET(id)?.label ?? id}
                  <span className="ml-2 font-normal text-muted">{id}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
