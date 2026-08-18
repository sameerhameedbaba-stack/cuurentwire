/**
 * Analytics abstraction. The application never depends on a specific vendor:
 * events funnel through `track`, and providers are registered here.
 *
 * Providers register only when their configuration is present — with none
 * registered, tracking is a no-op and nothing is collected, matching the
 * privacy page. To add one, implement AnalyticsProvider and push it in
 * `activeAnalyticsProviders`.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

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

/**
 * Forwards events to Google Analytics 4 as custom events. gtag is loaded by
 * components/layout/GoogleAnalytics.tsx; if the script is blocked or still
 * loading, events silently drop — analytics never gates functionality.
 */
const googleAnalyticsProvider: AnalyticsProvider = {
  name: "ga4",
  track(event) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }
    const { name, ...params } = event;
    window.gtag("event", name, params);
  },
};

const activeAnalyticsProviders: AnalyticsProvider[] = process.env
  .NEXT_PUBLIC_GA_MEASUREMENT_ID
  ? [googleAnalyticsProvider]
  : [];

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
