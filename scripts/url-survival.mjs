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

const BASE =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : "https://currentwire.us";
const LEDGER_PATH = new URL("../data/url-ledger.json", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1"); // strip leading slash on Windows paths
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
 * A 5xx is NOT a broken permanence guarantee.
 *
 * The invariant this probe defends is "a published URL never 404s". On
 * 2026-08-21 the story archive went down and 1,322 URLs answered 404, which
 * is exactly the violation it exists to catch. Those URLs now answer a
 * retriable 5xx instead, and if the probe kept calling that "no longer
 * resolves" it would stay red for the whole outage — hiding any REAL 404
 * regression underneath a wall of expected noise, and teaching everyone to
 * ignore the one gate that guards the site's central promise.
 *
 * So the two are counted separately: gone (4xx — the guarantee is broken,
 * fail) and unavailable (5xx — the origin is having a bad day, report it
 * loudly but do not claim the URL is lost).
 */
const gone = results.filter((r) => !r.ok && r.status >= 400 && r.status < 500);
const unavailable = results.filter((r) => !r.ok && (r.status === 0 || r.status >= 500));
const redirects = results.filter((r) => r.ok && r.status !== 200);
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
    `checked=${results.length} ok=${results.length - gone.length - unavailable.length} ` +
    `redirects=${redirects.length} GONE=${gone.length} UNAVAILABLE=${unavailable.length}`,
);
for (const r of redirects.slice(0, 10)) console.log(`  redirect ${r.url} ${r.note}`);
for (const r of gone) console.log(`  GONE ${r.status} ${r.url} ${r.note ?? ""}`);
for (const r of unavailable.slice(0, 10)) {
  console.log(`  unavailable ${r.status} ${r.url} ${r.note ?? ""}`);
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
console.log("[url-survival] PASS: every previously published URL still resolves");
