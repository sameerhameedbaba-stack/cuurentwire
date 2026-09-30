#!/usr/bin/env node
/**
 * Tell IndexNow (Bing, Yandex, Seznam, Naver…) about new or updated pages on
 * the static site. Runs after each GitHub Pages deploy. $0, no account — the
 * key file is already served at /<key>.txt.
 *
 *   node scripts/indexnow-ping.mjs [--days N] [--dry-run]
 *
 * WHY: IndexNow is how new pages reach Bing within minutes, and Bing's index
 * feeds ChatGPT search, Copilot and DuckDuckGo — the first channel in the
 * 2026-09-01 strategy shift. The aggregator pinged it from its cron; the
 * static site has no cron, so the deploy does it instead.
 *
 * WHAT IT SUBMITS: pages whose sitemap <lastmod> is within the last N days
 * (default 2), plus the home page and /articles when anything qualifies.
 * Resubmitting unchanged URLs every deploy is discouraged by IndexNow, so an
 * unchanged site submits nothing.
 *
 * SAFETY: it reads the LIVE sitemap and first confirms that currentwire.us is
 * actually serving the static site (the cw-site marker). Before the DNS
 * switch the domain still answers 402 from Vercel, and telling search engines
 * to fetch URLs that fail would teach them the site is broken. In that case
 * it exits 0 having submitted nothing — "not yet" is not a failure.
 *
 * Mirrors lib/seo/indexnow.ts (endpoint, key, payload), which this plain-node
 * script cannot import.
 */

/** The origin every submitted URL, the host and the key location belong to. */
const ORIGIN = "https://currentwire.us";
/**
 * Where to READ the home page and sitemap from. Overridable only for a local
 * dry run against a copy of the site; submissions always use ORIGIN, because
 * IndexNow rejects a list whose URLs do not all match its host.
 */
const SITE = (process.env.INDEXNOW_SITE_URL ?? ORIGIN).replace(/\/$/, "");
const KEY = "d67fe7ac1896e8fd9e691a2d2abeca89";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const UA = "CurrentWire-IndexNow/1.0";

const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg >= 0 ? Number(process.argv[daysArg + 1]) : 2;
const DRY_RUN = process.argv.includes("--dry-run");

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  return { status: res.status, body: await res.text() };
}

const home = await get(`${SITE}/`).catch((error) => ({ status: 0, body: String(error) }));
if (home.status !== 200 || !home.body.includes('name="cw-site" content="static"')) {
  console.log(
    `indexnow: skipped — ${SITE} is not serving the static site yet (HTTP ${home.status}). ` +
      "Nothing submitted; this is expected before the DNS switch.",
  );
  process.exit(0);
}

const sitemap = await get(`${SITE}/sitemap.xml`);
if (sitemap.status !== 200) {
  console.error(`indexnow: sitemap.xml answered ${sitemap.status}`);
  process.exit(1);
}

const cutoff = Date.now() - DAYS * 86_400_000;
const recent = [];
for (const [, block] of sitemap.body.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
  const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim();
  if (!loc || !lastmod) continue;
  if (Date.parse(lastmod) >= cutoff && loc.startsWith(ORIGIN)) recent.push(loc);
}

if (recent.length === 0) {
  console.log(`indexnow: nothing changed in the last ${DAYS} day(s) — nothing submitted.`);
  process.exit(0);
}

const urlList = [...new Set([`${ORIGIN}/`, `${ORIGIN}/articles`, ...recent])];
const body = {
  host: new URL(ORIGIN).host,
  key: KEY,
  keyLocation: `${ORIGIN}/${KEY}.txt`,
  urlList,
};

console.log(`indexnow: ${urlList.length} URL(s):\n  ${urlList.join("\n  ")}`);
if (DRY_RUN) {
  console.log("indexnow: --dry-run, not submitted.");
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8", "User-Agent": UA },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
});
// 200 = accepted, 202 = accepted pending key validation. Anything else is a
// real rejection worth a red run — but a red IndexNow run must never be
// mistaken for a failed deploy, so the workflow runs this with
// continue-on-error.
if (res.status === 200 || res.status === 202) {
  console.log(`indexnow: submitted (HTTP ${res.status}).`);
} else {
  console.error(`indexnow: rejected (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
