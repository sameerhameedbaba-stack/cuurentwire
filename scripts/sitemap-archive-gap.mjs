#!/usr/bin/env node
/**
 * Measures the SITEMAP-TO-ARCHIVE GAP on the live site: for every story URL
 * currently advertised in sitemap.xml or news-sitemap.xml, does the permanent
 * archive hold a row for it, and if not, how long has it been advertised?
 *
 * The rationale, the measured surface behaviour and the meaning of each bucket
 * are in scripts/sitemap-archive-gap-lib.mjs — read that header first.
 *
 * Zero dependencies, zero keys, $0. Reads only; writes nothing to the site.
 *
 *   node scripts/sitemap-archive-gap.mjs            # measure and print
 *   node scripts/sitemap-archive-gap.mjs --write    # also append a history row
 *   SEO_BASE_URL=http://localhost:3000 node scripts/sitemap-archive-gap.mjs
 *
 * EXIT CODES. 0 = measured (whatever the reading). 1 = could NOT measure. A
 * high `overdue` count is a finding for a human, never a failed run: see the
 * instrument-not-a-gate paragraph in the lib header.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  advertisedStories,
  appendHistory,
  classifyGap,
  formatGapReport,
  mergeAdvertised,
} from "./sitemap-archive-gap-lib.mjs";

const BASE = process.env.SEO_BASE_URL ?? "https://currentwire.us";
const HISTORY_PATH = "data/sitemap-archive-gap-history.json";
const WRITE = process.argv.includes("--write");
/**
 * The ids endpoint validates and returns every row it is asked for. 50 keeps
 * the query string well under any proxy limit while holding the whole corpus
 * to ~16 requests.
 */
const BATCH = 50;

async function get(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "CurrentWire-SEO-Sitemap-Archive-Gap/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

/**
 * Ids the archive holds. An empty `rows` array is a live archive saying "no
 * record" — that is the signal this instrument is built on, and it is exactly
 * how the 2026-09-09 orphans were confirmed. A NON-200, by contrast, means the
 * archive could not be asked, which is not the same thing and must abort the
 * run rather than report every story as unarchived.
 */
async function archivedIds(ids) {
  const held = new Set();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const body = await get(`/api/stats/archive-sources?ids=${chunk.join(",")}`);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`archive-sources returned unparseable JSON for batch at ${i}`);
    }
    if (parsed.error) throw new Error(`archive-sources: ${parsed.error}`);
    if (!Array.isArray(parsed.rows)) throw new Error(`archive-sources returned no rows array at ${i}`);
    for (const row of parsed.rows) if (row?.id) held.add(row.id);
  }
  return held;
}

const readJson = (path, fallback) => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
};

async function main() {
  const [sitemap, newsSitemap] = await Promise.all([get("/sitemap.xml"), get("/news-sitemap.xml")]);

  const entries = mergeAdvertised(
    advertisedStories(sitemap, "sitemap.xml"),
    advertisedStories(newsSitemap, "news-sitemap.xml"),
  );
  if (entries.length === 0) {
    throw new Error("no story URLs found in either sitemap — the corpus could not be measured");
  }

  const held = await archivedIds(entries.map((entry) => entry.id));
  const summary = classifyGap(entries, held);

  console.log(formatGapReport(summary));

  if (WRITE) {
    const history = appendHistory(readJson(HISTORY_PATH, []), summary);
    writeFileSync(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);
    console.log(`\n[gap] appended row to ${HISTORY_PATH} (${history.length} rows)`);
  }
}

main().catch((error) => {
  console.error(`[gap] could not measure: ${error.message}`);
  process.exit(1);
});
