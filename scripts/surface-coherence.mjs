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
 * FAIL (exit 1): same-version disagreement on any field; a story page on
 * the archive fallback while a list surface shows the cluster live; a
 * category flap; extraction coverage under MIN_COVERAGE (regex rot — the
 * probe would be blind). WARN (exit 0): cross-version drift, which is
 * expected between generations. Pages without the meta tag land in the
 * "unknown" version bucket and are still compared, at reduced confidence.
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
const LIST_PAGES = ["/", "/top-100", "/us", "/canada", "/latest", "/politics", "/business"];
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
    violations.push({
      type: "archive-vs-live",
      clusterId,
      storySurface: archived.surface,
      storyVersion: archived.version,
      listSurfaces: listed.map((o) => o.surface),
    });
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
    `violations=${violations.length} warnings=${warnings.length}`,
);
if (versionsSeen.length === 1 && versionsSeen[0] === "unknown") {
  console.log(
    "[surface-coherence] note: cw-dataset-version meta tag absent on every page — " +
      "version bucketing degraded, same-version checks run at reduced confidence",
  );
}
for (const w of warnings.slice(0, 10)) {
  console.log(`  WARN ${w.type} ${w.clusterId} ${w.field}: ${JSON.stringify(w.values)}`);
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
console.log("[surface-coherence] PASS: all surfaces agree within each dataset version");
