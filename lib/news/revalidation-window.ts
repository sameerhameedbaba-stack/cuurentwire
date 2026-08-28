import type { StoryCluster } from "@/lib/news/types";

/**
 * Which live story pages the cron burst marks for re-render.
 *
 * The cron used to mark `clusters.slice(0, 150)` — the top 150 by ranking
 * score, and only ever those. Measured 2026-08-28: the live dataset holds
 * **726 clusters** (`/api/stats/coverage`), so 576 live story pages (79%)
 * had no freshness mechanism at all. Their ISR entry carries the story
 * route's 30-day TTL, and the archive read they may have rendered from is
 * not tagged, so `revalidateTag(NEWS_CACHE_TAG)` never reaches them either.
 *
 * That is the mechanism behind `[auto-alert]` issue #2 (surface coherence,
 * seo/BACKLOG.md item 3): a story page renders from the ARCHIVE during the
 * window in which its cluster is not yet in the live snapshot, and then
 * nothing ever re-renders it. The list surfaces move on; the story page
 * keeps serving the archived copy, with `dateModified` frozen and
 * `isBasedOn` under-reporting the publications that have since picked the
 * story up. Reproduced 2026-08-28 on two clusters, both listed live on `/`
 * while their own page stamped `cw-dataset-version: archive:…`.
 *
 * The fix keeps the COST BOUND EXACTLY WHERE IT WAS — `MAX` marks per
 * burst, unchanged — and spends it better: a fixed head that is always
 * marked, plus a rotating slice of the tail. Raising MAX instead would add
 * billed ISR writes on the long tail, which is the constraint the playbook
 * protects after the 2026-08-24 Hobby-tier outage.
 *
 * Coverage arithmetic at the measured 726 clusters and ~2 bursts/hour:
 * the tail is 626 URLs, 50 per burst, so every live story page is
 * re-rendered within 13 bursts ≈ 6.5 hours, against never before.
 */
const MAX = 150;

/** Always marked: the ranked head is what readers and Google News see. */
const HEAD = 100;

/** Marks left over for the tail — the rotating window. */
const ROTATION = MAX - HEAD;

/**
 * The burst cadence the cursor counts in. The rotation only has to be
 * stable across a burst and to advance between bursts; deriving it from the
 * clock keeps the cron stateless (it is serverless — there is nowhere to
 * keep a cursor between invocations) and makes the selection a pure
 * function of `now`, so tests can sweep a whole cycle.
 */
const BURST_INTERVAL_MS = 30 * 60_000;

export const REVALIDATION_WINDOW = { MAX, HEAD, ROTATION, BURST_INTERVAL_MS };

/**
 * Story slugs this burst should mark, given the ranked live clusters.
 *
 * Never more than MAX, never duplicated, and every cluster in the input is
 * returned within `ceil(tail / ROTATION)` consecutive bursts.
 */
export function selectRevalidationSlugs(
  clusters: readonly StoryCluster[],
  now: Date = new Date(),
): string[] {
  const live = clusters.filter((c) => !c.isMock);
  if (live.length <= MAX) return live.map((c) => c.slug);

  const head = live.slice(0, HEAD);
  const tail = live.slice(HEAD);
  const slices = Math.ceil(tail.length / ROTATION);
  // A negative or non-finite clock must never produce a negative index —
  // fall back to slice 0 rather than throwing inside the cron.
  const ticks = Math.floor(now.getTime() / BURST_INTERVAL_MS);
  const cursor = Number.isFinite(ticks) ? ((ticks % slices) + slices) % slices : 0;
  const start = cursor * ROTATION;

  return [...head, ...tail.slice(start, start + ROTATION)].map((c) => c.slug);
}
