import Link from "next/link";
import type { EarlierCoverageItem } from "@/lib/database/archive";
import type { ArchivedSourceRef } from "@/lib/database/schema";
import {
  corroboratedDetails,
  describeUpdateEvent,
  sourceMix,
} from "@/lib/news/coverage-analysis";
import type { StoryUpdateEvent } from "@/lib/news/story-updates";
import type { StoryCluster } from "@/lib/news/types";
import { Timestamp } from "./atoms";

/**
 * "Automated coverage analysis" — deterministic signals derived from the
 * coverage listed on the page (source mix, recorded update log, all-time
 * coverage, details corroborated by independent sources, earlier archive
 * coverage). Every block is omitted entirely when its input is empty; the
 * whole section disappears when nothing remains. No generated claims.
 */
export function CoverageIntelligence({
  cluster,
  history,
  earlierCoverage,
  allTimeSources = [],
}: {
  cluster: StoryCluster;
  history: StoryUpdateEvent[];
  earlierCoverage: EarlierCoverageItem[];
  /** Permanent source union from the archive — every source ever seen. */
  allTimeSources?: ArchivedSourceRef[];
}) {
  const mix = sourceMix(cluster);
  const details = corroboratedDetails(cluster);
  const events = [...history].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  // Publisher feeds rotate a story out of their windows while it is still
  // the same story, so the coverage list above can be SHORTER than the
  // permanent record. Only worth a block when it actually is. Currently
  // active names are folded in as well, so the all-time list can never omit
  // a publication the page already lists (the stored union is one refresh
  // behind the live cluster).
  const activeNames = new Set(cluster.sourceNames);
  const allTimeNames: string[] = [];
  for (const source of allTimeSources) {
    if (source?.name && !allTimeNames.includes(source.name)) allTimeNames.push(source.name);
  }
  for (const name of activeNames) {
    if (!allTimeNames.includes(name)) allTimeNames.push(name);
  }
  const showAllTime = allTimeNames.length > activeNames.size;

  const mixParts: string[] = [];
  if (mix.independentDomains > 0) {
    mixParts.push(
      `${mix.independentDomains} independent editorial domain${mix.independentDomains === 1 ? "" : "s"}`,
    );
  }
  if (mix.pressReleases > 0) {
    mixParts.push(
      `${mix.pressReleases} press release${mix.pressReleases === 1 ? "" : "s"}`,
    );
  }
  if (mix.opinionOrAnalysis > 0) {
    mixParts.push(
      `${mix.opinionOrAnalysis} opinion/analysis piece${mix.opinionOrAnalysis === 1 ? "" : "s"}`,
    );
  }

  if (
    mixParts.length === 0 &&
    events.length === 0 &&
    details.length === 0 &&
    earlierCoverage.length === 0 &&
    !showAllTime
  ) {
    return null;
  }

  return (
    <section aria-labelledby="coverage-analysis-heading" className="mt-10">
      <h2
        id="coverage-analysis-heading"
        className="headline border-t-2 border-ink pb-1 pt-3 text-xl dark:border-rule-strong"
      >
        Automated coverage analysis
      </h2>
      <p className="text-xs text-faint">
        Generated automatically from the coverage listed on this page.
        CurrentWire adds no editorial claims.
      </p>

      {mixParts.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Source mix
          </h3>
          <p className="mt-1 text-sm">{mixParts.join(" · ")}</p>
        </div>
      ) : null}

      {showAllTime ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            All-time coverage
          </h3>
          {/* "publications", deliberately not the byline's "N sources"
              string, which an external probe parses on this page. */}
          <p className="mt-1 text-sm leading-snug">
            {allTimeNames.length} publications have covered this story since
            CurrentWire first saw it: {allTimeNames.join(", ")}.
          </p>
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Update log
          </h3>
          <ul className="mt-1 divide-y divide-rule">
            {events.map((event, index) => (
              <li
                key={`${event.kind}-${event.version}-${index}`}
                className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm"
              >
                <Timestamp iso={event.at} className="text-xs text-muted" />
                <span>{describeUpdateEvent(event)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {details.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Corroborated details
          </h3>
          <p className="mt-1 text-sm text-muted">
            Details appearing in reports from multiple independent sources:
          </p>
          <ul className="mt-2 space-y-1.5">
            {details.map((detail) => (
              <li key={detail.phrase} className="text-sm leading-snug">
                <span className="font-semibold">“{detail.phrase}”</span>{" "}
                <span className="text-muted">— {detail.sources.join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {earlierCoverage.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            From the CurrentWire archive
          </h3>
          <ul className="mt-1 divide-y divide-rule">
            {earlierCoverage.map((item) => (
              <li key={item.clusterId} className="py-2">
                <Link
                  href={`/story/${item.slug}`}
                  className="story-link font-semibold leading-snug hover:text-brand-ink"
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  <Timestamp iso={item.lastPublishedAt} />
                  {/* "publications", deliberately not the byline's "N sources"
                      string, which an external probe parses on this page. */}
                  {item.sourceCount > 1 ? (
                    <> · covered by {item.sourceCount} publications</>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
