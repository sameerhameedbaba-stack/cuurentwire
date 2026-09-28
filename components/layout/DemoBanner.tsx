import { getDataMode } from "@/lib/env";
import { IS_STATIC_SITE } from "@/lib/site-mode";

/**
 * Site-wide banner shown whenever mock data is active, so demonstration
 * stories can never be mistaken for real reporting.
 */
export function DemoBanner() {
  // The static site renders no aggregated stories at all — only original
  // articles from content/articles/. Its build has no provider keys, so
  // getDataMode() reports "mock", and without this line the live site would
  // announce "sample stories from fictional outlets" above real journalism.
  if (IS_STATIC_SITE) return null;
  if (getDataMode() !== "mock") return null;
  return (
    <div
      role="note"
      aria-label="Demo data notice"
      className="border-b border-rule bg-ink-deep px-4 py-1.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white dark:bg-wash dark:text-ink"
    >
      Demo data — sample stories from fictional outlets. Configure a news
      provider for live coverage.
    </div>
  );
}
