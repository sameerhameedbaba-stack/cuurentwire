/**
 * Retiring the aggregator's ~16,000 `/story/` URLs.
 *
 * WHY THEY CANNOT SIMPLY STAY
 *
 * Every `/story/` page renders from the database under ISR. That is what blew
 * the Hobby caps (4.8M ISR writes against 200K, 122h CPU against 4h) and paused
 * the site. Relaunching with those pages live re-creates the outage within
 * days, so the old corpus needs a deliberate fate — the strategy has said so
 * since 2026-09-15: "301 or intentional 410, never a lingering 503/404".
 *
 * WHY 410 AND NOT 301
 *
 * A redirect is a promise that the content moved. It did not: the slim
 * relaunch does not republish these stories anywhere, and mass-redirecting
 * them to a category page is a soft-404 that Google treats as a quality
 * signal against the domain. 410 Gone is the honest answer — this was here,
 * we removed it deliberately, stop asking — and it de-indexes faster than 404.
 *
 * WHY NOT ALL OF THEM
 *
 * Measured from `data/gsc-url-signals.json` (28 days to 2026-09-14): of the
 * whole corpus only 383 URLs earned a single impression, and only 15 earned a
 * click. The retention curve at the time of writing:
 *
 *   threshold            URLs kept   impressions retained
 *   >=1 impression             383        1166 / 1166 (100%)
 *   >=2 impressions            209         992 / 1166  (85%)
 *   >=3 impressions            123         820 / 1166  (70%)   <- default
 *   >=5 impressions             62         612 / 1166  (52%)
 *   >=10 impressions            31         425 / 1166  (36%)
 *
 * The default keeps anything with 3+ impressions OR any click at all: ~123
 * URLs, 70% of the surviving search value, and roughly 15,850 URLs retired.
 * A click is kept regardless of impressions because a click is a human
 * finding the page useful, which is worth more than the impression count says.
 *
 * NOTHING HERE DELETES ANYTHING. This module only decides. The decision is
 * applied by the middleware, and the kept set still needs a static snapshot
 * before it can be served without the database — see `docs` in the daily
 * routine. Retiring a URL is effectively irreversible in search, so the
 * switch is deliberate and owner-gated, never a default-on.
 */

/** `[impressions, clicks]` per story id, as stored in data/gsc-url-signals.json. */
export type UrlSignals = Record<string, [number, number] | number[]>;

export interface RetirementPolicy {
  /** Keep a URL with at least this many impressions in the signal window. */
  minImpressions: number;
  /** Keep a URL with at least this many clicks, whatever its impressions. */
  minClicks: number;
}

/**
 * Evidence-based default — see the retention table above. Changing these
 * numbers changes how much of the old corpus survives, so change them with a
 * fresh table, not a hunch.
 */
export const DEFAULT_RETIREMENT_POLICY: RetirementPolicy = {
  minImpressions: 3,
  minClicks: 1,
};

export type RetirementVerdict = "keep" | "retire";

/**
 * Story id from a story slug.
 *
 * Slugs are built as `${slugify(title)}-${id}` (lib/news/clustering/cluster.ts),
 * so the id is the final hyphen-delimited segment. Returns undefined for
 * anything that does not look like one, and an unrecognised shape is treated
 * as retired by `verdictForSlug` — a URL we cannot identify is a URL we cannot
 * show evidence for.
 */
export function storyIdFromSlug(slug: string): string | undefined {
  const match = /-([a-f0-9]{8,})$/i.exec(slug.trim());
  return match?.[1];
}

/** Does this story's search performance justify keeping the URL alive? */
export function verdictForId(
  id: string | undefined,
  signals: UrlSignals,
  policy: RetirementPolicy = DEFAULT_RETIREMENT_POLICY,
): RetirementVerdict {
  if (!id) return "retire";
  const row = signals[id];
  if (!row) return "retire";
  const [impressions = 0, clicks = 0] = row;
  if (clicks >= policy.minClicks) return "keep";
  return impressions >= policy.minImpressions ? "keep" : "retire";
}

/** Same decision, starting from the URL slug. */
export function verdictForSlug(
  slug: string,
  signals: UrlSignals,
  policy: RetirementPolicy = DEFAULT_RETIREMENT_POLICY,
): RetirementVerdict {
  return verdictForId(storyIdFromSlug(slug), signals, policy);
}

export interface RetirementPlan {
  /** Story ids whose URLs stay reachable. */
  keep: string[];
  policy: RetirementPolicy;
  /** How many ids in the signal set were kept vs dropped. */
  keptCount: number;
  droppedCount: number;
  /** Impressions retained by the kept set, and the total in the signal set. */
  impressionsRetained: number;
  impressionsTotal: number;
}

/**
 * Build the keep-list from a signal set.
 *
 * Note what this CANNOT tell you: the signal file only contains stories that
 * earned at least one impression, so `droppedCount` counts dropped stories
 * *within that file*, not the ~15,600 URLs that never registered at all. Those
 * are retired by having no entry, which is the correct outcome and the reason
 * the keep-list is an allowlist rather than a blocklist.
 */
export function planRetirement(
  signals: UrlSignals,
  policy: RetirementPolicy = DEFAULT_RETIREMENT_POLICY,
): RetirementPlan {
  const keep: string[] = [];
  let impressionsRetained = 0;
  let impressionsTotal = 0;

  for (const [id, row] of Object.entries(signals)) {
    const [impressions = 0] = row;
    impressionsTotal += impressions;
    if (verdictForId(id, signals, policy) === "keep") {
      keep.push(id);
      impressionsRetained += impressions;
    }
  }

  return {
    keep: keep.sort(),
    policy,
    keptCount: keep.length,
    droppedCount: Object.keys(signals).length - keep.length,
    impressionsRetained,
    impressionsTotal,
  };
}
