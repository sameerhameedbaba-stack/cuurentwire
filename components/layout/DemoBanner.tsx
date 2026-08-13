import { getDataMode } from "@/lib/env";

/**
 * Site-wide banner shown whenever mock data is active, so demonstration
 * stories can never be mistaken for real reporting.
 */
export function DemoBanner() {
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
