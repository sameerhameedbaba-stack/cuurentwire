/**
 * Analytics abstraction. The application never depends on a specific vendor:
 * events funnel through `track`, and providers are registered here.
 *
 * No provider is enabled by default — with none registered, tracking is a
 * no-op and nothing is collected, matching the privacy page. To add one,
 * implement AnalyticsProvider and push it in `activeAnalyticsProviders`.
 */

export type AnalyticsEvent =
  | { name: "story_opened"; storyId: string; category: string }
  | { name: "outbound_publisher_click"; source: string; storyId: string }
  | { name: "search"; queryLength: number }
  | { name: "category_filter"; category: string }
  | { name: "top100_filter"; country: string; category: string; time: string }
  | { name: "coverage_expanded"; storyId: string };

export interface AnalyticsProvider {
  name: string;
  track(event: AnalyticsEvent): void;
}

const activeAnalyticsProviders: AnalyticsProvider[] = [
  // e.g. plausibleProvider, when configured via NEXT_PUBLIC_ANALYTICS_ID
];

/** Fire an event to every registered provider. Safe to call anywhere. */
export function track(event: AnalyticsEvent): void {
  for (const provider of activeAnalyticsProviders) {
    try {
      provider.track(event);
    } catch {
      // Analytics must never break the reading experience.
    }
  }
}
