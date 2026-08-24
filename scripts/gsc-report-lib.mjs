/**
 * Pure helpers for scripts/gsc-report.mjs (URL classification, bucket
 * aggregation, the story-date ledger merge, the KPIs, the per-URL signals
 * file and the markdown output). No I/O, no network, no environment reads:
 * every function is deterministic given its arguments (dates are passed in),
 * so tests/unit/gsc-report-lib.test.ts can exercise the report logic without
 * a Search Console service account. The script imports everything from here;
 * keep side effects (fetch, fs, process) in gsc-report.mjs.
 */

// ── Tunables ────────────────────────────────────────────────────────────────
/** Page+date window for the early-discovery KPI. */
export const EARLY_WINDOW_DAYS = 14;
/** GSC publishes a day's data 2–3 days later; younger stories cannot be judged. */
export const MIN_STORY_AGE_HOURS = 72;
/** Story-date ledger: plenty for a 14-day KPI window at ~400 stories/day. */
export const LEDGER_MAX_AGE_DAYS = 45;
export const LEDGER_CAP = 20_000;
/**
 * Minimum-sample rule. A template or publication-count bucket with fewer
 * impressions than this over the 28-day window is flagged
 * `sufficientSample: false` and printed as "early" — its CTR, average
 * position and per-URL rates are noise at that volume (a handful of
 * impressions swing CTR by whole percentage points) and must not be read
 * as one template outperforming another. The value is recorded in the
 * report JSON as minSampleImpressions so readers of old reports know which
 * threshold applied.
 */
export const MIN_SAMPLE_IMPRESSIONS = 100;
/** data/gsc-url-signals.json: keep at most this many stories, highest impressions first. */
export const SIGNALS_CAP = 20_000;
/** data/gsc-url-signals.json: a story needs at least this many web+news impressions to be listed. */
export const SIGNALS_MIN_IMPRESSIONS = 1;
/** Surfaces summed into data/gsc-url-signals.json. */
export const SIGNALS_SURFACES = ["web", "news"];
/** Story ids per /api/stats/archive-sources?ids= request (the endpoint allows up to 500). */
export const ARCHIVE_IDS_PER_REQUEST = 200;

export const SECTIONS = new Set([
  "politics", "business", "technology", "world", "climate",
  "health", "science", "culture", "sports",
]);
export const HUBS = new Set([
  "ai", "elections", "immigration", "courts", "crime", "education", "housing",
  "jobs", "money", "weather", "energy", "space", "autos", "travel", "obituaries",
]);
export const TEMPLATE_ORDER = [
  "home", "story", "top-10", "top-100", "briefing", "topic", "source", "reports",
  "archive", "section", "hub", "most-covered", "latest", "country", "index", "other",
];
/** Publication-count buckets, in print order. Cumulative rows overlap the exact ones on purpose. */
export const SOURCE_COUNT_BUCKETS = ["1", "2", "3", "4+", "2+", "3+", "unknown"];

// ── Dates ───────────────────────────────────────────────────────────────────
export function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(days, from = new Date()) {
  return new Date(from.getTime() - days * 86_400_000);
}

// ── URL → template classification ───────────────────────────────────────────
export function pathnameOf(pageUrl) {
  try {
    const pathname = new URL(pageUrl).pathname;
    return pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  } catch {
    return "/__unparseable__";
  }
}

export function classifyPath(pathname) {
  if (pathname === "/") return "home";
  const first = pathname.split("/")[1] ?? "";
  if (first === "story") return "story";
  if (first === "top-10") return "top-10";
  if (first === "top-100") return "top-100";
  if (first === "briefing") return "briefing";
  if (first === "topic") return "topic";
  if (first === "source") return "source";
  if (first === "reports") return "reports";
  if (first === "archive") return "archive";
  if (first === "most-covered") return "most-covered";
  if (first === "latest") return "latest";
  if (first === "us" || first === "canada") return "country";
  if (first === "topics" || first === "sources" || first === "search") return "index";
  // Sections and hubs are single-segment paths; deeper paths under them
  // (e.g. /politics/page/2 if it ever exists) still belong to the template.
  if (SECTIONS.has(first)) return "section";
  if (HUBS.has(first)) return "hub";
  return "other";
}

/**
 * Trailing cluster id of a /story/<slug>-<id> path, or null. Cluster ids are
 * "c" + 12 hex (lib/news/clustering/cluster.ts; live example
 * …-cc5823ef92e20) and survive headline re-slugging, so they are the join
 * key between GSC page URLs, the sitemap, /api/stats/coverage and
 * /api/stats/archive-sources.
 */
export function storyIdOf(pathname) {
  if (!pathname.startsWith("/story/")) return null;
  const match = pathname.match(/-(c[0-9a-f]{12})$/);
  return match ? match[1] : null;
}

/** Cluster id of a GSC page row (keys[0] is the page URL), or null. */
export function storyIdOfRow(row) {
  const pageUrl = row?.keys?.[0];
  return pageUrl ? storyIdOf(pathnameOf(pageUrl)) : null;
}

// ── Aggregation ─────────────────────────────────────────────────────────────
export function newBucket() {
  return { urls: new Set(), impressions: 0, clicks: 0, positionWeight: 0 };
}

export function addRow(bucket, pageUrl, row) {
  bucket.urls.add(pageUrl);
  bucket.impressions += row.impressions ?? 0;
  bucket.clicks += row.clicks ?? 0;
  // Impression-weighted, like GSC's own average position over a group.
  bucket.positionWeight += (row.position ?? 0) * (row.impressions ?? 0);
}

export function finishBucket(bucket, minSampleImpressions = MIN_SAMPLE_IMPRESSIONS) {
  const urls = bucket.urls.size;
  const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
  return {
    urls,
    impressions: bucket.impressions,
    clicks: bucket.clicks,
    ctr: bucket.impressions ? round(bucket.clicks / bucket.impressions, 4) : 0,
    avgPosition: bucket.impressions ? round(bucket.positionWeight / bucket.impressions, 1) : null,
    impressionsPerUrl: urls ? round(bucket.impressions / urls, 2) : 0,
    clicksPerUrl: urls ? round(bucket.clicks / urls, 2) : 0,
    // Minimum-sample rule: see MIN_SAMPLE_IMPRESSIONS.
    sufficientSample: bucket.impressions >= minSampleImpressions,
  };
}

/** "ok" / "early (<100 impr)" for the markdown Sample column. */
export function sampleLabel(finished, minSampleImpressions = MIN_SAMPLE_IMPRESSIONS) {
  return finished.sufficientSample ? "ok" : `early (<${minSampleImpressions} impr)`;
}

/** Per-template (and per-section / per-hub detail) aggregates for one surface. */
export function aggregateByTemplate(rows) {
  const templates = new Map(TEMPLATE_ORDER.map((t) => [t, newBucket()]));
  const detail = new Map();
  const total = newBucket();
  for (const row of rows) {
    const pageUrl = row.keys?.[0];
    if (!pageUrl) continue;
    const pathname = pathnameOf(pageUrl);
    const template = classifyPath(pathname);
    addRow(templates.get(template), pageUrl, row);
    addRow(total, pageUrl, row);
    if (template === "section" || template === "hub") {
      const key = `/${pathname.split("/")[1]}`;
      if (!detail.has(key)) detail.set(key, newBucket());
      addRow(detail.get(key), pageUrl, row);
    }
  }
  return {
    total: finishBucket(total),
    templates: Object.fromEntries([...templates].map(([t, b]) => [t, finishBucket(b)])),
    detail: Object.fromEntries(
      [...detail].sort((a, b) => b[1].impressions - a[1].impressions).map(([k, b]) => [k, finishBucket(b)]),
    ),
  };
}

// ── Story-date ledger ───────────────────────────────────────────────────────
/**
 * Merge this run's sitemap stories and live publication counts into the
 * ledger: earliest publishedAt wins, publication count keeps its maximum
 * (a story's count only grows while it is live). Pruned by age and capped.
 */
export function mergeLedger(existing, sitemapStories, sourceCountById, now) {
  const byId = new Map();
  for (const entry of Array.isArray(existing) ? existing : []) {
    if (entry?.id && entry.publishedAt) byId.set(entry.id, { ...entry });
  }
  for (const [id, story] of sitemapStories) {
    const current = byId.get(id);
    if (!current) byId.set(id, { id, slug: story.slug, publishedAt: story.publishedAt });
    else if (story.publishedAt < current.publishedAt) current.publishedAt = story.publishedAt;
  }
  for (const [id, sourceCount] of sourceCountById) {
    const current = byId.get(id);
    if (current) current.sourceCount = Math.max(current.sourceCount ?? 0, sourceCount);
  }
  const cutoff = daysAgo(LEDGER_MAX_AGE_DAYS, now).toISOString();
  return [...byId.values()]
    .filter((e) => e.publishedAt >= cutoff)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .slice(0, LEDGER_CAP);
}

// ── KPIs ────────────────────────────────────────────────────────────────────
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Early discovery over ledger stories old enough to have GSC data.
 * hoursToFirst = end of the first impression day (UTC) − publishedAt: the
 * latest moment the impression can have happened, so every "within N h"
 * claim is one the day-granular data actually supports.
 */
export function computeEarlyDiscovery(ledger, pageDateRows, now) {
  const firstImpressionDayById = new Map();
  for (const row of pageDateRows) {
    const [pageUrl, day] = row.keys ?? [];
    if (!pageUrl || !day || !(row.impressions > 0)) continue;
    const id = storyIdOf(pathnameOf(pageUrl));
    if (!id) continue;
    const current = firstImpressionDayById.get(id);
    if (!current || day < current) firstImpressionDayById.set(id, day);
  }
  const windowStart = daysAgo(EARLY_WINDOW_DAYS, now).toISOString();
  const youngest = new Date(now.getTime() - MIN_STORY_AGE_HOURS * 3_600_000).toISOString();
  const eligible = ledger.filter((e) => e.publishedAt >= windowStart && e.publishedAt <= youngest);
  const hours = [];
  let within24 = 0;
  let within48 = 0;
  let within72 = 0;
  for (const story of eligible) {
    const day = firstImpressionDayById.get(story.id);
    if (!day) continue;
    const endOfDay = Date.parse(`${day}T00:00:00.000Z`) + 86_400_000;
    const h = Math.max(0, (endOfDay - Date.parse(story.publishedAt)) / 3_600_000);
    hours.push(h);
    if (h <= 24) within24++;
    if (h <= 48) within48++;
    if (h <= 72) within72++;
  }
  const pct = (n) => (eligible.length ? Math.round((n / eligible.length) * 1000) / 10 : null);
  return {
    method: "day-granular GSC data; hours = end of first impression day (UTC) minus publishedAt (upper bound)",
    windowDays: EARLY_WINDOW_DAYS,
    minStoryAgeHours: MIN_STORY_AGE_HOURS,
    eligibleStories: eligible.length,
    discoveredStories: hours.length,
    discoveredPct: pct(hours.length),
    within24hPct: pct(within24),
    within48hPct: pct(within48),
    within72hPct: pct(within72),
    medianHoursToFirstImpression: hours.length ? Math.round(median(hours)) : null,
  };
}

// ── Publication counts (live + archive + ledger) ─────────────────────────────
/**
 * Index /api/stats/archive-sources rows by cluster id, keeping only the
 * three count fields the report needs (the endpoint is aggregate-only, but
 * the report file should not grow with fields it never reads).
 */
export function indexArchiveRows(rows) {
  const byId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (typeof row?.id !== "string") continue;
    byId.set(row.id, {
      sourceCount: Number.isFinite(row.sourceCount) ? row.sourceCount : null,
      unionPublications: Number.isFinite(row.unionPublications) ? row.unionPublications : null,
      peakHistoryCoverage: Number.isFinite(row.peakHistoryCoverage) ? row.peakHistoryCoverage : null,
    });
  }
  return byId;
}

/**
 * Publications ever recorded for a story: the live /api/stats/coverage
 * count, or the archive's stored count / permanent source union / peak
 * recorded coverage, or the ledger's remembered live count — whichever is
 * highest. null when none of the three has heard of the id ("unknown").
 */
export function publicationsFor(id, liveCountById, archiveById, ledgerCountById) {
  const live = liveCountById.get(id);
  const archive = archiveById.get(id);
  const remembered = ledgerCountById.get(id);
  if (live === undefined && archive === undefined && remembered === undefined) return null;
  return Math.max(
    live ?? 0,
    archive?.sourceCount ?? 0,
    archive?.unionPublications ?? 0,
    archive?.peakHistoryCoverage ?? 0,
    remembered ?? 0,
  );
}

/** Bucket keys a publication count falls into: one exact key plus the cumulative ones. */
export function sourceCountBucketKeys(count) {
  if (count === null || count === undefined) return ["unknown"];
  if (count <= 1) return ["1"];
  if (count === 2) return ["2", "2+"];
  if (count === 3) return ["3", "2+", "3+"];
  return ["4+", "2+", "3+"];
}

/**
 * Story URLs (web) bucketed by publications ever recorded: exact 1 / 2 / 3 /
 * 4+, cumulative 2+ / 3+ (overlapping the exact rows on purpose) and unknown.
 */
export function computeBySourceCount(webRows, liveCountById, archiveById, ledger) {
  const ledgerCount = new Map(ledger.filter((e) => e.sourceCount).map((e) => [e.id, e.sourceCount]));
  const buckets = Object.fromEntries(SOURCE_COUNT_BUCKETS.map((key) => [key, newBucket()]));
  for (const row of webRows) {
    const pageUrl = row.keys?.[0];
    if (!pageUrl) continue;
    const id = storyIdOf(pathnameOf(pageUrl));
    if (!id) continue;
    const count = publicationsFor(id, liveCountById, archiveById, ledgerCount);
    for (const key of sourceCountBucketKeys(count)) addRow(buckets[key], pageUrl, row);
  }
  return Object.fromEntries(SOURCE_COUNT_BUCKETS.map((key) => [key, finishBucket(buckets[key])]));
}

// ── Per-URL signals (data/gsc-url-signals.json) ─────────────────────────────
/**
 * cluster id → [impressions, clicks], web + news summed, for every story
 * whose id reached minImpressions; highest impressions first, capped.
 * Several URLs can share one id (headline re-slugs) — they are summed.
 */
export function buildStorySignals(
  webRows,
  newsRows,
  { cap = SIGNALS_CAP, minImpressions = SIGNALS_MIN_IMPRESSIONS } = {},
) {
  const totals = new Map();
  for (const row of [...webRows, ...newsRows]) {
    const id = storyIdOfRow(row);
    if (!id) continue;
    const current = totals.get(id) ?? [0, 0];
    current[0] += row.impressions ?? 0;
    current[1] += row.clicks ?? 0;
    totals.set(id, current);
  }
  const ranked = [...totals]
    .filter(([, [impressions]]) => impressions >= minImpressions)
    .sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || (a[0] < b[0] ? -1 : 1));
  return {
    stories: Object.fromEntries(ranked.slice(0, cap)),
    storyCount: Math.min(ranked.length, cap),
    truncated: ranked.length > cap,
  };
}

/** Story ids present in the rows but absent from the live count map (archive lookups). */
export function missingStoryIds(rowSets, liveCountById) {
  const ids = new Set();
  for (const rows of rowSets) {
    for (const row of rows) {
      const id = storyIdOfRow(row);
      if (id && !liveCountById.has(id)) ids.add(id);
    }
  }
  return [...ids];
}

export function chunk(items, size) {
  const parts = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

// ── Query dimension (data/gsc-queries.json) ─────────────────────────────────
export const QUERY_CAP = 500;
export const STRIKING_CAP = 200;
export const STRIKING_MIN_POSITION = 5;
export const STRIKING_MAX_POSITION = 20;

function queryEntry(row) {
  return {
    query: row.keys?.[0] ?? "",
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    position: row.position == null ? null : Number(row.position.toFixed(1)),
  };
}

/**
 * Query-dimension summary (seo/STRATEGY.md §4): the queries the site already
 * surfaces for on web and news, plus the striking-distance inventory —
 * [page, query] rows at position 5–20 sorted by impressions, the direct
 * input to retitle priorities and the CTR-rescue job. keys order matches the
 * request dimensions: ["query"] rows carry the query in keys[0];
 * ["page","query"] rows carry page URL in keys[0], query in keys[1].
 */
export function summarizeQueries(webQueryRows, newsQueryRows, pageQueryRows) {
  const byImpressions = (a, b) =>
    b.impressions - a.impressions || b.clicks - a.clicks;
  const strikingDistance = (pageQueryRows ?? [])
    .filter(
      (row) =>
        row.position != null &&
        row.position >= STRIKING_MIN_POSITION &&
        row.position <= STRIKING_MAX_POSITION,
    )
    .map((row) => ({
      page: pathnameOf(row.keys?.[0] ?? ""),
      query: row.keys?.[1] ?? "",
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      position: Number((row.position ?? 0).toFixed(1)),
    }))
    .sort(byImpressions)
    .slice(0, STRIKING_CAP);
  return {
    webQueries: (webQueryRows ?? []).map(queryEntry).sort(byImpressions).slice(0, QUERY_CAP),
    newsQueries: (newsQueryRows ?? []).map(queryEntry).sort(byImpressions).slice(0, QUERY_CAP),
    strikingDistance,
    counts: {
      webRows: (webQueryRows ?? []).length,
      newsRows: (newsQueryRows ?? []).length,
      pageQueryRows: (pageQueryRows ?? []).length,
    },
  };
}

/**
 * Top page URLs by impressions, full URL kept — so a top earner is always
 * resolvable even after its story leaves the live window and the ledger.
 */
export function topUrlsByImpressions(rows, cap = 50) {
  return (rows ?? [])
    .map((row) => ({
      url: row.keys?.[0] ?? "",
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      position: row.position == null ? null : Number(row.position.toFixed(1)),
    }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, cap);
}

// ── Output ──────────────────────────────────────────────────────────────────
export function markdownTable(header, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

export function fmtPct(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}
