#!/usr/bin/env node
/**
 * Archive source-union audit.
 *
 * story_archive keeps two coverage numbers per story: source_count (the
 * ACTIVE publication count at the last upsert — what every live surface
 * shows) and sources (the PERMANENT union of every source ever seen), plus
 * the history jsonb's coverage_change events. This script measures how far
 * the stored active count drifts from the union for one week of archived
 * stories, through the public aggregate endpoint
 * GET /api/stats/archive-sources (app/api/stats/archive-sources/route.ts),
 * and then proves the union numbers against the live story pages.
 *
 * Usage:
 *   node scripts/audit-archive-unions.mjs [--base https://currentwire.us]
 *        [--from 2026-08-10T04:00:00Z] [--to 2026-08-17T04:00:00Z]
 *        [--sample 60] [--seed 2026]
 *
 * Defaults = ISO week 2026-W33 on the US-Eastern calendar: Mon Aug 10
 * 00:00 EDT (= 2026-08-10T04:00:00Z) to Mon Aug 17 00:00 EDT
 * (= 2026-08-17T04:00:00Z), [from, to) on first_seen_at.
 *
 * Part 1 — endpoint audit. Pages through the range (limit 1000 + offset),
 * drops merged rows and reports: total rows; sourceCount distribution
 * (1/2/3/4+); unionPublications distribution; peakHistoryCoverage
 * distribution; share of stamped (union-era) rows; rows where
 * unionPublications > sourceCount; rows where peakHistoryCoverage >
 * sourceCount; multi-source (>= 2) percentage under three definitions
 * (sourceCount, unionPublications, max of the three); and the first 40
 * mismatching rows with slug + the three numbers.
 *
 * Part 2 — page-level proof. Samples N rows (every row with
 * unionPublications >= 2 up to N/2, randomly thinned when there are more,
 * plus random single-publication rows to fill N — seeded PRNG, so reruns
 * sample the same rows), fetches each live story page and counts the
 * distinct publication names the page renders, then reports matches vs
 * mismatches against unionPublications.
 *
 * PAGE MARKERS (inspected live on 2026-08-22 at
 * /story/supreme-court-temporarily-unfreezes-trump-ballroom-construction-c4b2bcc1093f0):
 *   - Coverage list (components/news/CoverageSources.tsx):
 *       <section aria-labelledby="coverage-heading"> ... <ul> with one
 *       <li class="py-3"><p class="...">PUBLICATION<span class="...">Tier A</span></p>
 *       per report, and a header sentence "16 reports from 14 publications."
 *       / "3 publications are covering this story." /
 *       "1 publication is covering this story." — the distinct names in the
 *       <li> entries are the primary count (on an ARCHIVED page this list IS
 *       the stored union; on a LIVE page it is the active set).
 *   - All-time coverage (components/news/CoverageIntelligence.tsx), rendered
 *       only when the union exceeds the active set:
 *       "<N><!-- --> publications have covered this story since CurrentWire
 *       first saw it: <!-- -->A, B, C<!-- -->.</p>" (React text-node
 *       comments are optional in the regexes).
 *   - "Coverage at a glance" (lib/news/coverage-glance.ts), omitted for a
 *       single report: "Coverage<!-- -->:</span> <!-- -->16 reports from 14
 *       independent publications" — recorded for context only (it counts
 *       non-press-release publications, a different definition).
 *   renderedPublications = max(distinct coverage-list names, all-time count).
 *
 * Prints a plain-text summary and writes
 * data/local/archive-union-audit-<from-date>.json (data/local is gitignored).
 * Exit 0 always, except 1 when the endpoint is unreachable (network error or
 * a non-200 answer on the first page). No npm dependencies — fetch only.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ENDPOINT_PATH = "/api/stats/archive-sources";
export const DEFAULT_BASE = "https://currentwire.us";
export const DEFAULT_FROM = "2026-08-10T04:00:00Z";
export const DEFAULT_TO = "2026-08-17T04:00:00Z";
export const DEFAULT_SAMPLE = 60;
export const DEFAULT_SEED = 2026;
export const PAGE_LIMIT = 1000;
/** Paging guard: the archive gains ~300-480 stories per day, 9 days max. */
const MAX_PAGES = 20;
const MISMATCH_LIST_LIMIT = 40;
const USER_AGENT = "CurrentWire archive audit";
const FETCH_TIMEOUT_MS = 30_000;
const PAGE_CONCURRENCY = 4;

const DATA_LOCAL_DIR = fileURLToPath(new URL("../data/local/", import.meta.url));

export class EndpointUnreachableError extends Error {
  constructor(message) {
    super(message);
    this.name = "EndpointUnreachableError";
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/** --flag value pairs → options with defaults. Pure. */
export function parseArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index !== -1 && index + 1 < argv.length ? argv[index + 1] : undefined;
  };
  const sampleRaw = value("--sample");
  const seedRaw = value("--seed");
  const sample = sampleRaw === undefined ? DEFAULT_SAMPLE : Number(sampleRaw);
  const seed = seedRaw === undefined ? DEFAULT_SEED : Number(seedRaw);
  return {
    base: (value("--base") ?? DEFAULT_BASE).replace(/\/+$/, ""),
    from: value("--from") ?? DEFAULT_FROM,
    to: value("--to") ?? DEFAULT_TO,
    sample: Number.isSafeInteger(sample) && sample >= 0 ? sample : DEFAULT_SAMPLE,
    seed: Number.isSafeInteger(seed) ? seed : DEFAULT_SEED,
  };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) so a rerun samples the same pages. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** 0 / 1 / 2 / 3 / 4+ bucket label for a count. */
export function bucket(n) {
  if (n === null || n === undefined) return "null";
  if (n >= 4) return "4+";
  return String(Math.max(0, Math.trunc(n)));
}

function distribution(values) {
  const counts = {};
  for (const v of values) {
    const key = bucket(v);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const ordered = {};
  for (const key of ["null", "0", "1", "2", "3", "4+"]) {
    if (key in counts) ordered[key] = counts[key];
  }
  return ordered;
}

function pct(count, total) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

/** Largest of the three coverage numbers (peak may be null). */
export function maxCoverage(row) {
  return Math.max(row.sourceCount, row.unionPublications, row.peakHistoryCoverage ?? 0);
}

/**
 * Part 1 — the endpoint audit over the fetched rows. Pure. Merged rows are
 * excluded from every figure (their URLs redirect elsewhere).
 */
export function summarize(rows) {
  const live = rows.filter((row) => !row.merged);
  const total = live.length;
  const unionAboveActive = live.filter((row) => row.unionPublications > row.sourceCount);
  const peakAboveActive = live.filter(
    (row) => row.peakHistoryCoverage !== null && row.peakHistoryCoverage > row.sourceCount,
  );
  const stamped = live.filter((row) => row.stamped).length;
  const multiBySourceCount = live.filter((row) => row.sourceCount >= 2).length;
  const multiByUnion = live.filter((row) => row.unionPublications >= 2).length;
  const multiByMax = live.filter((row) => maxCoverage(row) >= 2).length;
  const mismatchRows = live.filter(
    (row) =>
      row.unionPublications > row.sourceCount ||
      (row.peakHistoryCoverage !== null && row.peakHistoryCoverage > row.sourceCount),
  );
  return {
    totalRows: total,
    mergedExcluded: rows.length - total,
    sourceCountDistribution: distribution(live.map((row) => row.sourceCount)),
    unionPublicationsDistribution: distribution(live.map((row) => row.unionPublications)),
    peakHistoryCoverageDistribution: distribution(live.map((row) => row.peakHistoryCoverage)),
    stamped: { count: stamped, pct: pct(stamped, total) },
    unionAboveActive: { count: unionAboveActive.length, pct: pct(unionAboveActive.length, total) },
    peakAboveActive: { count: peakAboveActive.length, pct: pct(peakAboveActive.length, total) },
    multiSource: {
      bySourceCount: { count: multiBySourceCount, pct: pct(multiBySourceCount, total) },
      byUnionPublications: { count: multiByUnion, pct: pct(multiByUnion, total) },
      byMax: { count: multiByMax, pct: pct(multiByMax, total) },
    },
    mismatchCount: mismatchRows.length,
    mismatches: mismatchRows.slice(0, MISMATCH_LIST_LIMIT).map((row) => ({
      slug: row.slug,
      sourceCount: row.sourceCount,
      unionPublications: row.unionPublications,
      peakHistoryCoverage: row.peakHistoryCoverage,
    })),
  };
}

/**
 * Part 2 sample: every row with unionPublications >= 2 up to n/2 (randomly
 * thinned when there are more), then random single-publication rows to fill
 * n; if singles run out, more multi rows top it up. Pure given the rng.
 */
export function pickSample(rows, n, rng) {
  const live = rows.filter((row) => !row.merged);
  const multi = shuffle(live.filter((row) => row.unionPublications >= 2), rng);
  const single = shuffle(live.filter((row) => row.unionPublications < 2), rng);
  const half = Math.floor(n / 2);
  const chosen = multi.slice(0, half);
  const fromSingles = single.slice(0, Math.max(0, n - chosen.length));
  const picked = [...chosen, ...fromSingles];
  if (picked.length < n) picked.push(...multi.slice(half, half + (n - picked.length)));
  return picked.slice(0, n);
}

const ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Decode the handful of entities React emits in text nodes. */
export function decodeEntities(text) {
  return text
    .replace(/&(?:amp|lt|gt|quot|#x27|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Strip React's text-node separator comments. */
const stripComments = (text) => text.replace(/<!-- -->/g, "");

/**
 * Count the publications a rendered story page shows (markers documented in
 * the file header). Pure — returns nulls for anything the page lacks.
 */
export function parseRenderedPublications(html) {
  const result = {
    coverageListFound: false,
    coverageListNames: [],
    coverageListDistinct: null,
    headerPublications: null,
    allTimeCount: null,
    allTimeNames: [],
    glance: null,
    renderedPublications: null,
  };
  const start = html.indexOf('aria-labelledby="coverage-heading"');
  if (start !== -1) {
    const end = html.indexOf("</section>", start);
    const section = html.slice(start, end === -1 ? undefined : end);
    result.coverageListFound = true;
    const names = [];
    const itemRe = /<li class="py-3"><p class="[^"]*">([^<]+)<span class="[^"]*">Tier/g;
    let match;
    while ((match = itemRe.exec(section)) !== null) {
      names.push(decodeEntities(stripComments(match[1])).trim());
    }
    result.coverageListNames = names;
    result.coverageListDistinct = new Set(names.filter((n) => n.length > 0)).size;
    const text = stripComments(section);
    const reports = /(\d+) reports? from (\d+) publications?\./.exec(text);
    const covering = /(\d+) publications are covering this story\./.exec(text);
    if (reports) result.headerPublications = Number(reports[2]);
    else if (covering) result.headerPublications = Number(covering[1]);
    else if (text.includes("1 publication is covering this story.")) result.headerPublications = 1;
  }
  const allTime =
    /(\d+)(?:<!-- -->)? publications have covered this story since CurrentWire first saw it: (?:<!-- -->)?([\s\S]*?)(?:<!-- -->)?\.<\/p>/.exec(
      html,
    );
  if (allTime) {
    result.allTimeCount = Number(allTime[1]);
    result.allTimeNames = decodeEntities(stripComments(allTime[2]))
      .split(", ")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
  }
  const glance =
    /Coverage(?:<!-- -->)?:<\/span>\s*(?:<!-- -->)?(\d+) reports? from (\d+) independent publications?/.exec(
      html,
    );
  if (glance) result.glance = { reports: Number(glance[1]), publications: Number(glance[2]) };
  if (result.coverageListDistinct !== null || result.allTimeCount !== null) {
    result.renderedPublications = Math.max(
      result.coverageListDistinct ?? 0,
      result.allTimeCount ?? 0,
    );
  }
  return result;
}

/** Compare one sampled row against its rendered page. Pure. */
export function compareSample(row, parsed) {
  const rendered = parsed.renderedPublications;
  let relation;
  if (rendered === null) relation = "unparsed";
  else if (rendered === row.unionPublications) relation = "match";
  else if (rendered > row.unionPublications) relation = "page-renders-more";
  else relation = "page-renders-fewer";
  return {
    slug: row.slug,
    unionPublications: row.unionPublications,
    sourceCount: row.sourceCount,
    renderedPublications: rendered,
    coverageListDistinct: parsed.coverageListDistinct,
    headerPublications: parsed.headerPublications,
    allTimeCount: parsed.allTimeCount,
    glancePublications: parsed.glance ? parsed.glance.publications : null,
    relation,
  };
}

// ── Network ──────────────────────────────────────────────────────────────────

async function fetchJson(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new EndpointUnreachableError(`${url}: ${error?.message ?? String(error)}`);
  }
  if (response.status !== 200) {
    throw new EndpointUnreachableError(`${url}: HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new EndpointUnreachableError(`${url}: invalid JSON (${error?.message ?? error})`);
  }
}

/** Page through the endpoint for [from, to); rows in endpoint order. */
export async function fetchAllRows(base, from, to, fetchImpl = fetch) {
  const rows = [];
  let offset = 0;
  let pages = 0;
  for (;;) {
    const params = new URLSearchParams({
      from,
      to,
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });
    const body = await fetchJson(`${base}${ENDPOINT_PATH}?${params}`, fetchImpl);
    const pageRows = Array.isArray(body?.rows) ? body.rows : [];
    rows.push(...pageRows);
    pages++;
    if (!body?.truncated || pageRows.length === 0 || pages >= MAX_PAGES) break;
    offset += pageRows.length;
  }
  return { rows, pages };
}

async function fetchStoryPage(base, slug, fetchImpl) {
  const url = `${base}/story/${slug}`;
  try {
    const response = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status !== 200) return { ok: false, status: response.status, url };
    return { ok: true, status: 200, url: response.url || url, html: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, url, error: error?.message ?? String(error) };
  }
}

/** Part 2 — fetch and compare the sampled pages, a few at a time. */
export async function proveAgainstPages(base, sample, fetchImpl = fetch) {
  const results = new Array(sample.length);
  let next = 0;
  const worker = async () => {
    while (next < sample.length) {
      const index = next++;
      const row = sample[index];
      const page = await fetchStoryPage(base, row.slug, fetchImpl);
      if (!page.ok) {
        results[index] = {
          slug: row.slug,
          unionPublications: row.unionPublications,
          sourceCount: row.sourceCount,
          relation: "fetch-failed",
          status: page.status,
          error: page.error,
        };
        continue;
      }
      results[index] = compareSample(row, parseRenderedPublications(page.html));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PAGE_CONCURRENCY, sample.length) }, () => worker()),
  );
  const matched = results.filter((r) => r.relation === "match");
  const fetchFailed = results.filter((r) => r.relation === "fetch-failed");
  const unparsed = results.filter((r) => r.relation === "unparsed");
  const mismatched = results.filter(
    (r) => r.relation === "page-renders-more" || r.relation === "page-renders-fewer",
  );
  return {
    sampled: results.length,
    matched: matched.length,
    mismatched: mismatched.length,
    fetchFailed: fetchFailed.length,
    unparsed: unparsed.length,
    mismatches: mismatched,
    results,
  };
}

// ── Report ───────────────────────────────────────────────────────────────────

function formatDistribution(dist) {
  return Object.entries(dist)
    .map(([key, count]) => `${key}: ${count}`)
    .join("  ");
}

export function renderReport(report) {
  const s = report.summary;
  const p = report.pageProof;
  const lines = [
    `Archive source-union audit — ${report.base}`,
    `Range [${report.from}, ${report.to}) on first_seen_at; endpoint pages: ${report.endpointPages}`,
    `Rows: ${s.totalRows} (merged excluded: ${s.mergedExcluded})`,
    `sourceCount distribution         ${formatDistribution(s.sourceCountDistribution)}`,
    `unionPublications distribution   ${formatDistribution(s.unionPublicationsDistribution)}`,
    `peakHistoryCoverage distribution ${formatDistribution(s.peakHistoryCoverageDistribution)}`,
    `Stamped (union-era) rows: ${s.stamped.count} (${s.stamped.pct}%)`,
    `unionPublications > sourceCount: ${s.unionAboveActive.count} (${s.unionAboveActive.pct}%)`,
    `peakHistoryCoverage > sourceCount: ${s.peakAboveActive.count} (${s.peakAboveActive.pct}%)`,
    `Multi-source (>= 2) by sourceCount: ${s.multiSource.bySourceCount.count} (${s.multiSource.bySourceCount.pct}%)`,
    `Multi-source (>= 2) by unionPublications: ${s.multiSource.byUnionPublications.count} (${s.multiSource.byUnionPublications.pct}%)`,
    `Multi-source (>= 2) by max(sourceCount, unionPublications, peak): ${s.multiSource.byMax.count} (${s.multiSource.byMax.pct}%)`,
    `Mismatching rows (union or peak above active): ${s.mismatchCount}; first ${s.mismatches.length}:`,
    ...s.mismatches.map(
      (m) =>
        `  ${m.slug}  sourceCount=${m.sourceCount} unionPublications=${m.unionPublications} peakHistoryCoverage=${m.peakHistoryCoverage ?? "null"}`,
    ),
  ];
  if (p) {
    lines.push(
      `Page-level proof: sampled ${p.sampled}, matched ${p.matched}, mismatched ${p.mismatched}, fetch failed ${p.fetchFailed}, unparsed ${p.unparsed}`,
    );
    for (const m of p.mismatches) {
      lines.push(
        `  ${m.slug}  unionPublications=${m.unionPublications} rendered=${m.renderedPublications} (list=${m.coverageListDistinct ?? "-"}, all-time=${m.allTimeCount ?? "-"}, glance=${m.glancePublications ?? "-"}) ${m.relation}`,
      );
    }
  } else {
    lines.push("Page-level proof: skipped (--sample 0)");
  }
  if (report.outputPath) lines.push(`Written: ${report.outputPath}`);
  return lines.join("\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function main(argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  let fetched;
  try {
    fetched = await fetchAllRows(options.base, options.from, options.to, fetchImpl);
  } catch (error) {
    if (error instanceof EndpointUnreachableError) {
      console.error(`[archive-audit] endpoint unreachable: ${error.message}`);
      return 1;
    }
    throw error;
  }
  const summary = summarize(fetched.rows);
  const rng = mulberry32(options.seed);
  const sample = options.sample > 0 ? pickSample(fetched.rows, options.sample, rng) : [];
  const pageProof =
    sample.length > 0 ? await proveAgainstPages(options.base, sample, fetchImpl) : null;

  const fromDate = options.from.slice(0, 10);
  const outputPath = `${DATA_LOCAL_DIR}archive-union-audit-${fromDate}.json`;
  const report = {
    generatedAt: new Date().toISOString(),
    base: options.base,
    from: options.from,
    to: options.to,
    endpointPages: fetched.pages,
    endpointRows: fetched.rows.length,
    summary,
    sample: { requested: options.sample, seed: options.seed },
    pageProof,
    outputPath,
  };
  try {
    mkdirSync(DATA_LOCAL_DIR, { recursive: true });
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`[archive-audit] could not write ${outputPath}: ${error?.message ?? error}`);
    report.outputPath = null;
  }
  console.log(renderReport(report));
  return 0;
}

const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      // Findings never fail the run; only an unreachable endpoint does (above).
      console.error(`[archive-audit] error: ${error?.stack ?? error}`);
      process.exitCode = 0;
    });
}
