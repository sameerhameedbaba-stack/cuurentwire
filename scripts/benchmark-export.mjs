#!/usr/bin/env node
/**
 * benchmark:export — grow the real-production benchmark (§23/§28/§29).
 *
 * Harvests every currently published story (JSON-LD of every URL in the
 * survival ledger + live pages) and emits the ones NOT yet in the local
 * truth set as label candidates:
 *
 *   data/local/benchmark-candidates.jsonl
 *   { "title", "description", "predictedCategory", "expectedCategory": null }
 *
 * A reviewer fills in expectedCategory (or confirms the prediction), then
 * appends the rows to data/local/real-stories.json + truth.tsv and re-runs
 * the evaluation (SHADOW_EVAL=1 npx vitest run tests/shadow/). Everything
 * stays local: verbatim headlines are never committed to the public repo.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "data/local/benchmark-candidates.jsonl";

const known = new Set();
if (existsSync("data/local/real-stories.json")) {
  for (const s of JSON.parse(readFileSync("data/local/real-stories.json", "utf-8"))) {
    known.add(s.title);
  }
}

const ledger = existsSync("data/url-ledger.json")
  ? JSON.parse(readFileSync("data/url-ledger.json", "utf-8")).map((e) => e.url)
  : [];

const rows = [];
const seen = new Set();

function harvest(html, url) {
  for (const m of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (data["@type"] !== "NewsArticle") continue;
    const title = data.headline ?? "";
    if (!title || seen.has(title) || known.has(title)) continue;
    seen.add(title);
    rows.push({
      url,
      title,
      description: data.description ?? "",
      predictedCategory: (data.articleSection ?? "").toLowerCase(),
      expectedCategory: null,
    });
  }
}

const CONCURRENCY = 12;
for (let i = 0; i < ledger.length; i += CONCURRENCY) {
  await Promise.all(
    ledger.slice(i, i + CONCURRENCY).map(async (url) => {
      try {
        const res = await fetch(url, { redirect: "follow" });
        if (res.ok) harvest(await res.text(), url);
      } catch {}
    }),
  );
}

mkdirSync("data/local", { recursive: true });
writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(
  `[benchmark:export] ${rows.length} unlabeled candidates written to ${OUT} ` +
    `(known=${known.size}, ledger=${ledger.length})`,
);
