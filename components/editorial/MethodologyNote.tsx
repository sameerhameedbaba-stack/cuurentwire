import Link from "next/link";
import { IS_STATIC_SITE } from "@/lib/site-mode";

/**
 * Shown at the top of the methodology pages on the static site.
 *
 * The signals these pages document — grouping reports of one event, publisher
 * tiers, coverage breadth, the 0–100 score — are still exactly what the
 * selection gate runs on (lib/editorial/selection.ts ranks by rankingScore;
 * eligibility counts independent publications). What changed is what they
 * produce: not a public ranked list, but the choice of which stories get an
 * original article. Saying so up front keeps the rest of each page true.
 */
export function MethodologyNote() {
  if (!IS_STATIC_SITE) return null;
  return (
    <p className="rounded border border-rule bg-surface-2 p-4 text-sm">
      <strong>How this applies today.</strong> CurrentWire no longer publishes a
      ranked list of aggregated stories — that was retired in September 2026.
      The signals below now decide which stories are worth an original article:
      reports of one event are grouped, stories need at least two independent
      publications, and the highest-scoring eligible stories are written up
      first. See the{" "}
      <Link href="/editorial-standards">editorial standards</Link> for the full
      sourcing rules.
    </p>
  );
}
