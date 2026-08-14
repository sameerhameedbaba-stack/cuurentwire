#!/usr/bin/env node
/**
 * Daily deterministic SEO health check for currentwire.us.
 * Zero dependencies, zero keys, $0 — runs in GitHub Actions on a schedule
 * (.github/workflows/seo-health.yml) and fails loudly on any regression so
 * the repo owner gets GitHub's failure email without doing anything.
 *
 * Checks: robots.txt, all three sitemaps, news-sitemap freshness window,
 * RSS + per-section feeds, llms.txt, the IndexNow key file, a sampled story
 * page (canonical + parseable NewsArticle JSON-LD), the home page
 * (NewsMediaOrganization + large-preview robots directive), and real-404
 * behavior.
 */

const BASE = process.env.SEO_BASE_URL ?? "https://currentwire.us";
const INDEXNOW_KEY = "d67fe7ac1896e8fd9e691a2d2abeca89";
const NEWS_WINDOW_HOURS = 49; // 48h window + 1h grace for clock/emit skew
const FEEDS = [
  "us", "canada", "politics", "business", "technology", "world",
  "climate", "health", "science", "culture", "sports",
];

const failures = [];
const ok = (name, detail = "") =>
  console.log(`ok   ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => {
  failures.push(name);
  console.error(`FAIL ${name}: ${detail}`);
};

async function get(path) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "CurrentWire-SEO-Health/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, body: await res.text(), url: res.url };
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      blocks.push({ __parseError: true });
    }
  }
  return blocks;
}

// 1. robots.txt
const robots = await get("/robots.txt");
if (robots.status !== 200 || !robots.body.includes("Sitemap:")) {
  fail("robots.txt", `status ${robots.status}, sitemap line ${robots.body.includes("Sitemap:")}`);
} else ok("robots.txt", "200 with Sitemap lines");

// 2. sitemap.xml + spot-check listed URLs
const sitemap = await get("/sitemap.xml");
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (sitemap.status !== 200 || locs.length < 20) {
  fail("sitemap.xml", `status ${sitemap.status}, ${locs.length} URLs`);
} else {
  ok("sitemap.xml", `${locs.length} URLs`);
  const offHost = locs.filter((u) => !u.startsWith(BASE));
  if (offHost.length) fail("sitemap host", `${offHost.length} off-host URLs e.g. ${offHost[0]}`);
  const sample = [locs[0], locs[Math.floor(locs.length / 2)], locs[locs.length - 1]];
  for (const u of sample) {
    const r = await get(u);
    if (r.status !== 200) fail("sitemap URL", `${u} -> ${r.status}`);
  }
  ok("sitemap sample", `${sample.length} URLs return 200`);
}

// 3. news-sitemap.xml: valid, non-empty, all dates inside the window
const news = await get("/news-sitemap.xml");
if (news.status !== 200 || !news.body.includes("sitemap-news/0.9")) {
  fail("news-sitemap.xml", `status ${news.status}, namespace missing`);
} else {
  const dates = [...news.body.matchAll(/<news:publication_date>([^<]+)</g)].map((m) => m[1]);
  const count = (news.body.match(/<url>/g) ?? []).length;
  if (count === 0) fail("news-sitemap empty", "0 entries — data pipeline outage?");
  else if (count > 1000) fail("news-sitemap size", `${count} entries > 1000 limit`);
  else {
    const cutoff = Date.now() - NEWS_WINDOW_HOURS * 3_600_000;
    const stale = dates.filter((d) => new Date(d).getTime() < cutoff);
    if (stale.length) fail("news-sitemap freshness", `${stale.length} entries older than ${NEWS_WINDOW_HOURS}h e.g. ${stale[0]}`);
    else ok("news-sitemap.xml", `${count} entries, all within ${NEWS_WINDOW_HOURS}h`);
  }
}

// 4. archive-sitemap.xml: valid urlset (empty only if DB is down, still 200)
const archive = await get("/archive-sitemap.xml");
const archiveCount = (archive.body.match(/<url>/g) ?? []).length;
if (archive.status !== 200 || !archive.body.includes("</urlset>")) {
  fail("archive-sitemap.xml", `status ${archive.status}`);
} else if (archiveCount === 0) {
  fail("archive-sitemap empty", "0 entries — archive DB unreachable?");
} else ok("archive-sitemap.xml", `${archiveCount} permanent story URLs`);

// 5. RSS feeds
const rss = await get("/rss");
if (rss.status !== 200 || !rss.body.includes("<item>")) {
  fail("/rss", `status ${rss.status}, has items ${rss.body.includes("<item>")}`);
} else ok("/rss", "valid with items");
for (const feed of FEEDS) {
  const r = await get(`/rss/${feed}`);
  if (r.status !== 200 || !r.body.includes("<rss")) fail(`/rss/${feed}`, `status ${r.status}`);
}
ok("category feeds", `${FEEDS.length} checked`);

// 6. llms.txt + IndexNow key file
const llms = await get("/llms.txt");
if (llms.status !== 200 || !llms.body.includes("# CurrentWire")) {
  fail("llms.txt", `status ${llms.status}`);
} else ok("llms.txt", "served");
const keyFile = await get(`/${INDEXNOW_KEY}.txt`);
if (keyFile.status !== 200 || keyFile.body.trim() !== INDEXNOW_KEY) {
  fail("indexnow key file", `status ${keyFile.status}`);
} else ok("indexnow key file", "served");

// 7. Sampled story page: canonical + valid NewsArticle JSON-LD
const storyUrl = locs.find((u) => u.includes("/story/"));
if (!storyUrl) fail("story sample", "no /story/ URL in sitemap.xml");
else {
  const story = await get(storyUrl);
  const canonical = story.body.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical !== storyUrl) fail("story canonical", `${canonical} != ${storyUrl}`);
  const blocks = extractJsonLd(story.body);
  if (blocks.some((b) => b.__parseError)) fail("story JSON-LD parse", storyUrl);
  const article = blocks.find((b) => b["@type"] === "NewsArticle");
  if (!article) fail("story NewsArticle", `missing on ${storyUrl}`);
  else {
    const missing = ["headline", "datePublished", "dateModified", "image", "author", "publisher", "isBasedOn"]
      .filter((k) => article[k] === undefined);
    if (missing.length) fail("story NewsArticle fields", `missing ${missing.join(",")}`);
    else if (new Date(article.dateModified) < new Date(article.datePublished)) {
      fail("story dates", `dateModified ${article.dateModified} < datePublished ${article.datePublished}`);
    } else ok("story page", "canonical + complete NewsArticle with sane dates");
  }
}

// 8. Home page: NewsMediaOrganization + large image previews
const home = await get("/");
const homeBlocks = extractJsonLd(home.body);
if (!homeBlocks.some((b) => b["@type"] === "NewsMediaOrganization")) {
  fail("home NewsMediaOrganization", "block missing");
} else ok("home NewsMediaOrganization", "present");
if (!home.body.includes("max-image-preview:large")) {
  fail("home robots directive", "max-image-preview:large missing");
} else ok("home robots directive", "max-image-preview:large");
const homeCanonical = home.body.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (!homeCanonical || homeCanonical.replace(/\/$/, "") !== BASE.replace(/\/$/, "")) {
  fail("home canonical", `got ${homeCanonical}`);
} else ok("home canonical", homeCanonical);

// 9. Real 404 behavior
const missing404 = await fetch(`${BASE}/zz-definitely-not-a-page-zz`, {
  headers: { "User-Agent": "CurrentWire-SEO-Health/1.0" },
  signal: AbortSignal.timeout(30_000),
});
if (missing404.status !== 404) fail("404 behavior", `garbage URL returned ${missing404.status}`);
else ok("404 behavior", "real 404");

// 10. www host redirects to apex (after the next.config redirect deploys)
try {
  const www = await fetch("https://www.currentwire.us/", {
    redirect: "manual",
    headers: { "User-Agent": "CurrentWire-SEO-Health/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (www.status >= 300 && www.status < 400) {
    ok("www redirect", `${www.status} -> ${www.headers.get("location")}`);
  } else fail("www redirect", `www serves ${www.status} instead of redirecting to apex`);
} catch (e) {
  console.log(`note www check skipped: ${e.message}`);
}

console.log(failures.length === 0
  ? "\nSEO health: ALL CHECKS PASSED"
  : `\nSEO health: ${failures.length} FAILURE(S): ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
