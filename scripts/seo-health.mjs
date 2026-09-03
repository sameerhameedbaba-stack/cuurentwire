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
/**
 * How old the NEWEST news-sitemap entry may be before the publishing
 * pipeline is considered stalled.
 *
 * Each entry's <news:publication_date> is the archive's first_seen_at
 * (lib/seo/news-sitemap.ts), and the sitemap lists only clusters the
 * archive already holds — so the newest date is a direct read of the last
 * successful database write burst. persist-gate.ts caps that gap at
 * ~30 minutes by design. Measured 2026-08-26: writes stopped at 07:31 UTC
 * and nothing noticed for 14 hours while every surface answered 200, the
 * dataset stayed fresh and the feed quietly shrank 643 -> 132 entries.
 * Four hours is eight missed bursts — far outside normal jitter, and still
 * loose enough that a quiet news hour cannot cry wolf.
 */
const NEWS_STALL_HOURS = 4;
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

/**
 * Fetch that retries once on a TRANSPORT error (DNS hiccup, dropped socket,
 * connection reset) — never on an HTTP status.
 *
 * A thrown fetch is a fact about the prober's network, not about the site,
 * and treating one as a site regression makes this check cry wolf: on
 * 2026-08-26 exactly 1 of 743 news-sitemap URLs threw `TypeError: fetch
 * failed` while the same URL answered 200 three times seconds later, and
 * that alone turned the whole run red. A false red is expensive here —
 * the daily loop treats any seo-health failure as its top priority, so a
 * blip costs a whole run and erodes trust in the alert that exists to catch
 * real outages.
 *
 * Retrying does NOT hide an outage: when the origin is genuinely down every
 * attempt throws, so the retry throws too and the caller still records the
 * failure. It only absorbs the single-URL blip.
 *
 * Each attempt gets its OWN timeout signal. Reusing one `AbortSignal.timeout`
 * across both attempts would leave the retry pre-aborted whenever the first
 * attempt was the thing that timed out — the retry would return instantly
 * without touching the network, which is not a retry at all.
 */
async function fetchWithRetry(url, init = {}, timeoutMs = 30_000) {
  const attempt = () =>
    fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  try {
    return await attempt();
  } catch (first) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    try {
      return await attempt();
    } catch {
      throw first;
    }
  }
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
    // Newest entry = last successful archive write (see NEWS_STALL_HOURS).
    const newest = dates
      .map((d) => new Date(d).getTime())
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (newest === undefined) {
      fail("news-sitemap stall", "no parseable publication_date to age");
    } else {
      const ageHours = (Date.now() - newest) / 3_600_000;
      if (ageHours > NEWS_STALL_HOURS) {
        fail(
          "news-sitemap stall",
          `newest entry is ${ageHours.toFixed(1)}h old (limit ${NEWS_STALL_HOURS}h) — ` +
            `the archive write burst has stopped; new stories are being published ` +
            `with no permanent row and Google News is being fed a shrinking feed`,
        );
      } else {
        ok("news-sitemap stall guard", `newest entry ${ageHours.toFixed(1)}h old`);
      }
    }
  }
}

// 3b. Every news-sitemap URL must answer 200 DIRECTLY. Googlebot-News
// fetches this sitemap within minutes of publication and judges the whole
// feed by what the listed URLs answer — and on 2026-08-24 it could have
// been handed both failure shapes: a story advertised before the batched
// persist archived it answered the deliberate retriable 500 for up to
// ~30 minutes, and a merged story answered 308 to the survivor. The
// generator now gates entries on archive standing (lib/seo/news-sitemap.ts),
// so anything caught here is that gate regressing — or failing open during
// an archive outage, which the archive-sitemap check below already flags.
//
// One redirect shape is a benign race, not a regression: a slug rename
// between our sitemap fetch and this check redirects WITHIN the same
// trailing cluster-id token to a 200 (the same race check 7 documents).
// Reported, never failed. A redirect whose target carries a DIFFERENT id
// token means the sitemap advertised a merged/non-canonical story: fail.
//
// A cross-id redirect has its own short-lived race, measured 2026-08-27
// right after the archive write burst was repaired: a cluster archived at
// 17:30 was merged into another at 17:33, and the sitemap kept advertising
// the pre-merge entry until the archive-standing query's cache caught up —
// 9 of the first 400 entries at 17:45, 0 of them two minutes later. That is
// a window, not a regression, and failing on it would hand the daily gate a
// false red roughly every time it ran within a couple of minutes of a
// burst. So a failure is re-checked once after MERGE_RACE_RECHECK_MS
// against a FRESH sitemap: an entry that is no longer advertised, or that
// now answers 200 directly, was a race. Anything still advertised and still
// not answering fails, exactly as before — a real outage cannot heal this
// way, because the URL stays listed and stays broken.
if (news.status === 200) {
  const newsLocs = [...news.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const idToken = (u) => {
    const path = new URL(u).pathname;
    return path.slice(path.lastIndexOf("-") + 1);
  };
  const NEWS_URL_CONCURRENCY = 10;
  /** How long to let a merge/rename race settle before believing a failure. */
  const MERGE_RACE_RECHECK_MS = 90_000;
  /**
   * How many merged-but-still-advertised entries the 30-minute archive
   * standing cache can explain before the count itself is the story. A
   * handful of the ~700 entries is the documented window; dozens would mean
   * the gate is not working at all, and that must stay a failure.
   */
  const MERGE_LAG_TOLERANCE = 10;
  const bad = [];
  const renames = [];
  const MAX_HOPS = 6;
  const checkNewsUrl = async (u, bad, renames) => {
    try {
      // Follow the chain BY HAND rather than with redirect:"follow".
      // A redirect cycle makes undici throw a bare `TypeError: fetch failed`
      // whose cause ("redirect count exceeded") never reaches the log, so a
      // real crawl-breaking loop was reported for days as an unreadable
      // transport error — measured 2026-08-26 on a live news-sitemap URL
      // whose two slugs 307 to each other forever. Chasing hop by hop lets
      // the failure name itself.
      const chain = [u];
      let current = u;
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        const res = await fetchWithRetry(current, {
          redirect: "manual",
          headers: { "User-Agent": "CurrentWire-SEO-Health/1.0" },
        });
        if (res.status === 200) {
          if (current === u) return;
          if (idToken(current) === idToken(u)) return renames.push(`${u} -> ${current}`);
          return bad.push({
            url: u,
            detail: `${chain.length - 1} redirect(s) -> ${current} (different story id — a merged or non-canonical URL is advertised)`,
          });
        }
        if (res.status < 300 || res.status >= 400) {
          return bad.push({ url: u, detail: `status ${res.status}${current === u ? "" : ` at ${current}`}` });
        }
        const location = res.headers.get("location");
        if (!location) return bad.push({ url: u, detail: `${res.status} without location` });
        const target = new URL(location, current).toString();
        if (chain.includes(target)) {
          return bad.push({
            url: u,
            detail: `REDIRECT LOOP ${res.status}: ${target} <-> ${current} — a crawler following this URL never reaches a page`,
          });
        }
        chain.push(target);
        current = target;
      }
      return bad.push({ url: u, detail: `more than ${MAX_HOPS} redirects, last ${current}` });
    } catch (e) {
      // Reached only when BOTH attempts threw — a transport failure that
      // reproduced, not a blip.
      return bad.push({ url: u, detail: `${e} (retried once)` });
    }
  };
  for (let i = 0; i < newsLocs.length; i += NEWS_URL_CONCURRENCY) {
    await Promise.all(
      newsLocs
        .slice(i, i + NEWS_URL_CONCURRENCY)
        .map((u) => checkNewsUrl(u, bad, renames)),
    );
  }
  let confirmedBad = bad;
  let raced = 0;
  let mergeLag = [];
  if (bad.length) {
    // Settle the merge/rename race before believing any of it (see above).
    await new Promise((resolve) => setTimeout(resolve, MERGE_RACE_RECHECK_MS));
    const fresh = await get("/news-sitemap.xml");
    const stillListed =
      fresh.status === 200
        ? new Set([...fresh.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))
        : new Set(newsLocs); // could not re-read: re-check everything
    const recheck = bad.filter((r) => stillListed.has(r.url));
    raced = bad.length - recheck.length;
    const bad2 = [];
    const renames2 = [];
    for (let i = 0; i < recheck.length; i += NEWS_URL_CONCURRENCY) {
      await Promise.all(
        recheck
          .slice(i, i + NEWS_URL_CONCURRENCY)
          .map((r) => checkNewsUrl(r.url, bad2, renames2)),
      );
    }
    raced += recheck.length - bad2.length;
    confirmedBad = bad2;
    renames.push(...renames2);

    // What survives the re-check can still be the KNOWN merge-lag window
    // rather than a regression, and the difference is a fact we can look
    // up instead of guess: the sitemap gate reads archive standing through
    // a 30-minute cached query (FIRST_SEEN_TTL_S in lib/database/archive.ts),
    // so a cluster merged after that cache was populated stays advertised
    // until it expires. Ask the public archive stats whether the SOURCE id
    // is actually merged. Merged -> the archive is right and the feed is
    // catching up: a note. Not merged (or unknown) -> the feed is
    // advertising a non-canonical URL for a reason we do not understand,
    // which is exactly what this check exists to catch: still a failure.
    const crossId = confirmedBad.filter((r) => /different story id/.test(r.detail));
    if (crossId.length > 0 && crossId.length <= MERGE_LAG_TOLERANCE) {
      const ids = crossId
        .map((r) => idToken(r.url))
        .filter((id) => /^c[0-9a-f]{12}$/.test(id));
      try {
        const stats = await get(`/api/stats/archive-sources?ids=${ids.join(",")}`);
        const merged = new Set(
          stats.status === 200
            ? (JSON.parse(stats.body).rows ?? [])
                .filter((row) => row.merged)
                .map((row) => row.id)
            : [],
        );
        mergeLag = crossId.filter((r) => merged.has(idToken(r.url)));
        const lagged = new Set(mergeLag.map((r) => r.url));
        confirmedBad = confirmedBad.filter((r) => !lagged.has(r.url));
      } catch {
        // Stats unavailable: decide nothing, keep every failure.
      }
    }
  }
  if (confirmedBad.length) {
    fail(
      "news-sitemap URLs",
      `${confirmedBad.length}/${newsLocs.length} not directly 200 e.g. ${confirmedBad[0].url} (${confirmedBad[0].detail})`,
    );
    for (const r of confirmedBad.slice(0, 10)) console.error(`  news-url ${r.url}: ${r.detail}`);
  } else {
    ok(
      "news-sitemap URLs",
      `${newsLocs.length} answer 200 directly${renames.length ? `, ${renames.length} mid-check rename(s)` : ""}` +
        `${raced ? `, ${raced} merge race(s) cleared on re-check` : ""}` +
        `${mergeLag.length ? `, ${mergeLag.length} merged story(ies) still advertised inside the 30-min standing cache` : ""}`,
    );
  }
  for (const r of renames.slice(0, 5)) console.log(`  note rename race: ${r}`);
  for (const r of mergeLag.slice(0, 5)) {
    console.log(
      `  note merge lag: ${r.url} — the archive marks this cluster merged; the ` +
        `news-sitemap gate reads standing through a 30-minute cache and has not caught up`,
    );
  }
}

// 4. archive-sitemap.xml: valid urlset, or an honest 503 while the archive
// is down. Both are failures worth waking someone for, but they are DIFFERENT
// failures and the message says which — on 2026-08-21 this check reported
// "0 entries" for hours and the shape of the outage had to be reconstructed
// from the story pages. The status code now carries that diagnosis:
//   503        -> the archive is configured and not answering. The route is
//                 doing the right thing; the database needs attention.
//   200 empty  -> the route thinks the archive is legitimately empty, which
//                 in production means DATABASE_URL is missing entirely.
const archive = await get("/archive-sitemap.xml");
const archiveCount = (archive.body.match(/<url>/g) ?? []).length;
if (archive.status === 503) {
  fail(
    "archive-sitemap unavailable",
    "503 — the archive is configured but not answering. Permanent /story/ URLs are serving a retriable 5xx instead of 404, which is correct; restore the database (Neon) to end the outage.",
  );
} else if (archive.status !== 200 || !archive.body.includes("</urlset>")) {
  fail("archive-sitemap.xml", `status ${archive.status}`);
} else if (archiveCount === 0) {
  fail(
    "archive-sitemap empty",
    "0 entries with a 200 — the route believes the archive is EMPTY rather than unreachable, so DATABASE_URL is probably unset on the deployment (an unreachable DB now answers 503)",
  );
} else if (archiveCount > ARCHIVE_SHARD_AT) {
  // Sitemaps cap at 50,000 URLs, and this alarm fires ~5,000 short of it.
  //
  // CORRECTED 2026-09-03: this comment used to assert that sharding was "years
  // away at the current rate". That was written from a 701/day reading taken
  // during a lull and never re-measured. Measured live 2026-09-03:
  // 16,869 URLs, and per-day <lastmod> counts of 1,608 / 1,621 / 1,627 for
  // 2026-09-01/02/03 — the rate roughly DOUBLED on the day the growth alarm
  // was downgraded to a watch item. At ~1,620/day this fail() lands about
  // 2026-09-21 and the protocol cap about 2026-09-24. "Years" was three weeks.
  // An unverified estimate written into code as fact is exactly the failure
  // class seo/MEMORY keeps a file about; re-measure before trusting a runway.
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
//
// Extended 2026-08-24 by the weekly run, which measured four more pages
// still shipping zero blocks. /news-desk is the worst of them: it is the URL
// NewsMediaOrganization.masthead points at, so the Organization schema named
// a page that did not identify itself. /archive is the HTML entry point to
// every permanent story URL (5,891 of them that day) and had no schema while
// the /archive/<date> pages beneath it have carried some since 2026-08-19.
const TRUST_PAGES = {
  "/about": "AboutPage",
  "/methodology": "WebPage",
  "/editorial-standards": "WebPage",
  "/corrections": "WebPage",
  "/contact": "ContactPage",
  "/topics": "CollectionPage",
  "/news-desk": "WebPage",
  "/archive": "CollectionPage",
  "/privacy": "WebPage",
  "/terms": "WebPage",
  "/copyright": "WebPage",
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
