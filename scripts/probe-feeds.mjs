#!/usr/bin/env node
/**
 * Feed probe: fetch candidate RSS/Atom feeds in parallel and report whether
 * each is alive, fresh, image-bearing and description-bearing — the facts
 * needed before a feed earns a place in config/feeds.ts.
 *
 * Usage: node scripts/probe-feeds.mjs [urls.txt]   (one URL per line; "#" comments)
 * Output: a table on stdout + JSON at data/local/feed-probe.json (gitignored).
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const listPath = process.argv[2] ?? "data/local/feed-candidates.txt";
const urls = readFileSync(listPath, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

function firstTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^]*?)</${tag}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
}

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "CurrentWire/1.0 (news aggregator; feed probe)" },
      redirect: "follow",
    });
    const ms = Date.now() - started;
    if (!res.ok) return { url, ok: false, status: res.status, ms };
    const xml = await res.text();
    const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
    const items = isAtom
      ? xml.split(/<entry[\s>]/i).slice(1)
      : xml.split(/<item[\s>]/i).slice(1);
    const channelTitle = firstTag(xml.split(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)[0] ?? "", "title");
    let withImage = 0, withDesc = 0, newest = 0;
    const titles = [];
    for (const item of items) {
      if (/<media:content|<media:thumbnail|<enclosure[^>]+type="image|<img\s|<image>/i.test(item)) withImage++;
      const desc = firstTag(item, "description") ?? firstTag(item, "summary") ?? firstTag(item, "content:encoded") ?? firstTag(item, "content");
      if (desc && desc.replace(/<[^>]+>/g, "").trim().length > 40) withDesc++;
      const dateStr = firstTag(item, "pubDate") ?? firstTag(item, "published") ?? firstTag(item, "updated") ?? firstTag(item, "dc:date");
      const t = dateStr ? Date.parse(dateStr) : NaN;
      if (!Number.isNaN(t) && t > newest) newest = t;
      if (titles.length < 2) { const tt = firstTag(item, "title"); if (tt) titles.push(tt.slice(0, 70)); }
    }
    const ageH = newest ? Math.round((Date.now() - newest) / 36e5) : null;
    return {
      url, ok: true, status: res.status, ms, channelTitle, items: items.length,
      withImage, withDesc, newestAgeHours: ageH, sampleTitles: titles,
      finalUrl: res.url !== url ? res.url : undefined,
    };
  } catch (error) {
    return { url, ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - started };
  }
}

const results = await Promise.all(urls.map(probe));
mkdirSync("data/local", { recursive: true });
writeFileSync("data/local/feed-probe.json", JSON.stringify(results, null, 2));

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
console.log(pad("OK", 3), pad("items", 5), pad("img", 4), pad("desc", 4), pad("ageH", 5), pad("ms", 5), "url  |  channel  |  sample");
for (const r of results) {
  if (!r.ok) { console.log(pad("NO", 3), pad("-", 5), pad("-", 4), pad("-", 4), pad("-", 5), pad(r.ms, 5), r.url, " | ", r.status ?? r.error); continue; }
  console.log(pad("ok", 3), pad(r.items, 5), pad(r.withImage, 4), pad(r.withDesc, 4), pad(r.newestAgeHours ?? "?", 5), pad(r.ms, 5), r.url, " | ", r.channelTitle, " | ", r.sampleTitles[0]);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} feeds alive`);
