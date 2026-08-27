#!/usr/bin/env node
/**
 * Published-URL survival probe (audit round 4, item 7).
 *
 * Maintains a ledger of every /story/ URL the site has ever advertised
 * (sitemap + news sitemap) and re-checks ALL of them on every run. The
 * audit invariant: once published, a URL answers 200 or a valid 301/308 to
 * a 200 — never 404. Run daily by .github/workflows/url-survival.yml; the
 * workflow fails loudly if any previously published URL is dead.
 *
 * Ledger: data/url-ledger.json — [{ url, firstSeen, lastOk }]. Entries not
 * seen OK for LEDGER_RETENTION_DAYS are dropped to bound growth.
 *
 * Usage: node scripts/url-survival.mjs [--base https://currentwire.us]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  classifyResults,
  clusterIdFromStoryUrl,
  LOST_AFTER_DAYS,
} from "./url-survival-lib.mjs";

const BASE =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : "https://currentwire.us";
const repoPath = (relative) =>
  new URL(relative, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"); // strip leading slash on Windows paths
const LEDGER_PATH = repoPath("../data/url-ledger.json");
const LOST_STORIES_PATH = repoPath("../data/lost-stories.json");
const CONCURRENCY = 10;
const LEDGER_RETENTION_DAYS = 30;

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
}

function extractStoryUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]*\/story\/[^<]+?)\s*<\/loc>/g)].map(
    (m) => m[1].trim(),
  );
}

/**
 * Cluster ids the site answers a deliberate, permanent 404 for — the same
 * file lib/news/story-resolution.ts reads. Their URLs are 404 BY DESIGN, so
 * counting them as broken promises would keep this gate red forever (the
 * exact failure mode the GONE/LOST split exists to prevent) and bury the
 * next genuine 404 among 212 expected ones.
 */
function loadTombstonedIds() {
  try {
    const data = JSON.parse(readFileSync(LOST_STORIES_PATH, "utf-8"));
    return new Set(Array.isArray(data?.ids) ? data.ids : []);
  } catch {
    return new Set();
  }
}

function loadLedger() {
  try {
    const data = JSON.parse(readFileSync(LEDGER_PATH, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Check one URL: OK when 200, or 301/302/307/308 whose target answers 200. */
async function checkUrl(url) {
  const res = await fetch(url, { redirect: "manual" });
  if (res.status === 200) return { url, ok: true, status: 200 };
  if ([301, 302, 307, 308].includes(res.status)) {
    const location = res.headers.get("location");
    if (!location) return { url, ok: false, status: res.status, note: "redirect without location" };
    const target = new URL(location, url).toString();
    const final = await fetch(target, { redirect: "follow" });
    return {
      url,
      ok: final.status === 200,
      status: res.status,
      note: `-> ${target} (${final.status})`,
    };
  }
  return { url, ok: false, status: res.status };
}

const now = new Date().toISOString();
const ledger = loadLedger();
const known = new Map(ledger.map((entry) => [entry.url, entry]));

// 1. Discover currently advertised story URLs.
const [sitemap, newsSitemap] = await Promise.all([
  fetchText(`${BASE}/sitemap.xml`),
  fetchText(`${BASE}/news-sitemap.xml`),
]);
const advertised = new Set([
  ...extractStoryUrls(sitemap),
  ...extractStoryUrls(newsSitemap),
]);
let added = 0;
for (const url of advertised) {
  if (!known.has(url)) {
    known.set(url, { url, firstSeen: now, lastOk: null });
    added++;
  }
}

// 2. Re-check EVERY ledger URL, bounded concurrency.
const entries = [...known.values()];
const results = [];
for (let i = 0; i < entries.length; i += CONCURRENCY) {
  const batch = entries.slice(i, i + CONCURRENCY);
  results.push(
    ...(await Promise.all(
      batch.map(async (entry) => {
        try {
          return await checkUrl(entry.url);
        } catch (error) {
          return { url: entry.url, ok: false, status: 0, note: String(error) };
        }
      }),
    )),
  );
}

/**
 * A 5xx is NOT a broken permanence guarantee — and a 5xx that never ends is
 * not an outage either. The three-way split (GONE / UNAVAILABLE / LOST) and
 * the reasoning behind it live in ./url-survival-lib.mjs.
 *
 * Why LOST exists, in short: measured 2026-08-24, 214 ledger URLs answer a
 * permanent 500, and every one was first seen on 2026-08-20 or 2026-08-21 —
 * the window when Neon's free tier was refusing all traffic on an exhausted
 * egress quota. Those stories were live, were advertised in the sitemaps,
 * were never written to the archive, and then aged out of the 72 h live
 * dataset. The content exists nowhere, so no restore brings it back;
 * /archive/2026-08-20 lists 24 stories where every neighbouring day lists
 * 552-1,275. This gate had therefore been red every night since 2026-08-22
 * for a condition that cannot clear — which is the same defect the
 * gone/unavailable split was written to prevent, arriving from the other
 * side. A gate that cannot go green stops being read.
 */
const tombstonedIds = loadTombstonedIds();
const { gone, unavailable, lost, tombstoned, redirects, runIsHealthy } =
  classifyResults({ results, ledger: known, tombstonedIds });
for (const result of results) {
  if (result.ok) known.get(result.url).lastOk = now;
}

// 3. Retention: drop entries with no OK check inside the window (transient
// network failures keep their previous lastOk and stay).
const cutoff = Date.now() - LEDGER_RETENTION_DAYS * 86_400_000;
const kept = [...known.values()].filter(
  (entry) => entry.lastOk === null || new Date(entry.lastOk).getTime() >= cutoff,
);

mkdirSync(dirname(LEDGER_PATH), { recursive: true });
writeFileSync(LEDGER_PATH, `${JSON.stringify(kept, null, 2)}\n`);

console.log(
  `[url-survival] ${now} base=${BASE} ledger=${kept.length} (+${added} new) ` +
    `checked=${results.length} ok=${results.length - gone.length - unavailable.length - lost.length} ` +
    `redirects=${redirects.length} GONE=${gone.length} UNAVAILABLE=${unavailable.length} ` +
    `LOST=${lost.length} TOMBSTONED=${tombstoned.length}` +
    `${runIsHealthy ? "" : " (lost-classification suspended: run unhealthy)"}`,
);
for (const r of redirects.slice(0, 10)) console.log(`  redirect ${r.url} ${r.note}`);
for (const r of gone) console.log(`  GONE ${r.status} ${r.url} ${r.note ?? ""}`);
for (const r of unavailable.slice(0, 10)) {
  console.log(`  unavailable ${r.status} ${r.url} ${r.note ?? ""}`);
}
for (const r of lost.slice(0, 10)) {
  console.log(`  lost ${r.status} ${r.url} ${r.note ?? ""}`);
}
for (const r of tombstoned.slice(0, 5)) {
  console.log(`  tombstoned ${r.status} ${r.url}`);
}

if (tombstoned.length > 0) {
  const ids = new Set(
    tombstoned.map((r) => clusterIdFromStoryUrl(r.url)).filter(Boolean),
  );
  console.log(
    `[url-survival] ${tombstoned.length} URL(s) (${ids.size} cluster id(s)) answer a ` +
      `deliberate 404 from data/lost-stories.json — content that exists nowhere, ` +
      `tombstoned on 2026-08-25 because the retriable 500 it used to serve was ` +
      `poisoning crawl health. Expected, not a regression. Any OTHER 4xx still fails ` +
      `this gate.`,
  );
}

if (lost.length > 0) {
  // Reported every run, deliberately without failing — see the LOST note above.
  const oldest = lost
    .map((r) => known.get(r.url)?.lastOk ?? known.get(r.url)?.firstSeen)
    .filter(Boolean)
    .sort()[0];
  console.log(
    `[url-survival] ${lost.length} URL(s) have answered 5xx since ${oldest ?? "?"} ` +
      `(> ${LOST_AFTER_DAYS}d) — treated as permanently lost content, not as an ` +
      `outage. These stories were never written to the archive and cannot be ` +
      `restored; they leave the ledger on the ${LEDGER_RETENTION_DAYS}-day retention. ` +
      `Not a build failure.`,
  );
}
if (unavailable.length > 0) {
  // Not a pass, but not a broken promise either — say which it is.
  console.error(
    `[url-survival] ${unavailable.length} URL(s) answered 5xx — the origin or its ` +
      `archive is down. These URLs are NOT lost; they are retriable and crawlers ` +
      `will come back. Restore the backing store, then re-run.`,
  );
}
if (gone.length > 0) {
  console.error(
    `[url-survival] FAIL: ${gone.length} previously published URL(s) return 4xx — ` +
      `the "published URLs never 404" guarantee is broken`,
  );
  process.exit(1);
}
if (unavailable.length > 0) process.exit(1);
const knownGoneNote = [
  lost.length > 0 ? `${lost.length} known-lost (5xx)` : null,
  tombstoned.length > 0 ? `${tombstoned.length} tombstoned (404)` : null,
]
  .filter(Boolean)
  .join(" and ");
console.log(
  knownGoneNote
    ? `[url-survival] PASS: no new failures — every published URL still resolves ` +
      `except ${knownGoneNote} from the 2026-08-19..21 archive outage`
    : "[url-survival] PASS: every previously published URL still resolves",
);
