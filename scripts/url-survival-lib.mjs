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
 * @param {{results: Array<{url:string, ok:boolean, status:number}>,
 *          ledger: Map<string,{lastOk?:string|null, firstSeen?:string|null}>,
 *          nowMs?: number}} input
 */
export function classifyResults({ results, ledger, nowMs = Date.now() }) {
  const gone = results.filter((r) => !r.ok && r.status >= 400 && r.status < 500);
  const failed = results.filter(
    (r) => !r.ok && (r.status === 0 || r.status >= 500),
  );
  const redirects = results.filter((r) => r.ok && r.status !== 200);

  const healthyShare =
    (results.length - failed.length - gone.length) / (results.length || 1);
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

  return { gone, unavailable, lost, redirects, runIsHealthy, healthyShare };
}
