import { ExternalLink } from "lucide-react";
import type { StoryCluster } from "@/lib/news/types";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";
import { Timestamp } from "./atoms";

/**
 * Full coverage list for a clustered story: every publication, its headline,
 * publish time, and an outbound link to the original reporting.
 */
export function CoverageSources({ cluster }: { cluster: StoryCluster }) {
  return (
    <section aria-labelledby="coverage-heading">
      <h2
        id="coverage-heading"
        className="headline border-t-2 border-ink pb-1 pt-3 text-xl dark:border-rule-strong"
      >
        Coverage
      </h2>
      <p className="text-sm text-muted">
        {cluster.sourceCount === 1
          ? "1 publication is covering this story."
          : `${cluster.sourceCount} publications are covering this story.`}
      </p>
      <ul className="mt-4 divide-y divide-rule">
        {cluster.articles.map((article) => (
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
            <Timestamp iso={article.publishedAt} className="mt-1 block text-xs text-muted" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Timeline of coverage built strictly from clustered article timestamps —
 * only rendered when at least three distinct reports exist. No invented events.
 */
export function CoverageTimeline({ cluster }: { cluster: StoryCluster }) {
  if (cluster.articles.length < 3) return null;
  const ordered = [...cluster.articles].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  return (
    <section aria-labelledby="timeline-heading" className="mt-8">
      <h2
        id="timeline-heading"
        className="headline border-t-2 border-ink pb-3 pt-3 text-xl dark:border-rule-strong"
      >
        How coverage developed
      </h2>
      <ol className="relative ml-2 border-l border-rule pl-5">
        {ordered.map((article, index) => (
          <li key={article.id} className="relative pb-4 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full ${
                index === 0 ? "bg-brand" : "bg-rule-strong"
              }`}
            />
            <Timestamp
              iso={article.publishedAt}
              className="text-xs font-bold uppercase tracking-wide text-muted"
            />
            <p className="mt-0.5 text-sm leading-snug">
              {index === 0 ? "First report from " : "Reported by "}
              <span className="font-semibold">{article.source}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
