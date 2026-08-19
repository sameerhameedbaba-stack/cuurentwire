#!/usr/bin/env node
/**
 * Core Web Vitals measurement (weekly — backlog item 19).
 *
 * Measures the homepage, /top-100 and one story page from the URL survival
 * ledger on a mobile profile, and appends one dated entry per run to
 * data/cwv-history.json. Run weekly by .github/workflows/cwv.yml.
 *
 * Two tools, and every history entry records which one produced it:
 *
 * - `psi` — used when PSI_API_KEY is set. PageSpeed Insights v5 gives CrUX
 *   field data (LCP, INP, CLS, overall category) when Google has enough real
 *   traffic for this origin, plus a genuine Lighthouse lab run and score.
 * - `playwright-chromium` — the keyless default. Drives the Chromium the e2e
 *   suite already installs, under Lighthouse's mobile throttling, and reads
 *   LCP, CLS, FCP and TTFB straight from the browser's own PerformanceObserver.
 *   No key, no signup, no quota. It is NOT a Lighthouse run: it reports no
 *   performance score and no field data, and its numbers must never be
 *   compared against `psi` entries.
 *
 * The keyless path is why this item is no longer blocked on the owner. A PSI
 * key only ever adds CrUX field data on top — and CrUX needs real traffic
 * volume the site does not have yet, so it would report nothing today anyway.
 *
 * Quota errors exit 0 with a warning — free-tier limits must never redden the
 * repo. Only hard API errors with a key present exit 1.
 *
 * Usage: node scripts/cwv-check.mjs [--base https://currentwire.us]
 *        PSI_API_KEY=... node scripts/cwv-check.mjs   (adds field data)
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

/**
 * Throttling applied to the keyless fallback. These are Lighthouse's mobile
 * defaults, so the shape of the numbers is familiar — but a Playwright probe
 * is NOT a Lighthouse run and never reports a Lighthouse score. Every entry
 * records which tool produced it; do not compare across tools.
 */
const MOBILE_THROTTLE = {
  cpuSlowdownMultiplier: 4,
  downloadKbps: 1_638.4,
  uploadKbps: 675,
  latencyMs: 150,
};
/** Quiet window after load before metrics are read, for late LCP and shifts. */
const SETTLE_MS = 5_000;

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

/**
 * Keyless fallback: drive the real Chromium that Playwright already installs
 * for the e2e suite, under Lighthouse's mobile throttling, and read the same
 * metrics the browser itself reports (LCP, CLS, FCP, TTFB) via
 * PerformanceObserver. No key, no signup, no quota — the site is measured
 * either way, and a PSI key only ever adds CrUX field data on top.
 *
 * Never throws: a failure comes back as { error } for that URL.
 */
async function runPlaywrightProbe(urls) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    return urls.map((url) => ({
      url,
      tool: "playwright-chromium",
      error: `playwright unavailable: ${error instanceof Error ? error.message : String(error)}`,
      quota: false,
    }));
  }

  const browser = await chromium.launch();
  const results = [];
  try {
    for (const url of urls) {
      const context = await browser.newContext({
        viewport: { width: 412, height: 823 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      try {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", {
          rate: MOBILE_THROTTLE.cpuSlowdownMultiplier,
        });
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: MOBILE_THROTTLE.latencyMs,
          downloadThroughput: (MOBILE_THROTTLE.downloadKbps * 1024) / 8,
          uploadThroughput: (MOBILE_THROTTLE.uploadKbps * 1024) / 8,
        });

        // largest-contentful-paint and layout-shift are NOT retained in the
        // default performance timeline — getEntriesByType returns [] for
        // both. They have to be observed, and the observer has to exist
        // before the first paint, hence addInitScript rather than evaluate.
        await page.addInitScript(() => {
          const store = { lcp: null, cls: 0 };
          window.__cwv = store;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) store.lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) store.cls += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        });

        await page.goto(url, { waitUntil: "load", timeout: 120_000 });
        await page.waitForTimeout(SETTLE_MS);

        const metrics = await page.evaluate(() => {
          const lcp = window.__cwv?.lcp ?? null;
          const cls = window.__cwv?.cls ?? 0;
          const fcp =
            performance
              .getEntriesByType("paint")
              .find((entry) => entry.name === "first-contentful-paint")
              ?.startTime ?? null;
          const nav = performance.getEntriesByType("navigation")[0];
          return {
            lcp,
            cls,
            fcp,
            ttfb: nav ? nav.responseStart : null,
            transferBytes: nav ? nav.transferSize : null,
          };
        });

        results.push({
          url,
          tool: "playwright-chromium",
          field: null, // CrUX field data needs a key AND real traffic volume
          lab: {
            lcpMs: metrics.lcp === null ? null : Math.round(metrics.lcp),
            cls: Math.round(metrics.cls * 1000) / 1000,
            fcpMs: metrics.fcp === null ? null : Math.round(metrics.fcp),
            ttfbMs: metrics.ttfb === null ? null : Math.round(metrics.ttfb),
            // A Lighthouse performance score cannot be derived from these
            // metrics alone, and inventing one would be a fabricated number.
            score: null,
          },
        });
      } catch (error) {
        results.push({
          url,
          tool: "playwright-chromium",
          error: error instanceof Error ? error.message : String(error),
          quota: false,
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return results;
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

// With a key: PSI (CrUX field data + a real Lighthouse score). Without one:
// the keyless Playwright probe, so there is always Core Web Vitals data.
// PSI runs are slow and rate-limited per second — call sequentially. Three
// URLs weekly is far under the free-tier daily quota.
let results;
let tool;
if (API_KEY) {
  tool = "psi";
  results = [];
  for (const url of pages) results.push({ tool, ...(await runPsi(url)) });
} else {
  tool = "playwright-chromium";
  console.log(
    "[cwv-check] PSI_API_KEY not set — measuring with the keyless Playwright probe " +
      `(Chromium, ${MOBILE_THROTTLE.cpuSlowdownMultiplier}x CPU, ` +
      `${MOBILE_THROTTLE.downloadKbps}kbps/${MOBILE_THROTTLE.latencyMs}ms). ` +
      "Lab metrics only; CrUX field data needs a key and real traffic volume.",
  );
  results = await runPlaywrightProbe(pages);
}

// Append this run to the history, capped to the newest HISTORY_CAP entries.
let history = [];
try {
  const data = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));
  if (Array.isArray(data)) history = data;
} catch {
  // first run — the file is created below
}
history.push({ date: now, base: BASE, strategy: "mobile", tool, pages: results });
if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);
mkdirSync(dirname(HISTORY_PATH), { recursive: true });
writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);

console.log(
  `[cwv-check] ${now} tool=${tool} strategy=mobile pages=${results.length} history=${history.length}`,
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
    ? `lab LCP=${fmtMs(r.lab.lcpMs)} CLS=${fmt(r.lab.cls)}` +
      (r.lab.tbtMs === undefined ? "" : ` TBT=${fmtMs(r.lab.tbtMs)}`) +
      (r.lab.fcpMs === undefined ? "" : ` FCP=${fmtMs(r.lab.fcpMs)}`) +
      (r.lab.ttfbMs === undefined ? "" : ` TTFB=${fmtMs(r.lab.ttfbMs)}`) +
      ` score=${fmt(r.lab.score)}`
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
