import Link from "next/link";
import type { StoryCluster } from "@/lib/news/types";
import { minutesSince } from "@/lib/utils/time";
import { BreakingLabel, Timestamp } from "./atoms";

/** Never show BREAKING for a story whose newest article is this old. */
const MAX_BREAKING_AGE_MINUTES = 90;

/**
 * Breaking-news banner. Renders only when a cluster genuinely crosses the
 * breaking threshold — never for normal news. Keyboard accessible, no flashing.
 * Stale data can never present as breaking: if the cluster's newest article
 * is older than 90 minutes at render time, the banner is suppressed.
 */
export function BreakingBanner({ cluster }: { cluster: StoryCluster | null }) {
  if (!cluster) return null;
  // NaN (unparseable timestamp) also fails this check and suppresses.
  const isFresh =
    minutesSince(cluster.lastPublishedAt) <= MAX_BREAKING_AGE_MINUTES;
  if (!isFresh) return null;
  return (
    <div className="border-b border-rule bg-surface">
      <Link
        href={`/story/${cluster.slug}`}
        className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-wash sm:px-6"
      >
        <BreakingLabel />
        <span aria-hidden className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
        <span className="headline min-w-0 flex-1 truncate text-[0.9375rem] sm:text-base">
          {cluster.title}
        </span>
        <Timestamp
          iso={cluster.lastPublishedAt}
          className="hidden shrink-0 text-xs font-semibold text-muted sm:block"
        />
      </Link>
    </div>
  );
}
