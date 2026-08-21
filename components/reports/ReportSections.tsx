import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { COUNTRY_LABELS, type Country } from "@/lib/news/types";
import {
  categoryDisplayLabel as categoryLabel,
  type CoverageReport,
  type MixEntry,
  type PublisherCount,
} from "@/lib/reports/coverage-report";
import { PUBLISHER_LOGO } from "@/lib/seo/structured-data";

/**
 * Presentational pieces of the Media Coverage Report, shared by the index
 * page (current week so far) and the permanent week pages. Plain tables and
 * lists, no charts; every number comes from the CoverageReport object.
 *
 * Copy rule: never the literal "<number> sources" — the production coherence
 * probe regex-anchors that string in story cards — so this file always says
 * "publications".
 */

const CONTENT_TYPE_BUCKET_LABELS: Record<string, string> = {
  news: "News",
  opinion: "Opinion",
  press_release: "Press release",
  other: "Other (analysis, live coverage)",
};

function geographyLabel(geography: string): string {
  return COUNTRY_LABELS[geography as Country] ?? geography;
}

function contentTypeLabel(bucket: string): string {
  return CONTENT_TYPE_BUCKET_LABELS[bucket] ?? bucket;
}

/** "42 min", "3 h 10 min", "2 d 5 h" — whole units, never decimals. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

/** "Aug 18, 2:05 PM ET" for an ISO instant. */
function formatFirstSeen(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })} ET`;
}

function formatPct(value: number): string {
  return `${value}%`;
}

function formatDelta(value: number, suffix = ""): string {
  if (value === 0) return "no change";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}${suffix}`;
}

function StoryLink({ slug, title }: { slug: string; title: string }) {
  return (
    <Link href={`/story/${slug}`} className="font-semibold hover:text-brand-ink hover:underline">
      {title}
    </Link>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-10">
      <h2 id={`${id}-heading`} className="headline text-xl sm:text-2xl">
        {title}
      </h2>
      {intro ? <p className="mt-1 max-w-2xl text-sm text-muted">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TH = "py-2 pr-4 text-left font-semibold";
const TD = "py-2 pr-4 align-top";
const TD_NUM = "py-2 pr-4 align-top tabular-nums";

/** The four numbers a reader wants first. */
export function HeadlineNumbers({ report }: { report: CoverageReport }) {
  const items: { label: string; value: string }[] = [
    { label: "Stories archived", value: report.totalStories.toLocaleString("en-US") },
    { label: "Publications represented", value: report.distinctPublishers.toLocaleString("en-US") },
    {
      label: "Covered by 2+ independent publications",
      value: formatPct(report.concentration.multiSourcePct),
    },
    {
      label: "Median publications per story",
      value: String(report.concentration.medianIndependentPublications),
    },
  ];
  return (
    <dl className="mt-6 grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-4">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{item.label}</dt>
          <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MostCoveredTable({ report }: { report: CoverageReport }) {
  return (
    <Section
      id="most-covered"
      title="Most covered stories"
      intro={
        <>
          Ranked by independent publications — the number of distinct publications
          CurrentWire had grouped into the story at its most recent refresh. Press
          releases are not listed here. For the live view, see{" "}
          <Link href="/most-covered" className="underline hover:text-brand-ink">
            Most covered right now
          </Link>
          .
        </>
      }
    >
      {report.mostCovered.length === 0 ? (
        <p className="text-sm text-muted">No stories qualified this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className={TH}>#</th>
                <th className={TH}>Story</th>
                <th className={TH}>Category</th>
                <th className={TH}>Publications</th>
                <th className={TH}>Recorded growth</th>
                <th className={TH}>To 2nd</th>
                <th className={TH}>To 3rd</th>
                <th className={TH}>First seen</th>
              </tr>
            </thead>
            <tbody>
              {report.mostCovered.map((entry, index) => (
                <tr key={entry.slug} className="border-b border-rule">
                  <td className={TD_NUM}>{index + 1}</td>
                  <td className={`${TD} min-w-[16rem]`}>
                    <StoryLink slug={entry.slug} title={entry.title} />
                  </td>
                  <td className={TD}>{categoryLabel(entry.category)}</td>
                  <td className={TD_NUM}>{entry.independentPublications}</td>
                  <td className={TD_NUM}>
                    {entry.coverageGrowth
                      ? `${entry.coverageGrowth.from} → ${entry.coverageGrowth.to}`
                      : "—"}
                  </td>
                  <td className={TD_NUM}>
                    {entry.minutesTo2 === null ? "—" : formatMinutes(entry.minutesTo2)}
                  </td>
                  <td className={TD_NUM}>
                    {entry.minutesTo3 === null ? "—" : formatMinutes(entry.minutesTo3)}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-muted`}>
                    {formatFirstSeen(entry.firstSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        &ldquo;To 2nd / 3rd&rdquo; is the time from CurrentWire first archiving the
        story to the refresh that first recorded two / three publications; a dash
        means the story already had that many when first seen, or its early history
        is no longer available.
      </p>
    </Section>
  );
}

export function VelocitySection({ report }: { report: CoverageReport }) {
  const { fastestTo2, fastestTo3, biggest24hPickup } = report.velocity;
  const none = !fastestTo2 && !fastestTo3 && !biggest24hPickup;
  return (
    <Section
      id="velocity"
      title="Coverage velocity"
      intro="How quickly coverage spread after CurrentWire first archived a story, measured from the story's recorded update history."
    >
      {none ? (
        <p className="text-sm text-muted">
          No growth was recorded in the update history this week.
        </p>
      ) : (
        <dl className="divide-y divide-rule border-y border-rule text-sm">
          {fastestTo2 ? (
            <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
              <dt className="font-semibold">Fastest to a 2nd publication</dt>
              <dd>
                <StoryLink slug={fastestTo2.slug} title={fastestTo2.title} /> —{" "}
                {formatMinutes(fastestTo2.minutes)} after first archived
              </dd>
            </div>
          ) : null}
          {fastestTo3 ? (
            <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
              <dt className="font-semibold">Fastest to a 3rd publication</dt>
              <dd>
                <StoryLink slug={fastestTo3.slug} title={fastestTo3.title} /> —{" "}
                {formatMinutes(fastestTo3.minutes)} after first archived
              </dd>
            </div>
          ) : null}
          {biggest24hPickup ? (
            <div className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr]">
              <dt className="font-semibold">Biggest 24-hour pickup</dt>
              <dd>
                <StoryLink slug={biggest24hPickup.slug} title={biggest24hPickup.title} /> —{" "}
                {biggest24hPickup.from} → {biggest24hPickup.to} publications within{" "}
                {formatMinutes(biggest24hPickup.withinMinutes)} of first being archived
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </Section>
  );
}

export function ConcentrationSection({ report }: { report: CoverageReport }) {
  const c = report.concentration;
  const rows: { label: string; value: string }[] = [
    { label: "Exactly one publication", value: formatPct(c.singleSourcePct) },
    { label: "Exactly two publications", value: formatPct(c.twoSourcePct) },
    { label: "Three or more publications", value: formatPct(c.threePlusPct) },
    { label: "Four or more publications", value: formatPct(c.fourPlusPct) },
    { label: "Median publications per story", value: String(c.medianIndependentPublications) },
    { label: "Mean publications per story", value: String(c.meanIndependentPublications) },
  ];
  return (
    <Section
      id="concentration"
      title="Coverage concentration"
      intro="Share of the week's stories by how many independent publications reported them. One-publication stories are unconfirmed reports; the 'three or more' and 'four or more' rows overlap by design."
    >
      <div className="overflow-x-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-rule">
                <td className={TD}>{row.label}</td>
                <td className={`${TD_NUM} text-right`}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function MixTable({
  id,
  title,
  intro,
  mix,
  labelOf,
  hideZero = false,
}: {
  id: string;
  title: string;
  intro: string;
  mix: MixEntry[];
  labelOf: (id: string) => string;
  hideZero?: boolean;
}) {
  const shown = hideZero ? mix.filter((m) => m.count > 0) : mix;
  return (
    <Section id={id} title={title} intro={intro}>
      <div className="overflow-x-auto">
        <table className="w-full max-w-xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className={TH}>Segment</th>
              <th className={`${TH} text-right`}>Stories</th>
              <th className={`${TH} text-right`}>Share</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((entry) => (
              <tr key={entry.id} className="border-b border-rule">
                <td className={TD}>{labelOf(entry.id)}</td>
                <td className={`${TD_NUM} text-right`}>{entry.count.toLocaleString("en-US")}</td>
                <td className={`${TD_NUM} text-right`}>{formatPct(entry.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function MixSections({ report }: { report: CoverageReport }) {
  return (
    <>
      <MixTable
        id="categories"
        title="Category mix"
        intro="Share of the week's stories by section, including the low-confidence General bucket that the navigation never promotes."
        mix={report.categoryMix}
        labelOf={categoryLabel}
      />
      <MixTable
        id="geography"
        title="Geography mix"
        intro="Share of the week's stories by the geography CurrentWire assigned them."
        mix={report.geographyMix}
        labelOf={geographyLabel}
        hideZero
      />
      <MixTable
        id="content-types"
        title="Content-type mix"
        intro="Share of the week's stories by detected content type. Untyped stories count as news; press releases are labelled and excluded from CurrentWire's curated modules, but they count here."
        mix={report.contentTypeMix}
        labelOf={contentTypeLabel}
      />
    </>
  );
}

function PublisherTable({
  id,
  title,
  intro,
  publishers,
  column,
}: {
  id: string;
  title: string;
  intro: ReactNode;
  publishers: PublisherCount[];
  column: string;
}) {
  return (
    <Section id={id} title={title} intro={intro}>
      {publishers.length === 0 ? (
        <p className="text-sm text-muted">Nothing to list this week.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className={TH}>#</th>
                <th className={TH}>Publication</th>
                <th className={`${TH} text-right`}>{column}</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((publisher, index) => (
                <tr key={publisher.name} className="border-b border-rule">
                  <td className={TD_NUM}>{index + 1}</td>
                  <td className={TD}>{publisher.name}</td>
                  <td className={`${TD_NUM} text-right`}>
                    {publisher.stories.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function PublisherSections({ report }: { report: CoverageReport }) {
  return (
    <>
      <PublisherTable
        id="participation"
        title="Publisher participation"
        intro="Publications by the number of distinct stories they appeared on this week."
        publishers={report.publisherParticipation}
        column="Stories joined"
      />
      <PublisherTable
        id="first-observed"
        title="First observed by CurrentWire"
        intro={
          <>
            On stories that at least two publications covered, the publication whose
            report carried the earliest publication time among those CurrentWire
            observed. This is what CurrentWire saw first — it is <em>not</em> a
            claim about who broke the story: feeds lag, and publications CurrentWire
            does not track are invisible to it.
          </>
        }
        publishers={report.publishersFirstObserved}
        column="Stories first observed on"
      />
      <PublisherTable
        id="multi-source"
        title="Publishers on multi-publication stories"
        intro="Publications by how often they appeared on stories covered by two or more independent publications."
        publishers={report.publishersMultiSourceJoins}
        column="Multi-publication stories"
      />
    </>
  );
}

export function WeekOverWeekSection({
  report,
  previousLabel,
}: {
  report: CoverageReport;
  previousLabel: string | null;
}) {
  const wow = report.weekOverWeek;
  if (!wow) return null;
  const previousHref = `/reports/media-coverage/${wow.previousWeekId}`;
  const rows: { label: string; previous: string; current: string; delta: string }[] = [
    {
      label: "Stories archived",
      previous: wow.stories.previous.toLocaleString("en-US"),
      current: wow.stories.current.toLocaleString("en-US"),
      delta: formatDelta(wow.stories.delta),
    },
    {
      label: "Covered by 2+ publications",
      previous: formatPct(wow.multiSourcePct.previous),
      current: formatPct(wow.multiSourcePct.current),
      delta: formatDelta(wow.multiSourcePct.delta, " pts"),
    },
    {
      label: "Median publications per story",
      previous: String(wow.medianIndependent.previous),
      current: String(wow.medianIndependent.current),
      delta: formatDelta(wow.medianIndependent.delta),
    },
    {
      label: "Top category",
      previous: wow.topCategory.previous ? categoryLabel(wow.topCategory.previous) : "—",
      current: wow.topCategory.current ? categoryLabel(wow.topCategory.current) : "—",
      delta:
        wow.topCategory.previous === wow.topCategory.current ? "same" : "changed",
    },
  ];
  return (
    <Section
      id="week-over-week"
      title="Week over week"
      intro={
        <>
          Compared with{" "}
          <Link href={previousHref} className="underline hover:text-brand-ink">
            {previousLabel ?? wow.previousWeekId}
          </Link>
          .
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className={TH}>Measure</th>
              <th className={`${TH} text-right`}>Previous</th>
              <th className={`${TH} text-right`}>This week</th>
              <th className={`${TH} text-right`}>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-rule">
                <td className={TD}>{row.label}</td>
                <td className={`${TD_NUM} text-right`}>{row.previous}</td>
                <td className={`${TD_NUM} text-right`}>{row.current}</td>
                <td className={`${TD_NUM} text-right`}>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** Short, honest definitions — the same paragraph on the index and week pages. */
export function MethodologyNote() {
  return (
    <section id="methodology" aria-labelledby="methodology-heading" className="mt-10 border-t border-rule pt-6">
      <h2 id="methodology-heading" className="headline text-xl">
        How these numbers are made
      </h2>
      <div className="mt-2 max-w-2xl space-y-2 text-sm text-muted">
        <p>
          Every figure is computed from CurrentWire&rsquo;s own story archive. A
          week runs Monday through Sunday on the US-Eastern calendar, and a story
          belongs to the week in which CurrentWire first archived it; stories that
          later merged into another are counted once, under the survivor.
        </p>
        <p>
          <strong>Independent publications</strong> is the number of distinct
          publications CurrentWire has recorded on a story at any point — its
          permanent coverage record, or the highest count recorded in its update
          history, whichever is higher. Publisher feeds rotate a story out of
          their windows within hours, so the count at the most recent refresh is
          often smaller than the count the story actually reached; the report
          uses the higher, permanent figure. It counts only the publications
          CurrentWire tracks, so it is a floor, not a census of the press.
        </p>
        <p>
          <strong>Press releases</strong> are detected, labelled and excluded from
          CurrentWire&rsquo;s curated modules. They are included in the totals and
          the content-type mix here, but not in the most-covered, velocity or
          first-observed tables.
        </p>
        <p>
          <strong>First observed</strong> means the earliest publication time among
          the reports CurrentWire saw on a story. It is not the same as breaking the
          story. See the full{" "}
          <Link href="/methodology" className="underline hover:text-brand-ink">
            methodology
          </Link>{" "}
          and the{" "}
          <Link href="/sources" className="underline hover:text-brand-ink">
            publications CurrentWire tracks
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/** Every report section in reading order; shared by both pages. */
export function CoverageReportBody({
  report,
  previousLabel,
}: {
  report: CoverageReport;
  previousLabel: string | null;
}) {
  return (
    <>
      <HeadlineNumbers report={report} />
      <MostCoveredTable report={report} />
      <VelocitySection report={report} />
      <ConcentrationSection report={report} />
      <MixSections report={report} />
      <PublisherSections report={report} />
      <WeekOverWeekSection report={report} previousLabel={previousLabel} />
      <MethodologyNote />
    </>
  );
}

/**
 * Article JSON-LD for a permanent week report. CurrentWire genuinely authors
 * this analysis (the statistics are its own), so — unlike story pages — the
 * author and publisher are CurrentWire itself. datePublished is the end of
 * the reported week on the US-Eastern calendar: the moment the data froze
 * and the report became available; it is never the render time.
 *
 * Rendered inline because lib/seo/structured-data.tsx does not export its
 * private JsonLd wrapper; the payload shape follows the same conventions.
 */
export function ReportArticleJsonLd({
  headline,
  description,
  path,
  dateISO,
}: {
  headline: string;
  description: string;
  path: string;
  /** YYYY-MM-DD, the week's last day in US-Eastern time. */
  dateISO: string;
}) {
  const url = `${siteConfig.url}${path}`;
  const organization = { "@type": "Organization", name: siteConfig.name, url: siteConfig.url };
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    mainEntityOfPage: url,
    datePublished: dateISO,
    dateModified: dateISO,
    inLanguage: "en",
    author: organization,
    publisher: { ...organization, logo: PUBLISHER_LOGO },
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
