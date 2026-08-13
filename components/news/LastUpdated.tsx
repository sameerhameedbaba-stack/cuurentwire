import { relativeTime } from "@/lib/utils/time";

/** "Last updated 4 minutes ago" freshness indicator for feed pages. */
export function LastUpdated({ generatedAt }: { generatedAt: string }) {
  return (
    <p className="text-xs text-muted" suppressHydrationWarning>
      Last updated {relativeTime(generatedAt).replace("Just now", "moments ago")}
    </p>
  );
}
