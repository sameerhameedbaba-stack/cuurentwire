import { env } from "@/lib/env";
import { minutesSince, relativeTime } from "@/lib/utils/time";

/** "Last updated 4 minutes ago" freshness indicator for feed pages. */
export function LastUpdated({ generatedAt }: { generatedAt: string }) {
  // Older than 3x the RSS cadence means refreshes are not landing — say so
  // plainly instead of quietly showing an ever-older timestamp.
  const delayed = minutesSince(generatedAt) > 3 * env.rssRefreshMinutes;

  return (
    <p className="text-xs text-muted" suppressHydrationWarning>
      Last updated {relativeTime(generatedAt).replace("Just now", "moments ago")}
      {delayed && (
        <span className="ml-2">News updates are temporarily delayed.</span>
      )}
    </p>
  );
}
