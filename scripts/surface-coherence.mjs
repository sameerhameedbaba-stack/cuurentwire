#!/usr/bin/env node
/**
 * Production surface-coherence probe (audit round 7, P0 #1).
 *
 * Invariant: every public surface rendering the same story cluster under
 * the same dataset version (the cw-dataset-version meta tag) must agree on
 * its category, country badge and "N sources" count.
 *
 * Two passes: (1) scrape story cards off the list surfaces, (2) fetch the
 * story page of every cluster collected. The whole probe runs twice ~30s
 * apart to straddle a revalidation boundary; pooled observations feed a
 * category flap detector (A -> B -> A across versions is a bug even when
 * each version is self-consistent).
 *
 * FAIL (exit 1): same-version disagreement on any field; an archive-vs-live
 * disagreement whose cause is RESOLUTION (the story page missed a cluster
 * the same generation was showing); a category flap; extraction coverage
 * under MIN_COVERAGE, including the live-version stamp (regex rot — the
 * probe would be blind). WARN (exit 0): cross-version drift, which is
 * expected between generations. Pages without the meta tag land in the
 * "unknown" version bucket and are still compared, at reduced confidence.
 *
 * FINDING (exit 0, reported and counted by cause): an archive-vs-live
 * disagreement caused by STALENESS or SKEW rather than resolution. Added
 * 2026-08-31 because every such disagreement used to fail the build, and
 * measurement showed the failures were the site's own cost controls
 * working: `/[category]` carries `revalidate = 3600` (app/[category]/page.tsx)
 * and the cron deliberately does NOT revalidate the dynamic category
 * pattern — that nuke is what blew the Hobby tier on 2026-08-24 and the
 * playbook protects its absence as a hard constraint. So a cached category
 * page listing a cluster the live dataset has since dropped is the designed
 * TTL, not a defect: measured this run, `/business` answered `Age: 3020`
 * inside its own 3600 s window while carrying two such clusters. Failing on
 * that kept [auto-alert] #2 permanently red from 2026-08-23 and buried the
 * one class that IS a bug. The stamp-coverage guard below is what stops this
 * becoming a silent pass if the stamp regex ever rots.
 *
 * Run daily by .github/workflows/surface-coherence.yml, which commits
 * data/coherence-report.json back like the url-survival ledger.
 *
 * Usage: node scripts/surface-coherence.mjs [--base https://currentwire.us]
 * (BASE_URL env is honoured when --base is absent.)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const BASE =
  process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : (process.env.BASE_URL ?? "https://currentwire.us");
const REPORT_PATH = new URL("../data/coherence-report.json", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1"); // strip leading slash on Windows paths
const CONCURRENCY = 10;
const REPEAT_GAP_MS = 30_000;
const MIN_COVERAGE = 0.5;
const LIST_PAGES = ["/", "/top-10", "/top-100", "/us", "/canada", "/latest", "/politics", "/business", "/ai", "/elections"];
const FIELDS = ["category", "country", "sources"];

// --- Extraction. Regexes are derived from the actual rendered markup of
// components/news/cards.tsx + atoms.tsx and app/story/[slug]/page.tsx —
// verify against production HTML before changing.

const CATEGORY_IDS = [
  "politics", "business", "technology", "world", "climate",
  "health", "science", "culture", "sports", "general",
];
// CategoryLabel renders <a class="...tracking-[0.12em]..." href="/<id>">;
// nothing else inside a card article links to a bare category path.
const CATEGORY_HREF_RE = new RegExp(`href="/(${CATEGORY_IDS.join("|")})"`);
const ARTICLE_RE = /<article[\s\S]*?<\/article>/g;
const STORY_HREF_RE = /href="(\/story\/[^"]+)"/;
// CountryBadge: the only element with tracking-[0.1em] (StatusBadge and
// CategoryLabel use 0.12em); the label text follows the aria-hidden dot.
const COUNTRY_BADGE_RE = /tracking-\[0\.1em\][^>]*>\s*<span[^>]*><\/span>\s*(?:<!--\s*-->)?\s*([^<]+)</;
// SourceLine renders `{sourceCount} sources`; React SSR splits the dynamic
// number from the literal text with a <!-- --> comment.
const SOURCES_RE = /(\d+)\s*(?:<!--\s*-->)?\s*sources\b/;
const BREADCRUMB_RE = /<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/;

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * The LIVE snapshot an archive-rendered story page consulted before falling
 * back (app/story/[slug]/page.tsx). Present only on archive renders, and it
 * is what separates the two causes of an archive-vs-live violation: a render
 * that consulted the SAME generation the list surfaces are showing and still
 * missed the cluster is a resolution defect; an older generation means the
 * page is simply a stale render — the freshness gap fixed 2026-08-29 in
 * lib/news/revalidation-window.ts, which heals within one rotation cycle.
 */
function extractLiveVersion(html) {
  const match =
    html.match(/<meta[^>]*name="cw-live-dataset-version"[^>]*content="([^"]*)"/) ??
    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="cw-live-dataset-version"/);
  return match ? match[1] : null;
}

/**
 * Version stamps sort chronologically: "20260828T221542Z-d00266". Only the
 * timestamp half is comparable — the hash is a content digest.
 */
function versionStamp(version) {
  const match = /^(\d{8}T\d{6}Z)/.exec(String(version));
  return match ? match[1] : null;
}

/**
 * Which side of an archive-vs-live violation is actually wrong.
 *
 * Verified against production 2026-08-29, minutes after the stamp shipped:
 * two clusters whose story pages stamped `archive:…` had left the live
 * dataset entirely (absent from force-dynamic /latest AND from a fresh
 * homepage prerender), while cached list pages from an earlier generation
 * still showed them. The story pages were CORRECT and the list surface was
 * the stale side — the opposite of what seo/BACKLOG.md item 3 assumed for
 * six days. Surfaces legitimately read dataset entries up to ~29 minutes
 * apart (the 1,740 s floor in lib/cache/store.ts), so a disagreement across
 * generations is skew, and only a same-generation disagreement is a bug.
 */
function classifyArchiveVsLive(consulted, listVersions) {
  if (!consulted) return "unknown (page predates the cw-live-dataset-version stamp)";
  if (listVersions.includes(consulted)) {
    return "resolution: the story page missed a cluster the SAME generation was showing";
  }
  const story = versionStamp(consulted);
  const stamps = listVersions.map(versionStamp).filter(Boolean);
  if (!story || stamps.length === 0) return "skew: generations not comparable";
  if (stamps.every((v) => v < story)) {
    return "list-side staleness: the story page read a NEWER generation that had dropped the cluster";
  }
  if (stamps.every((v) => v > story)) {
    return "story-side staleness: an older render, healed by the rotating revalidation window";
  }
  return "skew: list surfaces straddle the generation the story page read";
}

/**
 * Which archive-vs-live causes are the site's bug, and which are its design.
 *
 * Only RESOLUTION is a defect: two renders of the SAME dataset generation
 * disagreeing about whether a cluster exists. Everything else is a surface
 * reading a different generation, which the site deliberately allows —
 * `/[category]` at revalidate 3600, the 1,740 s dataset floor in
 * lib/cache/store.ts, and the rotating story window that heals a stale story
 * render within ~6.5 h. Those are cost controls (seo/PLAYBOOK.md), so a
 * probe that fails on them is asking for the outage of 2026-08-24 back.
 */
function isResolutionDefect(cause) {
  return String(cause).startsWith("resolution:");
}

function extractVersion(html) {
  const match =
    html.match(/<meta[^>]*name="cw-dataset-version"[^>]*content="([^"]*)"/) ??
    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="cw-dataset-version"/);
  return match ? match[1] : null;
}

/** Canonical slugs end "-c<hex>"; /latest links by the bare cluster id. */
function clusterIdFromHref(href) {
  const path = href.replace(/^.*\/story\//, "").replace(/[?#].*$/, "");
  if (/^c[0-9a-f]{6,}$/.test(path)) return path;
  const match = path.match(/-(c[0-9a-f]{6,})$/);
  return match ? match[1] : null;
}

function extractCountry(scope) {
  const match = scope.match(COUNTRY_BADGE_RE);
  return match ? decodeEntities(match[1]) : null;
}

function extractSources(scope) {
  const match = scope.match(SOURCES_RE);
  return match ? Number(match[1]) : null;
}

/** Story cards on a list surface: every <article> with a /story/ link. */
function parseListCards(html) {
  const cards = [];
  for (const block of html.match(ARTICLE_RE) ?? []) {
    const hrefMatch = block.match(STORY_HREF_RE);
    if (!hrefMatch) continue; // external-link rows are not comparable cards
    cards.push({
      href: hrefMatch[1],
      clusterId: clusterIdFromHref(hrefMatch[1]),
      category: block.match(CATEGORY_HREF_RE)?.[1] ?? null,
      country: extractCountry(block),
      sources: extractSources(block),
    });
  }
  return cards;
}

function parseStoryPage(html) {
  // Main story <article> up to "Compiled by" = header badges + byline;
  // stops before coverage modules that may also mention "N sources".
  const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? html;
  const bylineEnd = article.indexOf("Compiled by");
  const scope = bylineEnd === -1 ? article : article.slice(0, bylineEnd);
  const breadcrumb = html.match(BREADCRUMB_RE)?.[0];
  return {
    version: extractVersion(html) ?? "unknown",
    liveVersionAtRender: extractLiveVersion(html),
    category:
      breadcrumb?.match(CATEGORY_HREF_RE)?.[1] ??
      scope.match(CATEGORY_HREF_RE)?.[1] ??
      null,
    country: extractCountry(scope),
    sources: extractSources(scope),
  };
}

// --- Probe.

async function fetchHtml(url) {
  // Timeout so one hung request cannot stall the daily workflow.
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
}

const ranAt = new Date().toISOString();
const observations = [];
const stats = {
  pagesFetched: 0,
  pageErrors: [],
  cards: 0,
  cardsWithId: 0,
  cardsWithCategory: 0,
  cardsWithCountry: 0,
  cardsWithSources: 0,
  storyPagesFetched: 0,
  storyErrors: [],
};
const hrefById = new Map();
let seq = 0;

for (let repeat = 1; repeat <= 2; repeat++) {
  if (repeat === 2) {
    console.log(`[surface-coherence] waiting ${REPEAT_GAP_MS / 1000}s before repeat 2`);
    await new Promise((resolve) => setTimeout(resolve, REPEAT_GAP_MS));
  }

  // PASS 1: list surfaces.
  const repeatIds = new Set();
  for (const surface of LIST_PAGES) {
    let html;
    try {
      html = await fetchHtml(`${BASE}${surface}`);
    } catch (error) {
      stats.pageErrors.push({ surface, repeat, error: String(error) });
      continue;
    }
    stats.pagesFetched++;
    const version = extractVersion(html) ?? "unknown";
    for (const card of parseListCards(html)) {
      stats.cards++;
      if (card.clusterId) stats.cardsWithId++;
      if (card.category) stats.cardsWithCategory++;
      if (card.country) stats.cardsWithCountry++;
      if (card.sources !== null) stats.cardsWithSources++;
      if (!card.clusterId) continue;
      repeatIds.add(card.clusterId);
      // Prefer the canonical slug href over /latest's bare-id form.
      const known = hrefById.get(card.clusterId);
      if (!known || card.href.length > known.length) hrefById.set(card.clusterId, card.href);
      observations.push({
        seq: seq++,
        kind: "list",
        surface: `${surface} (r${repeat})`,
        clusterId: card.clusterId,
        version,
        category: card.category,
        country: card.country,
        sources: card.sources,
      });
    }
  }

  // PASS 2: the story page of every cluster this repeat's lists showed.
  const ids = [...repeatIds];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (clusterId) => {
        const href = hrefById.get(clusterId);
        try {
          return { clusterId, href, html: await fetchHtml(`${BASE}${href}`) };
        } catch (error) {
          return { clusterId, href, error: String(error) };
        }
      }),
    );
    for (const result of results) {
      if (result.error) {
        stats.storyErrors.push({ clusterId: result.clusterId, repeat, error: result.error });
        continue;
      }
      stats.storyPagesFetched++;
      observations.push({
        seq: seq++,
        kind: "story",
        surface: `${result.href} (r${repeat})`,
        clusterId: result.clusterId,
        ...parseStoryPage(result.html),
      });
    }
  }
  console.log(
    `[surface-coherence] repeat ${repeat}: lists=${LIST_PAGES.length} clusters=${repeatIds.size} ` +
      `stories=${stats.storyPagesFetched} errors=${stats.pageErrors.length + stats.storyErrors.length}`,
  );
}

// --- Assertions.

const byCluster = new Map();
for (const obs of observations) {
  if (!byCluster.has(obs.clusterId)) byCluster.set(obs.clusterId, []);
  byCluster.get(obs.clusterId).push(obs);
}

const violations = [];
const warnings = [];
/** Real disagreements that are the designed TTL rather than a defect. */
const findings = [];
const stampStats = { archiveRenders: 0, withStamp: 0 };

for (const [clusterId, obs] of byCluster) {
  const buckets = new Map();
  for (const o of obs) {
    if (!buckets.has(o.version)) buckets.set(o.version, []);
    buckets.get(o.version).push(o);
  }

  // (a) Two observations of the same cluster under the SAME version must
  // agree. null = field not rendered/extracted on that surface — skipped,
  // because some card types legitimately omit country and source count.
  for (const [version, group] of buckets) {
    for (const field of FIELDS) {
      const values = new Map();
      for (const o of group) {
        if (o[field] === null) continue;
        if (!values.has(o[field])) values.set(o[field], []);
        values.get(o[field]).push(o.surface);
      }
      if (values.size > 1) {
        violations.push({
          type: "same-version-mismatch",
          clusterId,
          version,
          field,
          // Without the meta tag everything pools into one "unknown"
          // bucket, so a revalidation boundary can masquerade as a
          // same-version mismatch.
          confidence: version === "unknown" ? "reduced" : "full",
          values: [...values].map(([value, surfaces]) => ({ value, surfaces })),
        });
      }
    }
  }

  // (b) Archive fallback on the story page while a list surface shows the
  // cluster live: list cards only ever render from the live dataset.
  const listed = obs.filter((o) => o.kind === "list");
  const archived = obs.find(
    (o) => o.kind === "story" && String(o.version).startsWith("archive:"),
  );
  if (archived && listed.length > 0) {
    // Which defect is it? The story page stamps the live generation it
    // consulted before falling back to the archive. If that generation is
    // one the list surfaces are ALSO showing this run, the page missed a
    // cluster that generation contained — a resolution defect. Otherwise
    // the page is an older render, which the rotating revalidation window
    // (lib/news/revalidation-window.ts) heals within one cycle.
    const listVersions = listed.map((o) => o.version);
    const consulted = archived.liveVersionAtRender ?? null;
    stampStats.archiveRenders += 1;
    if (consulted) stampStats.withStamp += 1;
    const cause = classifyArchiveVsLive(consulted, listVersions);
    const entry = {
      type: "archive-vs-live",
      clusterId,
      storySurface: archived.surface,
      storyVersion: archived.version,
      liveVersionAtRender: consulted,
      cause,
      listSurfaces: listed.map((o) => o.surface),
    };
    // Only a same-generation disagreement is a bug; the rest are the
    // designed revalidate windows and are reported, not failed on.
    (isResolutionDefect(cause) ? violations : findings).push(entry);
  }

  // (c) Flap detector: category A -> B -> A across the version buckets
  // seen this run (ordered by first sighting), pooled over both repeats.
  const ordered = [...buckets.entries()]
    .map(([version, group]) => ({
      version,
      firstSeq: Math.min(...group.map((o) => o.seq)),
      category: group.map((o) => o.category).find((c) => c !== null) ?? null,
    }))
    .filter((bucket) => bucket.category !== null)
    .sort((a, b) => a.firstSeq - b.firstSeq);
  const sequence = ordered.filter(
    (bucket, i) => i === 0 || bucket.category !== ordered[i - 1].category,
  );
  const seen = new Set();
  let flapped = false;
  for (const step of sequence) {
    if (seen.has(step.category)) {
      flapped = true;
      violations.push({
        type: "category-flap",
        clusterId,
        sequence: sequence.map(({ version, category }) => ({ version, category })),
      });
      break;
    }
    seen.add(step.category);
  }

  // Cross-version drift is expected between generations — warn only.
  if (buckets.size > 1) {
    for (const field of FIELDS) {
      if (field === "category" && flapped) continue; // already a violation
      const perBucket = [...buckets.entries()]
        .map(([version, group]) => ({
          version,
          value: group.map((o) => o[field]).find((v) => v !== null) ?? null,
        }))
        .filter((bucket) => bucket.value !== null);
      if (new Set(perBucket.map((bucket) => bucket.value)).size > 1) {
        warnings.push({ type: "cross-version-drift", clusterId, field, values: perBucket });
      }
    }
  }
}

// Extraction coverage: cluster id and category render on essentially every
// card, so a collapse there means regex rot — the probe is blind and MUST
// fail rather than report a hollow PASS. Country and source count are
// optional per card type and only reported.
const coverage = {
  clusterId: stats.cards > 0 ? stats.cardsWithId / stats.cards : 0,
  category: stats.cards > 0 ? stats.cardsWithCategory / stats.cards : 0,
  country: stats.cards > 0 ? stats.cardsWithCountry / stats.cards : 0,
  sources: stats.cards > 0 ? stats.cardsWithSources / stats.cards : 0,
};
if (stats.cards === 0) {
  violations.push({ type: "extraction-blind", field: "cards", coverage: 0 });
} else {
  for (const field of ["clusterId", "category"]) {
    if (coverage[field] < MIN_COVERAGE) {
      violations.push({
        type: "extraction-blind",
        field,
        coverage: Number(coverage[field].toFixed(3)),
      });
    }
  }
}

// The cause split above is only as trustworthy as the cw-live-dataset-version
// stamp it reads. If that regex rots, every archive-vs-live disagreement
// classifies as "unknown", lands in findings, and the probe passes forever
// while blind — the exact failure this file already guards against for card
// extraction. Measured 2026-08-31: 16 of 16 archive renders carried the stamp.
const stampCoverage =
  stampStats.archiveRenders > 0 ? stampStats.withStamp / stampStats.archiveRenders : 1;
if (stampStats.archiveRenders > 0 && stampCoverage < MIN_COVERAGE) {
  violations.push({
    type: "extraction-blind",
    field: "liveVersionAtRender",
    coverage: Number(stampCoverage.toFixed(3)),
  });
}

const findingsByCause = {};
for (const f of findings) {
  const key = String(f.cause).split(":")[0];
  findingsByCause[key] = (findingsByCause[key] ?? 0) + 1;
}

const versionsSeen = [...new Set(observations.map((o) => o.version))];

const report = {
  ranAt,
  base: BASE,
  listPages: LIST_PAGES,
  stats: { ...stats, uniqueClusters: byCluster.size },
  coverage: Object.fromEntries(
    Object.entries(coverage).map(([field, value]) => [field, Number(value.toFixed(3))]),
  ),
  versionsSeen,
  violations,
  findingsTotal: findings.length,
  findingsByCause,
  findings: findings.slice(0, 50),
  stampCoverage: Number(stampCoverage.toFixed(3)),
  warningsTotal: warnings.length,
  warnings: warnings.slice(0, 50),
  result: violations.length > 0 ? "FAIL" : "PASS",
};
mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `[surface-coherence] ${ranAt} base=${BASE} pages=${stats.pagesFetched} cards=${stats.cards} ` +
    `clusters=${byCluster.size} storyPages=${stats.storyPagesFetched} ` +
    `versions=[${versionsSeen.join(", ")}] ` +
    `coverage id=${report.coverage.clusterId} category=${report.coverage.category} ` +
    `country=${report.coverage.country} sources=${report.coverage.sources} ` +
    `violations=${violations.length} findings=${findings.length} warnings=${warnings.length}`,
);
if (findings.length > 0) {
  console.log(
    `[surface-coherence] findings by cause: ${JSON.stringify(findingsByCause)} ` +
      `(stamp coverage ${report.stampCoverage}) — these are revalidate windows, not defects`,
  );
}
if (versionsSeen.length === 1 && versionsSeen[0] === "unknown") {
  console.log(
    "[surface-coherence] note: cw-dataset-version meta tag absent on every page — " +
      "version bucketing degraded, same-version checks run at reduced confidence",
  );
}
for (const w of warnings.slice(0, 10)) {
  console.log(`  WARN ${w.type} ${w.clusterId} ${w.field}: ${JSON.stringify(w.values)}`);
}
for (const f of findings.slice(0, 10)) {
  console.log(`  FINDING ${JSON.stringify(f)}`);
}
for (const v of violations) {
  console.log(`  VIOLATION ${JSON.stringify(v)}`);
}

if (violations.length > 0) {
  console.error(
    `[surface-coherence] FAIL: ${violations.length} coherence violation(s) — see data/coherence-report.json`,
  );
  process.exit(1);
}
console.log(
  findings.length > 0
    ? `[surface-coherence] PASS: no same-generation disagreement; ${findings.length} cross-generation finding(s) inside the designed revalidate windows`
    : "[surface-coherence] PASS: all surfaces agree within each dataset version",
);
