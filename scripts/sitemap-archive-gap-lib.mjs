/**
 * Pure evaluator for the SITEMAP-TO-ARCHIVE GAP — the window in which a story
 * is advertised to crawlers but has no permanent archive row yet.
 *
 * WHY THIS EXISTS (measured 2026-09-11, seo/BACKLOG.md top of board).
 * On 2026-09-09 four /story/ URLs served a permanent 500 for at least 11 h
 * with nothing down. They carried `lastOk: null` — advertised in a sitemap and
 * never once answering 200. The cause was never established, and the reason it
 * could not be was that nothing recorded WHEN a cluster is first advertised
 * versus WHEN its archive row lands. That gap was invisible between two daily
 * probe runs.
 *
 * THE SURFACE, MEASURED. The two sitemaps behave differently and only one can
 * carry an unarchived story:
 *
 *   news-sitemap.xml  gated on archive standing since 2515c55 (2026-08-24).
 *                     0 of 739 advertised ids lacked an archive row.
 *   sitemap.xml       `force-dynamic` over `dataset.clusters.slice(0, 200)`
 *                     (app/sitemap.ts) — the LIVE dataset, with no archive
 *                     gate. 19 of 200 advertised ids lacked an archive row,
 *                     every one of them 0.0-0.3 h old and answering 200.
 *
 * So the 19 are not a defect: they are the normal persist window. Writes are
 * batched to `PERSIST_MIN_INTERVAL_MS` = 25 min with a cold window reaching
 * minute 15 of each 30 (lib/database/persist-gate.ts), so a brand-new story is
 * EXPECTED to be advertised before it is archived.
 *
 * WHAT IS A DEFECT is one of those entries never getting its row. A story that
 * leaves the live dataset before the burst writes it is then neither live nor
 * archived, and lib/news/story-resolution.ts answers its deliberate retriable
 * 500 forever, because that shield has no clock in it
 * (seo/MEMORY/2026-09-09-a-window-shield-with-no-expiry-is-permanent.md).
 *
 * This module therefore classifies every advertised story into one of three
 * states and names the one that matters:
 *
 *   archived  the archive holds a row — nothing to watch.
 *   pending   no row yet, but younger than the grace window — normal.
 *   overdue   no row and OLDER than the grace window — an orphan candidate,
 *             i.e. a URL on its way to a permanent 500.
 *
 * IT IS AN INSTRUMENT, NOT A GATE. A high `overdue` count never fails the run,
 * for the same reason general-orphan-lib.mjs never fails on a high rate: the
 * threshold below is a judgement about a batching cadence, not a contract, and
 * a monitor that cries wolf gets muted. Exit 1 belongs to "could not MEASURE".
 */

/**
 * Every published story slug ends with its own cluster id (the verified
 * property archiveRowCacheKey and the Bluesky dedup ledger both rest on).
 */
export const CLUSTER_ID_RE = /-(c[0-9a-f]{12})$/;

/**
 * How long a story may be advertised without an archive row before it counts
 * as overdue. PERSIST_MIN_INTERVAL_MS is 25 min and the cold window reaches
 * minute 15 of each 30, so the true worst case is ~45 min. 90 minutes is twice
 * that: comfortably outside anything the batching can explain, and still far
 * inside the 11 h the 2026-09-09 orphans went unnoticed.
 */
export const GRACE_MS = 90 * 60_000;

/** Keep two months of rows; the series is for trend, not forensics. */
export const HISTORY_CAP = 60;

/** Cluster id from a story URL, or null when the slug carries no id token. */
export function storyIdFrom(loc) {
  const match = CLUSTER_ID_RE.exec(String(loc ?? "").trim());
  return match ? match[1] : null;
}

/**
 * Parse the <url> blocks of a sitemap into story entries.
 *
 * `publication_date` (news sitemaps) is preferred over `lastmod` as the
 * advertised-since timestamp: the 2026-08-27 incident established that
 * publication_date IS the archive's `first_seen_at`, whereas a `lastmod` is a
 * MODIFICATION date — the same confusion that produced two wrong sharding
 * deadlines from per-day lastmod counts.
 */
export function advertisedStories(xml, surface) {
  const out = [];
  for (const block of String(xml ?? "").matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    const loc = (/<loc>([^<]+)<\/loc>/.exec(body) ?? [])[1];
    if (!loc) continue;
    const id = storyIdFrom(loc);
    if (!id) continue;
    const published = (/<news:publication_date>([^<]+)</.exec(body) ?? [])[1];
    const lastmod = (/<lastmod>([^<]+)</.exec(body) ?? [])[1];
    out.push({
      id,
      loc: loc.trim(),
      surface,
      advertisedSince: (published ?? lastmod ?? "").trim() || null,
    });
  }
  return out;
}

/**
 * Merge entries from several sitemaps, keyed by cluster id. A story listed in
 * both keeps the EARLIEST advertised-since across surfaces, because the
 * question is how long crawlers have been able to see it at all, and records
 * every surface that carries it.
 */
export function mergeAdvertised(...groups) {
  const byId = new Map();
  for (const entry of groups.flat()) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, { ...entry, surfaces: [entry.surface] });
      continue;
    }
    if (!existing.surfaces.includes(entry.surface)) existing.surfaces.push(entry.surface);
    const a = Date.parse(existing.advertisedSince ?? "");
    const b = Date.parse(entry.advertisedSince ?? "");
    if (Number.isFinite(b) && (!Number.isFinite(a) || b < a)) {
      existing.advertisedSince = entry.advertisedSince;
      existing.loc = entry.loc;
    }
  }
  return [...byId.values()];
}

/**
 * Classify advertised stories against the set of ids the archive holds.
 *
 * An entry whose advertisedSince cannot be parsed is `pending`, never
 * `overdue`: an unreadable timestamp is missing information, and reporting it
 * as a defect is how `unknown` gets laundered into `stale` — the exact bug the
 * crawl-freshness evaluator was written to avoid.
 */
export function classifyGap(entries, archivedIds, now = new Date(), graceMs = GRACE_MS) {
  const held = archivedIds instanceof Set ? archivedIds : new Set(archivedIds ?? []);
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const buckets = { archived: [], pending: [], overdue: [], undated: [] };

  for (const entry of entries) {
    if (held.has(entry.id)) {
      buckets.archived.push(entry);
      continue;
    }
    const since = Date.parse(entry.advertisedSince ?? "");
    if (!Number.isFinite(since)) {
      buckets.undated.push(entry);
      buckets.pending.push(entry);
      continue;
    }
    const ageMs = at - since;
    const row = { ...entry, ageMinutes: Math.round((ageMs / 60_000) * 10) / 10 };
    (ageMs > graceMs ? buckets.overdue : buckets.pending).push(row);
  }

  buckets.overdue.sort((a, b) => (b.ageMinutes ?? 0) - (a.ageMinutes ?? 0));

  const bySurface = {};
  for (const entry of entries) {
    for (const surface of entry.surfaces ?? [entry.surface]) {
      bySurface[surface] ??= { advertised: 0, unarchived: 0 };
      bySurface[surface].advertised += 1;
      if (!held.has(entry.id)) bySurface[surface].unarchived += 1;
    }
  }

  return {
    measuredAt: new Date(at).toISOString(),
    graceMinutes: Math.round(graceMs / 60_000),
    advertised: entries.length,
    archived: buckets.archived.length,
    pending: buckets.pending.length,
    overdue: buckets.overdue.length,
    undated: buckets.undated.length,
    bySurface,
    overdueEntries: buckets.overdue.map((entry) => ({
      id: entry.id,
      loc: entry.loc,
      surfaces: entry.surfaces ?? [entry.surface],
      advertisedSince: entry.advertisedSince,
      ageMinutes: entry.ageMinutes,
    })),
  };
}

/** Append a summary as a history row, newest last, capped. */
export function appendHistory(history, summary, cap = HISTORY_CAP) {
  const rows = Array.isArray(history) ? [...history] : [];
  rows.push({
    measuredAt: summary.measuredAt,
    graceMinutes: summary.graceMinutes,
    advertised: summary.advertised,
    archived: summary.archived,
    pending: summary.pending,
    overdue: summary.overdue,
    undated: summary.undated,
    bySurface: summary.bySurface,
    overdueIds: summary.overdueEntries.map((entry) => entry.id),
  });
  return rows.slice(-cap);
}

/** Human-readable report. Says what the numbers MEAN, not just what they are. */
export function formatGapReport(summary) {
  const lines = [
    `Sitemap-to-archive gap — ${summary.measuredAt}`,
    `  advertised story URLs : ${summary.advertised}`,
    `  with an archive row   : ${summary.archived}`,
    `  pending (< ${summary.graceMinutes}m)    : ${summary.pending}` +
      (summary.undated ? ` (${summary.undated} with no readable timestamp)` : ""),
    `  OVERDUE (> ${summary.graceMinutes}m)    : ${summary.overdue}`,
  ];
  for (const [surface, counts] of Object.entries(summary.bySurface).sort()) {
    lines.push(`    ${surface}: ${counts.advertised} advertised, ${counts.unarchived} unarchived`);
  }
  if (summary.overdue === 0) {
    lines.push(
      "  No orphan candidates: every advertised story is archived or still inside the persist window.",
    );
  } else {
    lines.push(
      "  ORPHAN CANDIDATES — advertised well past the batched-write window with no archive row.",
      "  If one of these leaves the live dataset it becomes a permanent 500 (story-resolution's",
      "  unavailable shield has no expiry). Check each, and tombstone only what is truly lost.",
    );
    for (const entry of summary.overdueEntries) {
      lines.push(
        `    ${entry.id}  ${entry.ageMinutes}m  [${entry.surfaces.join(",")}]  ${entry.loc}`,
      );
    }
  }
  return lines.join("\n");
}
