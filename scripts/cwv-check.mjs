#!/usr/bin/env node
/**
 * Core Web Vitals measurement (weekly, key-ready — backlog item 19).
 *
 * Calls the PageSpeed Insights v5 API (mobile strategy) for the homepage,
 * /top-100 and one story page from the URL survival ledger. Records CrUX
 * field data (LCP, INP, CLS, overall category) when Google has it, plus
 * Lighthouse lab fallbacks (LCP, CLS, TBT, performance score), and appends
 * one dated entry per run to data/cwv-history.json. Run weekly by
 * .github/workflows/cwv.yml.
 *
 * Requires a free PSI API key in the PSI_API_KEY env var (the same key
 * serves CrUX). Without one the script prints a skip line and exits 0, so
 * the workflow stays green until the repo secret exists. Quota errors also
 * exit 0 with a warning — free-tier limits must never redden the repo.
 * Only hard API errors with a key present exit 1.
 *
 * Usage: PSI_API_KEY=... node scripts/cwv-check.mjs [--base https://currentwire.us]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const BASE =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : "https://currentwire.us";
const HISTORY_PATH = new URL("../data/cwv-history.json", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1"); // strip leading slash on Windows paths
const LEDGER_PATH = new URL("../data/url-ledger.json", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1");
const HISTORY_CAP = 120;
const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const API_KEY = process.env.PSI_API_KEY;
if (!API_KEY) {
  console.log(
    "[cwv-check] SKIP: PSI_API_KEY not set — add the free PageSpeed Insights API key as a repo secret to enable weekly CWV measurement",
  );
  process.exit(0);
}

/** First /story/ URL the survival ledger knows about, or null. */
function firstStoryUrl() {
  try {
    const ledger = JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
    if (Array.isArray(ledger)) {
      const entry = ledger.find(
        (e) => typeof e?.url === "string" && e.url.includes("/story/"),
      );
      if (entry) return entry.url;
    }
  } catch {
    // ledger missing or unreadable — measure the two stable surfaces only
  }
  return null;
}

/** CrUX field data from loadingExperience, or null when Google has none. */
function extractField(experience) {
  const metrics = experience?.metrics;
  if (!metrics || Object.keys(metrics).length === 0) return null;
  const percentile = (id) => metrics[id]?.percentile ?? null;
  const cls = percentile("CUMULATIVE_LAYOUT_SHIFT_SCORE");
  return {
    lcpMs: percentile("LARGEST_CONTENTFUL_PAINT_MS"),
    inpMs: percentile("INTERACTION_TO_NEXT_PAINT"),
    cls: cls === null ? null : cls / 100, // API reports CLS percentile x100
    overall: experience.overall_category ?? null,
  };
}

/** Lighthouse lab fallbacks, or null when the lab run is absent. */
function extractLab(lighthouse) {
  const audits = lighthouse?.audits;
  if (!audits) return null;
  const num = (id) => audits[id]?.numericValue ?? null;
  const lcp = num("largest-contentful-paint");
  const cls = num("cumulative-layout-shift");
  const tbt = num("total-blocking-time");
  const score = lighthouse.categories?.performance?.score;
  return {
    lcpMs: lcp === null ? null : Math.round(lcp),
    cls: cls === null ? null : Math.round(cls * 1000) / 1000,
    tbtMs: tbt === null ? null : Math.round(tbt),
    score: score == null ? null : Math.round(score * 100),
  };
}

/** One PSI call. Never throws: failures come back as { error, quota }. */
async function runPsi(url) {
  const query = new URLSearchParams({
    url,
    strategy: "mobile",
    category: "performance",
    key: API_KEY,
  });
  let res;
  let body = null;
  try {
    res = await fetch(`${PSI_ENDPOINT}?${query}`);
    body = await res.json().catch(() => null);
  } catch (error) {
    return { url, error: String(error), quota: false };
  }
  if (!res.ok) {
    const message = body?.error?.message ?? `HTTP ${res.status}`;
    const quota =
      res.status === 429 ||
      body?.error?.status === "RESOURCE_EXHAUSTED" ||
      /quota|rate.?limit/i.test(message);
    return { url, error: `${res.status} ${message}`, quota };
  }
  return {
    url,
    field: extractField(body?.loadingExperience),
    lab: extractLab(body?.lighthouseResult),
  };
}

const fmtMs = (ms) => (ms === null || ms === undefined ? "-" : `${ms}ms`);
const fmt = (v) => (v === null || v === undefined ? "-" : String(v));

const now = new Date().toISOString();
const pages = [`${BASE}/`, `${BASE}/top-100`];
const story = firstStoryUrl();
if (story) pages.push(story);
else
  console.warn(
    "[cwv-check] WARN: no /story/ URL in data/url-ledger.json — checking stable surfaces only",
  );

// PSI runs are slow and rate-limited per second — call sequentially. Three
// URLs weekly is far under the free-tier daily quota.
const results = [];
for (const url of pages) results.push(await runPsi(url));

// Append this run to the history, capped to the newest HISTORY_CAP entries.
let history = [];
try {
  const data = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  if (Array.isArray(data)) history = data;
} catch {
  // first run — the file is created below
}
history.push({ date: now, base: BASE, strategy: "mobile", pages: results });
if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);
mkdirSync(dirname(HISTORY_PATH), { recursive: true });
writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);

console.log(
  `[cwv-check] ${now} strategy=mobile pages=${results.length} history=${history.length}`,
);
for (const r of results) {
  const path = r.url.replace(BASE, "") || "/";
  if (r.error) {
    console.log(`  ${path}  ERROR ${r.error}`);
    continue;
  }
  const field = r.field
    ? `field LCP=${fmtMs(r.field.lcpMs)} INP=${fmtMs(r.field.inpMs)} ` +
      `CLS=${fmt(r.field.cls)} (${fmt(r.field.overall)})`
    : "field: none yet";
  const lab = r.lab
    ? `lab LCP=${fmtMs(r.lab.lcpMs)} CLS=${fmt(r.lab.cls)} ` +
      `TBT=${fmtMs(r.lab.tbtMs)} score=${fmt(r.lab.score)}`
    : "lab: none";
  console.log(`  ${path}  ${field}  |  ${lab}`);
}

const quotaErrors = results.filter((r) => r.error && r.quota);
const hardErrors = results.filter((r) => r.error && !r.quota);
for (const r of quotaErrors) {
  console.warn(
    `[cwv-check] WARN: quota exhausted on ${r.url} — free-tier limit, not a failure`,
  );
}
if (hardErrors.length > 0) {
  console.error(
    `[cwv-check] FAIL: ${hardErrors.length} hard API error(s) with a key present`,
  );
  process.exit(1);
}
console.log("[cwv-check] PASS");
