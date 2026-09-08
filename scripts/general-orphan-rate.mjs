#!/usr/bin/env node
/**
 * Measures the classifier's ORPHAN RATE on the live site: the share of
 * currently published stories whose `articleSection` is General, the
 * abstention bucket whose page is `noindex, nofollow`. A story routed there
 * appears on no indexable category page at all — seo/BACKLOG.md item 6.
 *
 * Zero dependencies, zero keys, $0. Reads only; writes nothing to the site.
 *
 *   node scripts/general-orphan-rate.mjs            # measure and print
 *   node scripts/general-orphan-rate.mjs --write    # also append a history row
 *   SEO_BASE_URL=http://localhost:3000 node scripts/general-orphan-rate.mjs
 *
 * It reads the WHOLE news-sitemap corpus rather than a sample. The two
 * previous readings of this figure were 3 of 22 and 9 of 40, sample sizes at
 * which the observed rate and the benchmark's designed 34.8% are about one
 * standard error apart, so neither could say whether anything had regressed.
 * The corpus is ~700 pages and every one of them is edge-cached, so the full
 * read costs seconds and removes the sampling error completely.
 *
 * It never fails on a high rate — see the header of general-orphan-lib.mjs.
 * Exit 1 means the corpus could not be MEASURED.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

import {
  appendHistory,
  articleSectionFrom,
  formatOrphanReport,
  previousRow,
  sitemapLocs,
  summarizeSections,
} from "./general-orphan-lib.mjs";

const BASE = process.env.SEO_BASE_URL ?? "https://currentwire.us";
const HISTORY_PATH = "data/general-orphan-history.json";
/** Matches the news-sitemap URL sweep in seo-health.mjs. */
const CONCURRENCY = 8;
const WRITE = process.argv.includes("--write");

async function get(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "CurrentWire-SEO-Orphan-Rate/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Why an unread page was unread, tallied. The first live run of this script
 * read 153 of 727 and could not say why; a warm re-run read 727 of 727, so
 * the cause was almost certainly cold ISR entries rendering at the origin
 * under a 30 s ceiling. That is a different fix from a rate limit or a
 * parser bug, and the run has to be able to tell them apart.
 */
const outcomes = {};
const noteOutcome = (key) => {
  outcomes[key] = (outcomes[key] ?? 0) + 1;
};

/**
 * One page's section, or null when it could not be read. Retries once: a
 * single transport blip must not be counted as an unreadable page, because
 * unreadable pages are what decides whether the run measured anything.
 */
async function sectionOf(url) {
  let last = "unknown";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await get(url);
      if (res.status !== 200) {
        last = `http ${res.status}`;
        continue;
      }
      const section = articleSectionFrom(res.body);
      if (section) return { url, section };
      last = "200 with no NewsArticle articleSection";
    } catch (error) {
      last = error?.name ?? "fetch failed";
    }
  }
  noteOutcome(last);
  return { url, section: null };
}

const sitemap = await get("/news-sitemap.xml");
if (sitemap.status !== 200) {
  console.error(`FAIL: /news-sitemap.xml answered ${sitemap.status}`);
  process.exit(1);
}
const locs = sitemapLocs(sitemap.body);
if (locs.length === 0) {
  console.error("FAIL: /news-sitemap.xml carried no <loc> entries");
  process.exit(1);
}

const measuredAt = new Date().toISOString();
const readings = [];
for (let i = 0; i < locs.length; i += CONCURRENCY) {
  const batch = await Promise.all(locs.slice(i, i + CONCURRENCY).map(sectionOf));
  readings.push(...batch);
}

const summary = summarizeSections(readings, locs.length);
const history = existsSync(HISTORY_PATH)
  ? JSON.parse(readFileSync(HISTORY_PATH, "utf-8"))
  : [];

console.log(`corpus: /news-sitemap.xml on ${BASE}, ${locs.length} story URLs`);
console.log(`measured at ${measuredAt}`);
console.log("");
console.log(formatOrphanReport(summary, previousRow(history, measuredAt), outcomes));

if (!summary.measured) process.exit(1);

if (WRITE) {
  const row = {
    measuredAt,
    base: BASE,
    attempted: summary.attempted,
    read: summary.read,
    readPct: summary.readPct,
    orphans: summary.orphans,
    generalOrphanPct: summary.generalOrphanPct,
    sections: summary.sections,
    measured: summary.measured,
  };
  writeFileSync(HISTORY_PATH, `${JSON.stringify(appendHistory(history, row), null, 2)}\n`);
  console.log("");
  console.log(`wrote ${HISTORY_PATH}`);
}
