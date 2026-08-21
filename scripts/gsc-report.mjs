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
 *   and bucketed by the publications ever recorded for the story (live
 *   count, or the archive's stored count / permanent source union / peak
 *   recorded coverage, whichever is highest), reported as impressions /
 *   clicks / CTR / average position per bucket for exactly 1 / 2 / 3 / 4+
 *   publications plus the cumulative 2+ / 3+ rows (they overlap the exact
 *   rows on purpose) and "unknown". Live counts come from
 *   /api/stats/coverage; every story id the live window no longer holds is
 *   looked up in /api/stats/archive-sources?ids=… (200 ids per request,
 *   aggregate counts only — a failing archive endpoint is a warning, not a
 *   failure, and the story-date ledger's remembered live count still counts).
 *   Before the archive join the live window covered a day or two of
 *   stories, so almost every URL with 28-day impressions fell into
 *   "unknown".
 *
 * Minimum-sample rule: every template and publication-count bucket carries
 * `sufficientSample` (impressions >= MIN_SAMPLE_IMPRESSIONS, 100). Rows
 * below it print as "early" and must not be read as one template
 * outperforming another; minSampleImpressions is recorded in the report.
 *
 * Writes data/gsc-report.json (latest, full), appends a dated summary to
 * data/gsc-history.json (capped at 60 entries), refreshes the story-date
 * ledger data/gsc-story-dates.json, writes data/gsc-url-signals.json (cluster
 * id → [impressions, clicks] over web + news for every story with ≥1
 * impression, highest first, capped at 20000 — the app imports this file
 * statically, so the weekly commit of it triggers a Vercel deploy on purpose;
 * it is left untouched when the web surface query fails so a GSC outage
 * cannot blank the signals) and prints a markdown table.
 * Run weekly by .github/workflows/gsc.yml. No npm dependencies: fetch plus a
 * minimal RS256 JWT signer from node:crypto for the service account. The
 * pure helpers live in scripts/gsc-report-lib.mjs (unit-tested).
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

import {
  ARCHIVE_IDS_PER_REQUEST,
  EARLY_WINDOW_DAYS,
  MIN_SAMPLE_IMPRESSIONS,
  SIGNALS_CAP,
  SIGNALS_MIN_IMPRESSIONS,
  SIGNALS_SURFACES,
  TEMPLATE_ORDER,
  aggregateByTemplate,
  buildStorySignals,
  chunk,
  computeBySourceCount,
  computeEarlyDiscovery,
  daysAgo,
  fmtPct,
  indexArchiveRows,
  isoDay,
  markdownTable,
  mergeLedger,
  missingStoryIds,
  pathnameOf,
  sampleLabel,
  storyIdOf,
} from "./gsc-report-lib.mjs";

// MIN_SAMPLE_IMPRESSIONS (= 100) is defined once in scripts/gsc-report-lib.mjs
// next to finishBucket(), which stamps `sufficientSample` on every bucket;
// it is imported here for the report JSON and the closing stdout note.

const argValue = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const BASE = argValue("--base") ?? "https://currentwire.us";
// `||`, not `??`: the workflow passes an UNSET repository variable as "".
const SITE = argValue("--site") || process.env.GSC_SITE_URL || "sc-domain:currentwire.us";
const WINDOW_DAYS = 28;
const ROW_LIMIT = 25_000;
/** Pagination guard — the site has a few thousand URLs, not 200k. */
const MAX_PAGES = 8;
const HISTORY_CAP = 60;

const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
const REPORT_PATH = `${DATA_DIR}gsc-report.json`;
const HISTORY_PATH = `${DATA_DIR}gsc-history.json`;
const LEDGER_PATH = `${DATA_DIR}gsc-story-dates.json`;
const SIGNALS_PATH = `${DATA_DIR}gsc-url-signals.json`;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SURFACES = ["web", "news", "discover"];

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

// ── 3. Site-side inputs ─────────────────────────────────────────────────────
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
 * Archive publication counts for story ids the live window no longer holds:
 * GET /api/stats/archive-sources?ids=… in chunks of 200 (aggregate counts
 * only, no article URLs). A failing chunk is recorded, never fatal — the
 * ids it covered simply stay "unknown" unless the ledger remembers them.
 */
async function fetchArchiveSources(ids) {
  const byId = new Map();
  const chunks = chunk(ids, ARCHIVE_IDS_PER_REQUEST);
  const failures = [];
  let truncatedChunks = 0;
  for (const [index, part] of chunks.entries()) {
    try {
      const response = await fetch(`${BASE}/api/stats/archive-sources?ids=${part.join(",")}`, {
        redirect: "follow",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json || !Array.isArray(json.rows)) {
        throw new Error(`${response.status}${json?.error ? ` ${json.error}` : ""}`);
      }
      for (const [id, counts] of indexArchiveRows(json.rows)) byId.set(id, counts);
      if (json.truncated) truncatedChunks++;
    } catch (error) {
      failures.push(`chunk ${index + 1}/${chunks.length}: ${error.message}`);
    }
  }
  return { byId, requested: ids.length, chunks: chunks.length, failures, truncatedChunks };
}

// ── 4. Main ─────────────────────────────────────────────────────────────────
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

  // Site-side inputs: news sitemap (publication dates), the live stats
  // endpoint (publication counts) and the archive counts for every story id
  // the live window no longer holds. Any of them may be down; the report
  // says so.
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

  const archiveIds = missingStoryIds([rowsBySurface.web ?? [], rowsBySurface.news ?? []], storySources.byId);
  const archive = await fetchArchiveSources(archiveIds);
  if (archive.failures.length) {
    warnings.push(
      `archive-sources unavailable for ${archive.failures.length} of ${archive.chunks} chunks (${archive.failures[0]})`,
    );
  }
  if (archive.truncatedChunks) warnings.push(`archive-sources truncated ${archive.truncatedChunks} chunk(s)`);

  const ledger = mergeLedger(readJson(LEDGER_PATH, []), sitemapStories, storySources.byId, now);
  writeJson(LEDGER_PATH, ledger);

  const earlyDiscovery = computeEarlyDiscovery(ledger, pageDateRows, now);
  const storiesBySourceCount = computeBySourceCount(rowsBySurface.web ?? [], storySources.byId, archive.byId, ledger);

  // Per-URL signals for the app. Skipped (previous file kept) when the web
  // surface query failed: an empty signals file would deploy "no story has
  // search signals" for a week because of a GSC outage.
  const signals = buildStorySignals(rowsBySurface.web ?? [], rowsBySurface.news ?? [], {
    cap: SIGNALS_CAP,
    minImpressions: SIGNALS_MIN_IMPRESSIONS,
  });
  let signalsWritten = false;
  if (surfaces.web?.error) {
    warnings.push(`url signals not updated: web surface query failed (${surfaces.web.error})`);
  } else {
    writeJson(SIGNALS_PATH, {
      generatedAt: now.toISOString(),
      window: { startDate, endDate, days: WINDOW_DAYS },
      surfaces: SIGNALS_SURFACES,
      minImpressions: SIGNALS_MIN_IMPRESSIONS,
      stories: signals.stories,
    });
    signalsWritten = true;
  }

  const report = {
    generatedAt: now.toISOString(),
    site: SITE,
    base: BASE,
    window: { startDate, endDate, days: WINDOW_DAYS },
    minSampleImpressions: MIN_SAMPLE_IMPRESSIONS,
    surfaces,
    earlyDiscovery,
    storiesBySourceCount,
    archiveSources: {
      requestedIds: archive.requested,
      matchedIds: archive.byId.size,
      chunks: archive.chunks,
      failedChunks: archive.failures.length,
    },
    urlSignals: { stories: signals.storyCount, truncated: signals.truncated, written: signalsWritten },
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
        ["Template", "URLs", "Impr", "Clicks", "CTR", "Avg pos", "Impr/URL", "Clicks/URL", "Sample"],
        TEMPLATE_ORDER.map((t) => {
          const b = surfaces.web.templates[t];
          return [t, b.urls, b.impressions, b.clicks, `${(b.ctr * 100).toFixed(2)}%`, b.avgPosition ?? "—", b.impressionsPerUrl, b.clicksPerUrl, sampleLabel(b)];
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
  console.log("\n### Story URLs by publications ever recorded (web; 2+ and 3+ overlap the exact rows)\n");
  console.log(
    markdownTable(
      ["Publications", "URLs", "Impr", "Clicks", "CTR", "Avg pos", "Impr/URL", "Clicks/URL", "Sample"],
      Object.entries(storiesBySourceCount).map(([k, b]) => [
        k, b.urls, b.impressions, b.clicks, `${(b.ctr * 100).toFixed(2)}%`, b.avgPosition ?? "—", b.impressionsPerUrl, b.clicksPerUrl, sampleLabel(b),
      ]),
    ),
  );
  for (const warning of warnings) console.warn(`[gsc-report] WARN: ${warning}`);
  const written = [REPORT_PATH, HISTORY_PATH, LEDGER_PATH, ...(signalsWritten ? [SIGNALS_PATH] : [])];
  console.log(
    `\n[gsc-report] wrote ${written.join(", ")} ` +
      `(history=${history.length}, ledger=${ledger.length}, archiveIds=${archive.byId.size}/${archive.requested}, signals=${signals.storyCount})`,
  );
  console.log(
    `Template rows marked early are below the ${MIN_SAMPLE_IMPRESSIONS}-impression minimum sample and must not be read as one template outperforming another.`,
  );
}

main().catch((error) => {
  console.error(`[gsc-report] ${error.message}`);
  process.exit(1);
});
