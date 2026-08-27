/**
 * Failure classification for the published-URL survival probe.
 *
 * Split out of url-survival.mjs (which is a top-level-await script and
 * therefore cannot be imported by a test) so the three-way decision has a
 * guard — same pattern as gsc-report-lib.mjs.
 *
 * The invariant the probe defends is "a published URL never 404s". Three
 * distinct things can go wrong, and conflating any two of them breaks the
 * gate in a way that gets it ignored:
 *
 *   GONE        4xx. The guarantee is broken. Always fails the build.
 *   UNAVAILABLE 5xx/network, recently alive. The origin is having a bad day.
 *               Retriable, crawlers come back. Fails the build.
 *   LOST        5xx, and not seen alive for LOST_AFTER_DAYS. The content is
 *               permanently unresolvable. Reported every run; does NOT fail
 *               the build, because a condition that will never clear keeps a
 *               gate red forever and a permanently red gate stops being read.
 *   TOMBSTONED  4xx for a cluster id listed in data/lost-stories.json. The
 *               404 is the site's own deliberate answer for content that no
 *               longer exists anywhere (2026-08-25: 205 outage-lost stories
 *               were tombstoned because the retriable 500 they used to serve
 *               was poisoning crawl health). Reported every run; does NOT
 *               fail the build — for the same reason LOST does not. Only ids
 *               written into that file qualify, so nothing can launder itself
 *               into this state: adding one is a reviewed commit.
 *
 * See the long note in url-survival.mjs for the incident that produced the
 * LOST state (214 URLs published during the 2026-08-20 archive outage that
 * were never written to the archive).
 */

/** A 5xx must be this stale before it may be called lost rather than down. */
export const LOST_AFTER_DAYS = 3;
/**
 * Share of checked URLs that must be answering before ANY straggler may be
 * reclassified as lost. During a real outage almost everything is 5xx, the
 * share collapses, and every failure stays UNAVAILABLE — so a site-wide
 * outage can never be laundered into "those pages were lost anyway".
 */
export const RUN_HEALTHY_SHARE = 0.9;

/**
 * Trailing cluster-id token of a /story/<slug> URL ("c" + 12 hex), or null
 * when the URL is not a story URL in that shape. Mirrors idTokenFromSlug()
 * in lib/database/archive.ts, which is TypeScript and cannot be imported
 * here.
 */
export function clusterIdFromStoryUrl(url) {
  const match = /\/story\/[^/?#]*-(c[0-9a-f]{12})(?:[/?#]|$)/.exec(url);
  return match ? match[1] : null;
}

/**
 * @param {{results: Array<{url:string, ok:boolean, status:number}>,
 *          ledger: Map<string,{lastOk?:string|null, firstSeen?:string|null}>,
 *          nowMs?: number,
 *          tombstonedIds?: Set<string>|ReadonlySet<string>}} input
 */
export function classifyResults({
  results,
  ledger,
  nowMs = Date.now(),
  tombstonedIds = new Set(),
}) {
  const clientErrors = results.filter(
    (r) => !r.ok && r.status >= 400 && r.status < 500,
  );
  const tombstoned = clientErrors.filter((r) => {
    const id = clusterIdFromStoryUrl(r.url);
    return id !== null && tombstonedIds.has(id);
  });
  const tombstonedUrls = new Set(tombstoned.map((r) => r.url));
  const gone = clientErrors.filter((r) => !tombstonedUrls.has(r.url));
  const failed = results.filter(
    (r) => !r.ok && (r.status === 0 || r.status >= 500),
  );
  const redirects = results.filter((r) => r.ok && r.status !== 200);

  // Tombstoned URLs leave the health share entirely — numerator AND
  // denominator. This share answers one question: "is the origin broadly
  // answering right now?", and a deliberate permanent 404 is the origin
  // answering exactly as designed. Counting them as sick would let a large
  // tombstone list drag a healthy run below RUN_HEALTHY_SHARE and suspend
  // the LOST classification for unrelated 5xx.
  const considered = results.length - tombstoned.length;
  const healthyShare =
    (considered - failed.length - gone.length) / (considered || 1);
  const runIsHealthy = healthyShare >= RUN_HEALTHY_SHARE;
  const lostCutoff = nowMs - LOST_AFTER_DAYS * 86_400_000;

  const lastAliveAt = (url) => {
    const entry = ledger.get(url);
    // firstSeen is the fallback for a URL that has never once answered 200:
    // it still dates the moment the site began advertising it.
    const stamp = entry?.lastOk ?? entry?.firstSeen ?? null;
    const time = stamp ? new Date(stamp).getTime() : Number.NaN;
    return Number.isNaN(time) ? null : time;
  };

  const lost = runIsHealthy
    ? failed.filter((r) => {
        const alive = lastAliveAt(r.url);
        return alive !== null && alive < lostCutoff;
      })
    : [];
  const lostUrls = new Set(lost.map((r) => r.url));
  const unavailable = failed.filter((r) => !lostUrls.has(r.url));

  return {
    gone,
    unavailable,
    lost,
    tombstoned,
    redirects,
    runIsHealthy,
    healthyShare,
  };
}
