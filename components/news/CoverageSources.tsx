import { ExternalLink } from "lucide-react";
import { describeUpdateEvent } from "@/lib/news/coverage-analysis";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";
import { coverageExcerpt } from "@/lib/news/story-context";
import { displayableUpdates, type StoryUpdateEvent } from "@/lib/news/story-updates";
import type { Article, StoryCluster } from "@/lib/news/types";
import { Timestamp } from "./atoms";

/**
 * Full coverage list for a clustered story: every publication, its headline,
 * a short attributed excerpt of the summary that publisher distributes with
 * its own feed, publish time, and an outbound link to the original reporting.
 */
export function CoverageSources({ cluster }: { cluster: StoryCluster }) {
  // Derived from the rendered list itself, NEVER cluster.sourceCount: the
  // list shows every all-time report while sourceCount tracks the active
  // feed window, and the two drift apart (live: "8 reports from 1 source"
  // directly above a list naming 6 outlets). "publications", deliberately
  // not the byline's "N sources" string, which the production probe
  // scripts/surface-coherence.mjs regex-anchors on story pages.
  const publicationCount = new Set(cluster.articles.map((a) => a.source)).size;
  // The lead's description IS the dek at the top of the page (clustering:
  // `summary: lead.description`), so coverageExcerpt drops it — on a
  // one-article story nothing here renders, by design.
  const hasExcerpts = cluster.articles.some(
    (article) => coverageExcerpt(article.description, cluster.summary) !== undefined,
  );
  return (
    <section aria-labelledby="coverage-heading">
      <h2
        id="coverage-heading"
        className="headline border-t-2 border-ink pb-1 pt-3 text-xl dark:border-rule-strong"
      >
        Coverage
      </h2>
      {/* Count coherence: the list below renders one entry per REPORT, so
          when reports outnumber distinct publications the header states
          both — every stated number matches what the reader can count. */}
      <p className="text-sm text-muted">
        {cluster.articles.length !== publicationCount
          ? `${cluster.articles.length} reports from ${publicationCount} publication${publicationCount === 1 ? "" : "s"}.`
          : publicationCount === 1
            ? "1 publication is covering this story."
            : `${publicationCount} publications are covering this story.`}
      </p>
      {hasExcerpts ? (
        <p className="mt-1 text-xs text-faint">
          Excerpts are the summaries each publisher distributes with its own
          feed, shortened and attributed.
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-rule">
        {cluster.articles.map((article) => {
          const excerpt = coverageExcerpt(article.description, cluster.summary);
          return (
            <li key={article.id} className="py-3">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                {article.source}
                <span className="ml-2 rounded-news border border-rule px-1 py-px text-[0.625rem] font-semibold tracking-wider text-faint">
                  Tier {article.sourceTier}
                </span>
              </p>
              {isSafeExternalUrl(article.url) ? (
                <a
                  href={article.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="group mt-1 inline-flex items-start gap-1.5 font-semibold leading-snug hover:text-brand-ink"
                >
                  <span className="story-link">{article.title}</span>
                  <ExternalLink
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-muted group-hover:text-brand-ink"
                    aria-hidden
                  />
                  <span className="sr-only">(opens original report in a new tab)</span>
                </a>
              ) : (
                <p className="mt-1 font-semibold leading-snug">{article.title}</p>
              )}
              {excerpt ? (
                <p className="mt-1 text-sm leading-snug text-muted">
                  {excerpt} <span className="text-faint">— {article.source}</span>
                </p>
              ) : null}
              <Timestamp iso={article.publishedAt} className="mt-1 block text-xs text-muted" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type TimelineEntry =
  | { type: "report"; at: string; article: Article }
  | { type: "update"; at: string; event: StoryUpdateEvent };

/**
 * Timeline of coverage built strictly from clustered article timestamps and
 * recorded story-update events, interleaved chronologically — rendered when
 * at least two ENTRIES exist, counting reports and displayable updates
 * together. The old gate counted member articles only, which hid an already
 * recorded timeline on every one-article story (95.8% of the news sitemap,
 * censused 2026-08-19). No invented events: publish entries come from member
 * articles, update entries from the persisted update log, churn-filtered for
 * display by displayableUpdates (net-zero coverage oscillation and ops-only
 * reclassifications never render). This timeline is the ONE place update
 * events appear on a story page.
 */
export function CoverageTimeline({
  cluster,
  history = [],
}: {
  cluster: StoryCluster;
  history?: StoryUpdateEvent[];
}) {
  const entries: TimelineEntry[] = [
    ...cluster.articles.map((article) => ({
      type: "report" as const,
      at: article.publishedAt,
      article,
    })),
    ...displayableUpdates(history).map((event) => ({
      type: "update" as const,
      at: event.at,
      event,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  // A one-entry "timeline" is not a timeline.
  if (entries.length < 2) return null;
  const firstReportIndex = entries.findIndex((e) => e.type === "report");
  return (
    <section aria-labelledby="timeline-heading" className="mt-8">
      <h2
        id="timeline-heading"
        className="headline border-t-2 border-ink pb-3 pt-3 text-xl dark:border-rule-strong"
      >
        How coverage developed
      </h2>
      <ol className="relative ml-2 border-l border-rule pl-5">
        {entries.map((entry, index) => (
          <li
            key={entry.type === "report" ? entry.article.id : `update-${entry.at}-${index}`}
            className="relative pb-4 last:pb-0"
          >
            <span
              aria-hidden
              className={`absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full ${
                entry.type === "update"
                  ? "border border-rule-strong bg-transparent"
                  : index === firstReportIndex
                    ? "bg-brand"
                    : "bg-rule-strong"
              }`}
            />
            <Timestamp
              iso={entry.at}
              className="text-xs font-bold uppercase tracking-wide text-muted"
            />
            {entry.type === "report" ? (
              <p className="mt-0.5 text-sm leading-snug">
                {index === firstReportIndex ? "First report from " : "Reported by "}
                <span className="font-semibold">{entry.article.source}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm leading-snug">
                <span className="mr-1.5 rounded-news border border-rule px-1 py-px text-[0.625rem] font-bold uppercase tracking-wider text-faint">
                  Story update
                </span>
                {describeUpdateEvent(entry.event)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
