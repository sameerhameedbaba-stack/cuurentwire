#!/usr/bin/env node
/**
 * Google Search Console template / discovery report (weekly).
 *
 * Pulls Search Analytics for the last 28 days, groups every page URL by the
 * page template that produced it (/story/, /top-10, /briefing, /topic/,
 * /source/, /reports/, /archive, the nine sections, the topic hubs, the
 * homepage, other) and reports per template: URLs, impressions, clicks,
 * CTR, average position, impressions per URL and clicks per URL — for the
 * web, news and discover surfaces separately. It also computes two KPIs the
 * GSC UI cannot show:
 *
 * - early discovery: of the stories CurrentWire published 3–14 days ago,
 *   the share that earned ≥1 web impression within 24 / 48 / 72 h of
 *   publication and the median hours to first impression. GSC data is
 *   per DAY, so "hours" is the conservative upper bound (end of the first
 *   impression day, UTC) — a story can only be counted as discovered within
 *   N hours when the data proves it. Publication dates come from the site's
 *   news sitemap, accumulated run over run in data/gsc-story-dates.json
 *   (the sitemap only lists the last 48 h and GSC lags 2–3 days, so a
 *   run-time sitemap alone would never overlap with the data);
 * - single-source vs multi-source: story URLs joined on their cluster id
 *   with /api/stats/coverage (live publication counts) and the ledger above,
 *   reported as impressions/clicks per URL for 1 / 2 / 3+ publications.
 *
 * Writes data/gsc-report.json (latest, full), appends a dated summary to
 * data/gsc-history.json (capped at 60 entries) and prints a markdown table.
 * Run weekly by .github/workflows/gsc.yml. No npm dependencies: fetch plus a
 * minimal RS256 JWT signer from node:crypto for the service account.
 *
 * Without GSC_SERVICE_ACCOUNT_JSON the script prints
 * "skipped: GSC_SERVICE_ACCOUNT_JSON not set" and exits 0, so the workflow
 * stays green until the owner wires it up.
 *
 * ── Owner setup (once, ~10 minutes, $0) ─────────────────────────────────────
 * 1. Google Cloud console → the existing CurrentWire project → "APIs &
 *    Services" → "Enable APIs" → enable "Google Search Console API".
 * 2. "IAM & Admin" → "Service accounts" → create one (any name, no roles
 *    needed) → "Keys" → "Add key" → JSON → download the key file.
 * 3. Search Console → property sc-domain:currentwire.us → Settings → "Users
 *    and permissions" → Add user → the service account's email
 *    (…@…iam.gserviceaccount.com) with the "Restricted" permission.
 * 4. GitHub → repository Settings → Secrets and variables → Actions → New
 *    repository secret → name GSC_SERVICE_ACCOUNT_JSON, value = the FULL
 *    contents of the downloaded JSON key file.
 * 5. Optional: repository variable GSC_SITE_URL to report on a different
 *    property (default sc-domain:currentwire.us).
 * Then run the "GSC template report" workflow once by hand to confirm.
 *
 * Usage: GSC_SERVICE_ACCOUNT_JSON='{...}' node scripts/gsc-report.mjs
 *        [--base https://currentwire.us] [--site sc-domain:currentwire.us]
 */

import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const argValue = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const BASE = argValue("--base") ?? "https://currentwire.us";
// `||`, not `??`: the workflow passes an UNSET repository variable as "".
const SITE = argValue("--site") || process.env.GSC_SITE_URL || "sc-domain:currentwire.us";
const WINDOW_DAYS = 28;
/** Page+date window for the early-discovery KPI. */
const EARLY_WINDOW_DAYS = 14;
/** GSC publishes a day's data 2–3 days later; younger stories cannot be judged. */
const MIN_STORY_AGE_HOURS = 72;
const ROW_LIMIT = 25_000;
/** Pagination guard — the site has a few thousand URLs, not 200k. */
const MAX_PAGES = 8;
const HISTORY_CAP = 60;
/** Story-date ledger: plenty for a 14-day KPI window at ~400 stories/day. */
const LEDGER_MAX_AGE_DAYS = 45;
const LEDGER_CAP = 20_000;

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const REPORT_PATH = `${DATA_DIR}gsc-report.json`;
const HISTORY_PATH = `${DATA_DIR}gsc-history.json`;
const LEDGER_PATH = `${DATA_DIR}gsc-story-dates.json`;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SURFACES = ["web", "news", "discover"];

const SECTIONS = new Set([
  "politics", "business", "technology", "world", "climate",
  "health", "science", "culture", "sports",
]);
const HUBS = new Set([
  "ai", "elections", "immigration", "courts", "crime", "education", "housing",
  "jobs", "money", "weather", "energy", "space", "autos", "travel", "obituaries",
]);
const TEMPLATE_ORDER = [
  "home", "story", "top-10", "top-100", "briefing", "topic", "source", "reports",
  "archive", "section", "hub", "most-covered", "latest", "country", "index", "other",
];

// ── 0. Secret gate ──────────────────────────────────────────────────────────
const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  console.log("skipped: GSC_SERVICE_ACCOUNT_JSON not set");
  process.exit(0);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("missing client_email / private_key");
  }
} catch (error) {
  console.error(`[gsc-report] GSC_SERVICE_ACCOUNT_JSON is not a service-account key: ${error.message}`);
  process.exit(1);
}

// ── 1. Auth: RS256 JWT → OAuth access token ─────────────────────────────────
function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = signer.sign(account.private_key).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

async function fetchAccessToken(account) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signJwt(account),
  });
  const response = await fetch(account.token_uri ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(`token endpoint ${response.status}: ${json.error_description ?? json.error ?? "no access_token"}`);
  }
  return json.access_token;
}

// ── 2. Search Analytics queries ─────────────────────────────────────────────
function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days, from = new Date()) {
  return new Date(from.getTime() - days * 86_400_000);
}

/** All rows for one query body, following startRow pagination. */
async function searchAnalytics(token, body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, rowLimit: ROW_LIMIT, startRow: page * ROW_LIMIT }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`searchAnalytics ${response.status}: ${json.error?.message ?? "unknown error"}`);
    }
    const batch = Array.isArray(json.rows) ? json.rows : [];
    rows.push(...batch);
    if (batch.length < ROW_LIMIT) break;
  }
  return rows;
}

// ── 3. URL → template classification ────────────────────────────────────────
function pathnameOf(pageUrl) {
  try {
    const pathname = new URL(pageUrl).pathname;
    return pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  } catch {
    return "/__unparseable__";
  }
}

function classifyPath(pathname) {
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
 * key between GSC page URLs, the sitemap and /api/stats/coverage.
 */
function storyIdOf(pathname) {
  if (!pathname.startsWith("/story/")) return null;
  const match = pathname.match(/-(c[0-9a-f]{12})$/);
  return match ? match[1] : null;
}

// ── 4. Aggregation ──────────────────────────────────────────────────────────
function newBucket() {
  return { urls: new Set(), impressions: 0, clicks: 0, positionWeight: 0 };
}

function addRow(bucket, pageUrl, row) {
  bucket.urls.add(pageUrl);
  bucket.impressions += row.impressions ?? 0;
  bucket.clicks += row.clicks ?? 0;
  // Impression-weighted, like GSC's own average position over a group.
  bucket.positionWeight += (row.position ?? 0) * (row.impressions ?? 0);
}

function finishBucket(bucket) {
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
  };
}

/** Per-template (and per-section / per-hub detail) aggregates for one surface. */
function aggregateByTemplate(rows) {
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

// ── 5. Story-date ledger (news sitemap, accumulated) ────────────────────────
function readJson(path, fallback) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Story cluster id → { slug, publishedAt } from the live news sitemap. */
async function fetchNewsSitemapStories() {
  const response = await fetch(`${BASE}/news-sitemap.xml`, { redirect: "follow" });
  if (!response.ok) throw new Error(`news-sitemap.xml ${response.status}`);
  const xml = await response.text();
  const stories = new Map();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const published = block.match(/<news:publication_date>([^<]+)<\/news:publication_date>/)?.[1];
    if (!loc || !published) continue;
    const pathname = pathnameOf(loc.replace(/&amp;/g, "&"));
    const id = storyIdOf(pathname);
    if (!id || Number.isNaN(Date.parse(published))) continue;
    stories.set(id, { slug: pathname.slice("/story/".length), publishedAt: published });
  }
  return stories;
}

/** Live slug → publication count from the public stats endpoint. */
async function fetchStorySources() {
  const response = await fetch(`${BASE}/api/stats/coverage`, { redirect: "follow" });
  if (!response.ok) throw new Error(`/api/stats/coverage ${response.status}`);
  const json = await response.json();
  const byId = new Map();
  for (const entry of json.storySources ?? []) {
    const id = storyIdOf(`/story/${entry.slug}`);
    if (id) byId.set(id, entry.sourceCount);
  }
  return { byId, datasetVersion: json.datasetVersion ?? null, coverage: json.coverage ?? null };
}

/**
 * Merge this run's sitemap stories and live publication counts into the
 * ledger: earliest publishedAt wins, publication count keeps its maximum
 * (a story's count only grows while it is live). Pruned by age and capped.
 */
function mergeLedger(existing, sitemapStories, sourceCountById, now) {
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

// ── 6. KPIs ─────────────────────────────────────────────────────────────────
function median(values) {
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
function computeEarlyDiscovery(ledger, pageDateRows, now) {
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

/** Story URLs (web) bucketed by publication count: 1 / 2 / 3+ / unknown. */
function computeBySourceCount(webRows, sourceCountById, ledger) {
  const ledgerCount = new Map(ledger.filter((e) => e.sourceCount).map((e) => [e.id, e.sourceCount]));
  const buckets = { "1": newBucket(), "2": newBucket(), "3+": newBucket(), unknown: newBucket() };
  for (const row of webRows) {
    const pageUrl = row.keys?.[0];
    if (!pageUrl) continue;
    const id = storyIdOf(pathnameOf(pageUrl));
    if (!id) continue;
    const count = sourceCountById.get(id) ?? ledgerCount.get(id);
    const key = count === undefined ? "unknown" : count <= 1 ? "1" : count === 2 ? "2" : "3+";
    addRow(buckets[key], pageUrl, row);
  }
  return Object.fromEntries(Object.entries(buckets).map(([k, b]) => [k, finishBucket(b)]));
}

// ── 7. Output ───────────────────────────────────────────────────────────────
function markdownTable(header, rows) {
  const line = (cells) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

function fmtPct(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

async function main() {
  const now = new Date();
  const endDate = isoDay(now);
  const startDate = isoDay(daysAgo(WINDOW_DAYS - 1, now));
  const earlyStartDate = isoDay(daysAgo(EARLY_WINDOW_DAYS - 1, now));

  const token = await fetchAccessToken(serviceAccount);

  // (a) by page, per surface. A surface the property has no data for (or
  // the API rejects) is recorded as an error, never fatal.
  const surfaces = {};
  const rowsBySurface = {};
  for (const type of SURFACES) {
    try {
      const rows = await searchAnalytics(token, {
        startDate,
        endDate,
        dimensions: ["page"],
        type,
        dataState: "all",
      });
      rowsBySurface[type] = rows;
      surfaces[type] = { rows: rows.length, ...aggregateByTemplate(rows) };
    } catch (error) {
      rowsBySurface[type] = [];
      surfaces[type] = { rows: 0, error: error.message };
    }
  }

  // (b) page+date, web, last 14 days — the early-discovery signal.
  let pageDateRows = [];
  let pageDateError = null;
  try {
    pageDateRows = await searchAnalytics(token, {
      startDate: earlyStartDate,
      endDate,
      dimensions: ["page", "date"],
      type: "web",
      dataState: "all",
    });
  } catch (error) {
    pageDateError = error.message;
  }

  // Site-side inputs: news sitemap (publication dates) and the stats
  // endpoint (publication counts). Either may be down; the report says so.
  const warnings = [];
  let sitemapStories = new Map();
  try {
    sitemapStories = await fetchNewsSitemapStories();
  } catch (error) {
    warnings.push(`news sitemap unavailable: ${error.message}`);
  }
  let storySources = { byId: new Map(), datasetVersion: null, coverage: null };
  try {
    storySources = await fetchStorySources();
  } catch (error) {
    warnings.push(`stats endpoint unavailable: ${error.message}`);
  }
  if (pageDateError) warnings.push(`page+date query failed: ${pageDateError}`);

  const ledger = mergeLedger(readJson(LEDGER_PATH, []), sitemapStories, storySources.byId, now);
  writeJson(LEDGER_PATH, ledger);

  const earlyDiscovery = computeEarlyDiscovery(ledger, pageDateRows, now);
  const storiesBySourceCount = computeBySourceCount(rowsBySurface.web ?? [], storySources.byId, ledger);

  const report = {
    generatedAt: now.toISOString(),
    site: SITE,
    base: BASE,
    window: { startDate, endDate, days: WINDOW_DAYS },
    surfaces,
    earlyDiscovery,
    storiesBySourceCount,
    liveCoverage: storySources.coverage,
    liveDatasetVersion: storySources.datasetVersion,
    ledgerStories: ledger.length,
    warnings,
  };
  writeJson(REPORT_PATH, report);

  // History keeps the small, comparable part of each run.
  let history = readJson(HISTORY_PATH, []);
  if (!Array.isArray(history)) history = [];
  history.push({
    date: now.toISOString(),
    window: report.window,
    surfaces: Object.fromEntries(
      SURFACES.map((type) => [type, surfaces[type].error ? { error: surfaces[type].error } : surfaces[type].total]),
    ),
    templates: surfaces.web?.templates
      ? Object.fromEntries(
          Object.entries(surfaces.web.templates).map(([t, b]) => [
            t,
            { urls: b.urls, impressions: b.impressions, clicks: b.clicks },
          ]),
        )
      : null,
    earlyDiscovery,
    storiesBySourceCount,
  });
  if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);
  writeJson(HISTORY_PATH, history);

  // Markdown to stdout (the workflow log is the human view).
  console.log(`## GSC report ${startDate} → ${endDate} (${SITE})\n`);
  console.log(
    markdownTable(
      ["Surface", "URLs", "Impressions", "Clicks", "CTR", "Avg pos"],
      SURFACES.map((type) => {
        const s = surfaces[type];
        if (s.error) return [type, "—", "—", "—", "—", `error: ${s.error}`];
        return [type, s.total.urls, s.total.impressions, s.total.clicks, `${(s.total.ctr * 100).toFixed(2)}%`, s.total.avgPosition ?? "—"];
      }),
    ),
  );
  if (surfaces.web?.templates) {
    console.log("\n### Web by template\n");
    console.log(
      markdownTable(
        ["Template", "URLs", "Impr", "Clicks", "CTR", "Avg pos", "Impr/URL", "Clicks/URL"],
        TEMPLATE_ORDER.map((t) => {
          const b = surfaces.web.templates[t];
          return [t, b.urls, b.impressions, b.clicks, `${(b.ctr * 100).toFixed(2)}%`, b.avgPosition ?? "—", b.impressionsPerUrl, b.clicksPerUrl];
        }),
      ),
    );
  }
  console.log("\n### Early discovery (stories 3–14 days old)\n");
  console.log(
    markdownTable(
      ["Eligible", "Discovered", "≤24h", "≤48h", "≤72h", "Median h to first impression"],
      [[
        earlyDiscovery.eligibleStories,
        `${earlyDiscovery.discoveredStories} (${fmtPct(earlyDiscovery.discoveredPct)})`,
        fmtPct(earlyDiscovery.within24hPct),
        fmtPct(earlyDiscovery.within48hPct),
        fmtPct(earlyDiscovery.within72hPct),
        earlyDiscovery.medianHoursToFirstImpression ?? "—",
      ]],
    ),
  );
  console.log("\n### Story URLs by publication count (web)\n");
  console.log(
    markdownTable(
      ["Publications", "URLs", "Impr", "Clicks", "Impr/URL", "Clicks/URL"],
      Object.entries(storiesBySourceCount).map(([k, b]) => [k, b.urls, b.impressions, b.clicks, b.impressionsPerUrl, b.clicksPerUrl]),
    ),
  );
  for (const warning of warnings) console.warn(`[gsc-report] WARN: ${warning}`);
  console.log(`\n[gsc-report] wrote ${REPORT_PATH} and ${HISTORY_PATH} (history=${history.length}, ledger=${ledger.length})`);
}

main().catch((error) => {
  console.error(`[gsc-report] ${error.message}`);
  process.exit(1);
});
