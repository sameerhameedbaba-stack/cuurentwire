/**
 * Pure evaluation for the Google crawl-freshness monitor
 * (scripts/gsc-crawl-freshness.mjs). Kept separate so the thresholds are
 * unit-testable without an API call — tests/unit/gsc-crawl-freshness.test.ts.
 *
 * What it decides: for every sitemap Search Console holds for the property,
 * how long ago Google last DOWNLOADED it, and whether that gap has crossed
 * the alarm threshold.
 *
 * Why the "last downloaded" clock and not anything the site serves: this
 * repo has probed what the site SERVES for weeks (seo-health.mjs, uptime,
 * url-survival, surface-coherence) and every one of those was green through
 * the entire crawl collapse found on 2026-09-07 — Googlebot's requests went
 * ~15,000/day (Aug 19) to ~9/day, and `news-sitemap.xml` and `sitemap.xml`
 * went unread from Aug 24 to at least Sep 7, with no probe able to see it.
 * A sitemap serving 200 is not a sitemap being read (seo/MEMORY/
 * 2026-08-31-serving-200-is-not-being-read.md). This is the only signal in
 * the free API that reports Google's own behaviour rather than ours.
 */

/** Alarm when Google has not read a submitted sitemap in this long. */
export const MAX_UNREAD_HOURS = 72;

const HOUR_MS = 3_600_000;

function parseTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * One row per sitemap.
 *
 * A sitemap Google has never downloaded is NOT automatically stale: one
 * submitted ten minutes ago has not had a chance yet. The clock starts at
 * `lastDownloaded` when it exists and falls back to `lastSubmitted`, so a
 * never-read sitemap alarms only once the submission itself is older than
 * the threshold. A sitemap with neither timestamp cannot be judged and is
 * reported as `unknown` — never as stale, because an unparseable field is
 * not evidence that Google stopped reading (seo/MEMORY/
 * 2026-08-26-a-vague-error-is-a-hiding-place.md).
 *
 * @param {{ path?: string, lastDownloaded?: string, lastSubmitted?: string }[]} entries
 *   the `sitemap` array from webmasters/v3 sites.sitemaps.list
 * @param {{ now?: number, maxUnreadHours?: number }} [options] `now` is epoch ms
 */
export function evaluateSitemapFreshness(
  entries,
  { now = Date.now(), maxUnreadHours = MAX_UNREAD_HOURS } = {},
) {
  const nowMs = now;
  const rows = (entries ?? []).map((entry) => {
    const path = entry.path ?? "(unnamed)";
    const downloaded = parseTime(entry.lastDownloaded);
    const submitted = parseTime(entry.lastSubmitted);
    const clock = downloaded ?? submitted;
    const ageHours = clock === null ? null : (nowMs - clock) / HOUR_MS;
    return {
      path,
      lastDownloaded: entry.lastDownloaded ?? null,
      lastSubmitted: entry.lastSubmitted ?? null,
      neverRead: downloaded === null,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      status: ageHours === null ? "unknown" : ageHours > maxUnreadHours ? "stale" : "fresh",
    };
  });
  const stale = rows.filter((row) => row.status === "stale");
  return {
    maxUnreadHours,
    checkedAt: new Date(nowMs).toISOString(),
    rows,
    stale,
    // No sitemaps at all is a failure, not a pass: the property is supposed
    // to have three submitted, and an empty list means either they were
    // dropped or the call answered for the wrong property.
    ok: rows.length > 0 && stale.length === 0,
    reason:
      rows.length === 0
        ? "Search Console lists no sitemaps for this property"
        : stale.length === 0
          ? null
          : `${stale.length} of ${rows.length} sitemap(s) unread for more than ${maxUnreadHours}h`,
  };
}

/** Human-readable lines for the workflow log and the alert issue body. */
export function formatFreshnessReport(result) {
  const lines = [
    `Sitemaps in Search Console: ${result.rows.length}. Threshold: ${result.maxUnreadHours}h. Checked ${result.checkedAt}.`,
  ];
  for (const row of result.rows) {
    const age = row.ageHours === null ? "unknown" : `${row.ageHours}h ago`;
    const read = row.neverRead ? "never downloaded" : `downloaded ${age}`;
    const clock = row.neverRead && row.ageHours !== null ? ` (submitted ${row.ageHours}h ago)` : "";
    lines.push(`  ${row.status.toUpperCase().padEnd(7)} ${row.path} — ${read}${clock}`);
  }
  if (result.reason) lines.push(`FAIL: ${result.reason}`);
  return lines.join("\n");
}
