#!/usr/bin/env node
/**
 * Daily SEO health check for the STATIC site (GitHub Pages, production since
 * 2026-09-28). Zero dependencies, zero keys, $0. Fails loudly on any
 * regression so .github/workflows/seo-health.yml opens an alert issue.
 *
 *   node scripts/seo-health-static.mjs
 *   SEO_BASE_URL=http://127.0.0.1:8766 node scripts/seo-health-static.mjs
 *
 * WHY A NEW SCRIPT. scripts/seo-health.mjs checks the aggregator: the news and
 * archive sitemaps, /api/stats, per-section /rss feeds, /top-100 image weight.
 * None of those exist on the static site, so it would fail every day forever
 * and the alert would stop meaning anything. It is kept, untouched, for the
 * dormant Vercel app.
 *
 * WHAT IT CHECKS — the things that decide whether Google and readers can use
 * the site, measured on the served output, not on the build:
 *   1. robots.txt allows crawling and advertises the sitemap.
 *   2. sitemap.xml parses, lists articles, and EVERY listed URL answers 200.
 *   3. rss.xml carries items that link to articles.
 *   4. llms.txt and the IndexNow key file are served (Bing/AI discovery).
 *   5. Every article: indexable, self-canonical, NewsArticle JSON-LD that
 *      parses and names author/publisher/sources, the AI-assistance notice,
 *      and at least two publication links.
 *   6. The home page: indexable, organisation JSON-LD, the static marker.
 *   7. An unknown URL is a real 404, and a retired /story/ URL is too.
 *   8. www and http redirect to the https apex (production only).
 */

const BASE = (process.env.SEO_BASE_URL ?? "https://currentwire.us").replace(/\/$/, "");
const IS_PRODUCTION = BASE === "https://currentwire.us";
const INDEXNOW_KEY = "d67fe7ac1896e8fd9e691a2d2abeca89";
const UA = "CurrentWire-SEO-Health/2.0 (static)";

const failures = [];
const ok = (name, detail = "") => console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => {
  failures.push(name);
  console.error(`FAIL ${name}: ${detail}`);
};

async function get(path, init = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    ...init,
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, body: await res.text(), url: res.url, headers: res.headers };
}

/** Production URLs in the sitemap map onto BASE when testing a local copy. */
function localise(url) {
  return url.replace(/^https:\/\/currentwire\.us/, BASE);
}

function jsonLd(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      blocks.push({ __parseError: String(error) });
    }
  }
  return blocks;
}

function robotsMeta(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
}

function canonical(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
}

// 1. robots.txt
const robots = await get("/robots.txt");
if (robots.status !== 200) fail("robots.txt", `HTTP ${robots.status}`);
else if (/Disallow:\s*\/\s*$/m.test(robots.body)) fail("robots.txt", "disallows the whole site");
else if (!robots.body.includes("/sitemap.xml")) fail("robots.txt", "does not advertise /sitemap.xml");
else ok("robots.txt", "allows crawling, advertises sitemap.xml");

// 2. sitemap.xml — and every URL in it
const sitemap = await get("/sitemap.xml");
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const articleUrls = locs.filter((loc) => /\/article\/[a-z0-9-]+$/.test(loc));
if (sitemap.status !== 200) fail("sitemap.xml", `HTTP ${sitemap.status}`);
else if (locs.length === 0) fail("sitemap.xml", "no <loc> entries");
else if (articleUrls.length === 0) fail("sitemap.xml", "lists no articles");
else {
  const offHost = locs.filter((loc) => !loc.startsWith("https://currentwire.us"));
  if (offHost.length > 0) fail("sitemap.xml", `${offHost.length} URL(s) not on https://currentwire.us, e.g. ${offHost[0]}`);
  else ok("sitemap.xml", `${locs.length} URLs, ${articleUrls.length} articles`);

  // A sitemap URL that does not answer 200 is a crawl error charged to the
  // domain. The site is small; check every one.
  const bad = [];
  for (const loc of locs) {
    const r = await get(localise(loc));
    if (r.status !== 200) bad.push(`${loc} -> ${r.status}`);
  }
  if (bad.length > 0) fail("sitemap URLs", `${bad.length} not 200: ${bad.slice(0, 3).join("; ")}`);
  else ok("sitemap URLs", `all ${locs.length} answer 200`);
}

// 3. rss.xml
const rss = await get("/rss.xml");
const items = [...rss.body.matchAll(/<item>([\s\S]*?)<\/item>/g)];
if (rss.status !== 200) fail("rss.xml", `HTTP ${rss.status}`);
else if (items.length === 0) fail("rss.xml", "no items");
else if (!items.every(([, xml]) => /<link>[^<]*\/article\/[^<]+<\/link>/.test(xml))) {
  fail("rss.xml", "an item does not link to an article");
} else ok("rss.xml", `${items.length} items, all linking to articles`);

// 4. llms.txt and IndexNow key
const llms = await get("/llms.txt");
if (llms.status !== 200 || llms.body.trim().length < 100) fail("llms.txt", `HTTP ${llms.status}, ${llms.body.length} bytes`);
else ok("llms.txt");
const key = await get(`/${INDEXNOW_KEY}.txt`);
if (key.status !== 200 || key.body.trim() !== INDEXNOW_KEY) fail("IndexNow key", `HTTP ${key.status}`);
else ok("IndexNow key", "served, matches");

// 5. Every article
for (const url of articleUrls) {
  const page = await get(localise(url));
  const name = `article ${url.replace(/^.*\/article\//, "")}`;
  if (page.status !== 200) {
    fail(name, `HTTP ${page.status}`);
    continue;
  }
  const problems = [];
  if (/noindex/.test(robotsMeta(page.body))) problems.push("noindex");
  if (canonical(page.body) !== url) problems.push(`canonical is ${canonical(page.body) || "missing"}`);
  const article = jsonLd(page.body).find((block) => block["@type"] === "NewsArticle");
  if (!article) problems.push("no NewsArticle JSON-LD");
  else {
    if (article.__parseError) problems.push(`JSON-LD does not parse: ${article.__parseError}`);
    for (const field of ["headline", "datePublished", "author", "publisher", "isBasedOn"]) {
      if (!article[field]) problems.push(`JSON-LD missing ${field}`);
    }
    if (Array.isArray(article.isBasedOn) && article.isBasedOn.length < 2) {
      problems.push(`JSON-LD isBasedOn lists ${article.isBasedOn.length} publication(s)`);
    }
  }
  if (!page.body.includes("Written with AI assistance")) problems.push("AI-assistance notice missing");
  const outbound = [...page.body.matchAll(/href="(https?:\/\/[^"]+)"[^>]*rel="nofollow noopener"/g)]
    .map((m) => new URL(m[1]).hostname)
    .filter((host) => !host.endsWith("currentwire.us"));
  if (new Set(outbound).size < 2) problems.push(`links ${new Set(outbound).size} distinct publication(s)`);
  if (problems.length > 0) fail(name, problems.join("; "));
  else ok(name, "indexable, canonical, JSON-LD, disclosure, sourced");
}

// 6. Home page
const home = await get("/");
if (home.status !== 200) fail("home", `HTTP ${home.status}`);
else {
  const problems = [];
  if (/noindex/.test(robotsMeta(home.body))) problems.push("noindex");
  if (!home.body.includes('name="cw-site" content="static"')) problems.push("static-site marker missing");
  if (!jsonLd(home.body).some((b) => b["@type"] === "NewsMediaOrganization")) problems.push("no NewsMediaOrganization JSON-LD");
  if (home.body.includes("Demo data notice")) problems.push("demo banner rendered");
  if (problems.length > 0) fail("home", problems.join("; "));
  else ok("home", "indexable, organisation JSON-LD, static marker");
}

// 7. Real 404s — including the retired /story/ corpus.
for (const path of ["/zz-definitely-not-a-page-zz", "/story/retired-story-cf03400ab04ec"]) {
  const r = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (r.status !== 404) fail(`404 ${path}`, `returned ${r.status} (a soft 404 is a quality signal against the domain)`);
  else ok(`404 ${path}`, "real 404");
}

// 8. Canonical host and scheme — only meaningful against production.
if (IS_PRODUCTION) {
  for (const [label, url] of [
    ["www redirect", "https://www.currentwire.us/"],
    ["https redirect", "http://currentwire.us/"],
  ]) {
    try {
      const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
      const location = r.headers.get("location") ?? "";
      if (r.status >= 300 && r.status < 400 && location.startsWith("https://currentwire.us")) {
        ok(label, `${r.status} -> ${location}`);
      } else fail(label, `${url} answered ${r.status}${location ? ` -> ${location}` : ""}, not a redirect to https://currentwire.us`);
    } catch (error) {
      console.log(`note ${label} skipped: ${error.message}`);
    }
  }
}

console.log(
  failures.length === 0
    ? "\nSEO health (static): ALL CHECKS PASSED"
    : `\nSEO health (static): ${failures.length} FAILURE(S): ${failures.join(", ")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
