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
 * (NewsMediaOrganization + large-preview robots directive), publisher image
 * weight on /top-100, and real-404 behavior.
 */

const BASE = process.env.SEO_BASE_URL ?? "https://currentwire.us";
const INDEXNOW_KEY = "d67fe7ac1896e8fd9e691a2d2abeca89";
const NEWS_WINDOW_HOURS = 49; // 48h window + 1h grace for clock/emit skew
/** Sitemaps cap at 50,000 URLs — alarm with runway, not at the cliff. */
const ARCHIVE_SHARD_AT = 45_000;
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
  return {
    status: res.status,
    body: await res.text(),
    url: res.url,
    headers: res.headers,
  };
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
} else if (archiveCount > ARCHIVE_SHARD_AT) {
  // Sitemaps cap at 50,000 URLs. Sharding via generateSitemaps is years away
  // at the current rate, so instead of leaving "shard it someday" on a human
  // to-do list, this alarm fires with ~5,000 URLs of runway.
  fail(
    "archive-sitemap size",
    `${archiveCount} URLs > ${ARCHIVE_SHARD_AT} — shard /archive-sitemap.xml with generateSitemaps before it hits the 50,000 cap`,
  );
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
  // Compare against the URL we actually landed on, not the sitemap entry.
  // A story's slug is built from its LEAD article's headline, and pickLead()
  // re-selects the lead on every refresh — so when a higher-tier publisher
  // joins a cluster the slug changes and the old URL 307s to the new one
  // (that redirect is the URL-permanence guarantee working). If that happens
  // between this script's sitemap fetch and its story fetch, comparing to the
  // sitemap URL fails on correct behaviour. Observed live 2026-08-19.
  if (canonical !== story.url) {
    fail("story canonical", `${canonical} != ${story.url}`);
  } else if (story.url !== storyUrl) {
    // Not a failure — but a sitemap should advertise canonical URLs, so a
    // persistent mismatch here is worth seeing in the log.
    ok("story canonical", `${canonical} (sitemap listed a pre-rename slug)`);
  }
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

// 7b. Story pages must be ISR-cached, not server-rendered per request.
// A dynamic route segment only gets ISR when the page exports
// generateStaticParams — `export const revalidate` alone is silently inert
// (Next 16). That failure is invisible in source review and cost the site
// CDN caching on every story, topic, source and archive-day URL until
// 2026-08-19. Only the response headers reveal it, so check them here.
if (storyUrl) {
  const cached = await get(storyUrl);
  const cacheControl = cached.headers.get("cache-control") ?? "";
  const prerender = cached.headers.get("x-nextjs-prerender");
  if (/no-store/.test(cacheControl) || prerender !== "1") {
    fail(
      "story ISR caching",
      `cache-control "${cacheControl}", x-nextjs-prerender "${prerender}" — ISR is off; does the route still export generateStaticParams?`,
    );
  } else ok("story ISR caching", `prerendered, ${cacheControl}`);
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
// 8b. Font preloads: next/font injects exactly one per preloaded subset.
// A hand-rolled block in app/layout.tsx duplicated them (4 links for 2 files,
// measured 2026-08-19) and was removed — so this asserts both directions:
// at least the two Next emits, and no href twice.
const fontPreloads = [
  ...home.body.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g),
].map((m) => m[0].match(/href="([^"]+)"/)?.[1] ?? "");
const uniqueFontPreloads = new Set(fontPreloads);
if (fontPreloads.length < 2) {
  fail(
    "font preloads",
    `${fontPreloads.length} on the home page — next/font should inject one per preloaded subset`,
  );
} else if (uniqueFontPreloads.size !== fontPreloads.length) {
  fail(
    "font preloads duplicated",
    `${fontPreloads.length} links for ${uniqueFontPreloads.size} files — is a hand-rolled preload block back in app/layout.tsx?`,
  );
} else ok("font preloads", `${fontPreloads.length}, no duplicates`);

const homeCanonical = home.body.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
if (!homeCanonical || homeCanonical.replace(/\/$/, "") !== BASE.replace(/\/$/, "")) {
  fail("home canonical", `got ${homeCanonical}`);
} else ok("home canonical", homeCanonical);

// 8c. E-E-A-T pages must be machine-readable, not merely crawlable. All six
// shipped ZERO JSON-LD blocks until 2026-08-19.
const TRUST_PAGES = {
  "/about": "AboutPage",
  "/methodology": "WebPage",
  "/editorial-standards": "WebPage",
  "/corrections": "WebPage",
  "/contact": "ContactPage",
  "/topics": "CollectionPage",
};
let trustOk = 0;
for (const [path, expected] of Object.entries(TRUST_PAGES)) {
  const page = await get(path);
  const blocks = extractJsonLd(page.body);
  if (blocks.some((b) => b.__parseError)) {
    fail("trust page JSON-LD parse", path);
  } else if (!blocks.some((b) => b["@type"] === expected)) {
    fail(
      "trust page JSON-LD",
      `${path} has no ${expected} block (found ${blocks.map((b) => b["@type"]).join(",") || "none"})`,
    );
  } else trustOk += 1;
}
if (trustOk === Object.keys(TRUST_PAGES).length) {
  ok("trust page JSON-LD", `${trustOk} pages typed and parsing`);
}

// 8d. Publisher image weight. Ranked-list images come straight from publisher
// CDNs — `images.unoptimized` is set, so nothing resizes them on our side and
// the only lever is the per-host rules in lib/news/normalization/image-upgrade.
// Before those rules, /top-100 carried 28 MB of images across 25 files, with a
// single NPR original at 6,366 KB and a Politico one at 4,944 KB, and the
// homepage LCP swung 3,632 -> 8,556 ms on nothing but which story was hero
// (measured 2026-08-19). This check is what keeps "unbounded" bounded: it
// fails when a host we DO cap comes back oversized, which is what a silently
// broken rewrite rule looks like from the outside.
const CAPPED_HOSTS = [
  /^ichef\.bbci\.co\.uk$/,
  /^assets\d+\.cbsnewsstatic\.com$/,
  /^npr\.brightspotcdn\.com$/,
  /^globalnews\.ca$/,
  /^platform\.theverge\.com$/,
  /^thehill\.com$/,
];
/** A capped host over this is a broken rule, not a big photo. */
const CAPPED_MAX_KB = 500;
/** Uncapped hosts over this are reported, not failed — we have no lever. */
const UNCAPPED_REPORT_KB = 1024;
/** Bound the runtime; the ranked list repeats the same hosts after this. */
const IMAGE_SAMPLE = 15;

const top100 = await get("/top-100");
const imageUrls = [
  ...new Set(
    [...top100.body.matchAll(/<img[^>]+src="(https:\/\/[^"]+)"/g)]
      .map((m) => m[1].replaceAll("&amp;", "&"))
      .filter((u) => !u.startsWith(BASE)),
  ),
].slice(0, IMAGE_SAMPLE);

if (imageUrls.length === 0) {
  fail("publisher image weight", "no publisher images found on /top-100");
} else {
  const measured = [];
  for (const url of imageUrls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const declared = Number(res.headers.get("content-length"));
      const bytes = Number.isFinite(declared) && declared > 0
        ? declared
        : (await res.arrayBuffer()).byteLength;
      measured.push({
        host: new URL(url).hostname,
        kb: Math.round(bytes / 1024),
        type: res.headers.get("content-type") ?? "",
        url,
      });
    } catch (e) {
      // A publisher CDN refusing our fetch is their problem, not a regression.
      console.log(`note image unreachable: ${new URL(url).hostname} (${e.message})`);
    }
  }
  const capped = measured.filter((m) => CAPPED_HOSTS.some((re) => re.test(m.host)));
  const overCap = capped.filter((m) => m.kb > CAPPED_MAX_KB);
  // We drop .bmp/.tif at ingest (a live 6,221 KB bitmap, 2026-08-19) — one
  // arriving here means that drop stopped working.
  const undeliverable = measured.filter((m) => /bmp|tiff/.test(m.type));
  if (overCap.length) {
    fail(
      "publisher image weight",
      `${overCap.length} image(s) from capped hosts over ${CAPPED_MAX_KB} KB — is the per-host rule in lib/news/normalization/image-upgrade.ts still matching? e.g. ${overCap[0].kb} KB ${overCap[0].url}`,
    );
  } else if (undeliverable.length) {
    fail(
      "publisher image format",
      `${undeliverable.length} undeliverable format(s) served — the ingest drop regressed: ${undeliverable[0].url}`,
    );
  } else {
    const sorted = [...measured].map((m) => m.kb).sort((a, b) => a - b);
    const total = sorted.reduce((a, b) => a + b, 0);
    ok(
      "publisher image weight",
      `${measured.length} images, ${total} KB total, median ${sorted[Math.floor(sorted.length / 2)]} KB, max ${sorted.at(-1)} KB`,
    );
  }
  for (const m of measured) {
    if (m.kb > UNCAPPED_REPORT_KB && !CAPPED_HOSTS.some((re) => re.test(m.host))) {
      // Reported, never failed: no free resize lever exists for these hosts,
      // and a gate nobody can turn green is a gate everyone learns to ignore.
      console.log(`note no resize lever for ${m.host} — ${m.kb} KB on /top-100`);
    }
  }
}

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
