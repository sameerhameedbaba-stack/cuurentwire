#!/usr/bin/env node
/**
 * Discover image audit (weekly — runs after the CWV check in
 * .github/workflows/cwv.yml, also `npm run images:audit`).
 *
 * Google Discover favours pages whose main image is large — at least 1200 px
 * wide — and wide-landscape cards get the big preview. This script samples
 * the newest story URLs advertised in the news sitemap and measures TWO
 * images per page, because they are not the same thing:
 *
 *   og     OG image technical eligibility — the page's og:image. On this site
 *          that is the generated 1200x630 opengraph-image card, so this
 *          number says whether the share card clears Google's size bar, NOT
 *          whether the story has a real photograph. It is the metric this
 *          script reported alone before 2026-08-22, so history continues it.
 *   hero   Story hero image — the image actually rendered at the top of the
 *          story page: the <img fetchpriority="high"> that StoryImage emits
 *          for `cluster.imageUrl`. kind tells what was there:
 *            publisher   remote publisher URL — fetched and measured
 *            placeholder local src (starts with "/") — placeholder art, not
 *                        fetched; counts as not-eligible in every flag
 *            none        no fetchpriority=high <img> at all — the category
 *                        placeholder branch renders art without an <img>
 *            unknown     page failed, or the src was not a URL we handle
 *          A /_next/image?url=... src is unwrapped to the URL it optimises.
 *
 * For each image only the first 64 KB is fetched and the dimensions are read
 * straight from the container header (JPEG SOFn, PNG IHDR, WebP
 * VP8/VP8L/VP8X, GIF). Flags per image: width1200 (width >= 1200),
 * pixels300k (width x height > 300,000), wide16x9 (aspect within the
 * wide-landscape band) and broken (page or image fetch failed, non-2xx, or
 * undecodable image bytes). Hero percentages are over ALL sampled rows, so a
 * placeholder or missing hero counts as not-width1200; the one exception,
 * pctWidth1200OfPublisher, is among publisher images only.
 *
 * Output:
 *   - a per-URL table and one SUMMARY line on stdout
 *   - data/image-eligibility.json          latest run, with per-URL rows
 *   - data/image-eligibility-history.json  one summary row per run, capped
 *
 * Exit code: 0 always — a measurement must never redden the weekly workflow
 * — except when the news sitemap itself cannot be fetched, which means there
 * is nothing to measure and the run should be visibly red.
 *
 * Usage: node scripts/image-eligibility.mjs [--base https://currentwire.us] [--sample 120]
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("--base", "https://currentwire.us").replace(/\/$/, "");
const SAMPLE_SIZE = Number.parseInt(arg("--sample", "120"), 10) || 120;
/** 8 parallel pages (each fetching up to two images): gentle on the origin. */
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;
/** Enough header for every PNG/GIF/WebP and for all but metadata-heavy JPEGs. */
const RANGE_BYTES = 65_535;
const HISTORY_CAP = 60;
const LATEST_PATH = fileURLToPath(
  new URL("../data/image-eligibility.json", import.meta.url),
);
const HISTORY_PATH = fileURLToPath(
  new URL("../data/image-eligibility-history.json", import.meta.url),
);
const USER_AGENT = "CurrentWire image-eligibility audit (+https://currentwire.us)";

/**
 * Discover thresholds.
 *
 * MIN_WIDTH is Google's stated minimum for large-image previews. MIN_PIXELS
 * keeps a 1200x200 banner from counting. The aspect band is the brief's
 * 1.5–1.9 "16:9-ish" landscape range, with the upper bound at 1.91 rather
 * than 1.9: the site's own opengraph-image route emits 1200x630 (measured
 * 2026-08-21), which is the standard 1.91:1 Open Graph card — exactly the
 * wide shape this metric exists to count — and a strict 1.9 cap would file
 * every one of them under "not wide" on a rounding hair (1200/630 = 1.9048).
 */
export const THRESHOLDS = Object.freeze({
  minWidth: 1200,
  minPixels: 300_000,
  aspectMin: 1.5,
  aspectMax: 1.91,
});

const message = (error) =>
  error instanceof Error ? error.message : String(error);

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Story entries from a news sitemap, newest first. The route already emits
 * them in that order, but sorting here makes the sample independent of how
 * the sitemap happens to order its output.
 */
export function parseNewsSitemap(xml) {
  const entries = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    const loc = body.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
    if (!loc || !loc.includes("/story/")) continue;
    const lastmod =
      body.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ??
      body.match(
        /<news:publication_date>\s*([^<]+?)\s*<\/news:publication_date>/,
      )?.[1] ??
      "";
    entries.push({ url: decodeEntities(loc), lastmod });
  }
  return entries.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}

/**
 * Absolute og:image URL from a page, or null. Either attribute order is
 * accepted; the quoted property name keeps og:image:width/height out.
 */
export function extractOgImage(html, pageUrl) {
  const match =
    html.match(
      /<meta[^>]*\bproperty=["']og:image["'][^>]*\bcontent=["']([^"']*)["']/i,
    ) ??
    html.match(
      /<meta[^>]*\bcontent=["']([^"']*)["'][^>]*\bproperty=["']og:image["']/i,
    );
  if (!match?.[1]) return null;
  try {
    return new URL(decodeEntities(match[1]), pageUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Classify one hero src. `depth` stops a /_next/image that wraps another
 * /_next/image from recursing forever.
 */
function classifyHeroSrc(src, pageUrl, depth = 0) {
  if (!src) return { src: null, kind: "unknown" };

  // The optimizer URL is not the image — unwrap the `url` it optimises. Both
  // the relative "/_next/image?url=..." and an absolute same-origin form.
  let resolved;
  try {
    resolved = new URL(src, pageUrl);
  } catch {
    return { src, kind: "unknown" };
  }
  if (resolved.pathname === "/_next/image") {
    const inner = resolved.searchParams.get("url");
    if (!inner || depth > 2) return { src, kind: "unknown" };
    return classifyHeroSrc(inner, pageUrl, depth + 1);
  }

  // Local src: StoryImage's plain <img> branch for placeholder art. Kept as
  // the path it was written as; never fetched.
  if (src.startsWith("/") && !src.startsWith("//")) {
    return { src, kind: "placeholder" };
  }
  if (resolved.protocol === "http:" || resolved.protocol === "https:") {
    return { src: resolved.toString(), kind: "publisher" };
  }
  return { src, kind: "unknown" }; // data: URIs and the like
}

/**
 * The story hero: the first <img> carrying fetchpriority="high" (React
 * serialises the prop as `fetchPriority`, so the match is case-insensitive).
 * Returns { src, kind } with kind one of "publisher" | "placeholder" |
 * "none" | "unknown" — see the header comment.
 */
export function extractHeroImage(html, pageUrl) {
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\bfetchpriority\s*=\s*["']?high["']?/i.test(tag[0])) continue;
    // `(?<![\w-])` keeps srcset= and data-src= out.
    const srcMatch = tag[0].match(
      /(?<![\w-])src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i,
    );
    const raw = decodeEntities(
      srcMatch?.[1] ?? srcMatch?.[2] ?? srcMatch?.[3] ?? "",
    ).trim();
    return classifyHeroSrc(raw, pageUrl);
  }
  return { src: null, kind: "none" };
}

// ---------------------------------------------------------------------------
// Header-only dimension decoders. Each returns { format, width, height } or
// null when the bytes are not that format (or are truncated before the
// dimensions — the caller then retries with the full file).
// ---------------------------------------------------------------------------

function pngDimensions(buf) {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR" width(4) height(4).
  if (buf.length < 24 || buf[0] !== 0x89) return null;
  if (buf.toString("latin1", 1, 4) !== "PNG") return null;
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { format: "png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gifDimensions(buf) {
  if (buf.length < 10) return null;
  const signature = buf.toString("latin1", 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return { format: "gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function jpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) return null; // lost marker sync — not decodable
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte before a marker
      continue;
    }
    // Standalone markers carry no length: SOI, TEM, RSTn.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9) return null; // EOI before any frame header
    // Every SOFn (baseline C0, extended C1, progressive C2, lossless C3 and
    // the differential/arithmetic variants C5–CF) shares one payload layout:
    // length(2) precision(1) height(2) width(2). C4 (DHT), C8 (JPG) and
    // CC (DAC) sit in the same numeric range but are not frame headers.
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 8 >= buf.length) return null; // frame header truncated
      return { format: "jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null; // SOF lies beyond the bytes fetched (or there is none)
}

function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("latin1", 0, 4) !== "RIFF") return null;
  if (buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("latin1", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: 3-byte frame tag, 9D 01 2A start code, then 14-bit width/height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return {
      format: "webp",
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    // Lossless: 0x2F signature byte, then 14 bits (width-1), 14 bits (height-1).
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return {
      format: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    // Extended: flags(1) reserved(3), then 24-bit canvas width-1 and height-1.
    return {
      format: "webp",
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
    };
  }
  return null;
}

/** { format, width, height } for JPEG/PNG/WebP/GIF bytes, else null. */
export function imageDimensions(buf) {
  return (
    pngDimensions(buf) ??
    jpegDimensions(buf) ??
    webpDimensions(buf) ??
    gifDimensions(buf)
  );
}

/** Eligibility flags for one decoded image. */
export function classifyDimensions(width, height) {
  const aspect = height > 0 ? Math.round((width / height) * 1000) / 1000 : null;
  return {
    aspect,
    width1200: width >= THRESHOLDS.minWidth,
    pixels300k: width * height > THRESHOLDS.minPixels,
    wide16x9:
      aspect !== null && aspect >= THRESHOLDS.aspectMin && aspect <= THRESHOLDS.aspectMax,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    redirect: "follow",
    ...init,
    headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Fetch enough of an image to read its header. A Range request keeps the
 * weekly run cheap (up to 240 images x 64 KB instead of full files).
 * Servers that ignore Range answer 200 with the whole body, which is used as
 * is; a 416 (range not satisfiable — typically a file smaller than the
 * range) retries without the header. `full` forces a plain GET.
 */
async function fetchImageBytes(url, { full = false } = {}) {
  let res = await fetchWithTimeout(
    url,
    full ? {} : { headers: { range: `bytes=0-${RANGE_BYTES}` } },
  );
  if (res.status === 416) res = await fetchWithTimeout(url);
  const contentType = res.headers.get("content-type");
  if (!res.ok) return { status: res.status, contentType, bytes: null, partial: false };
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, contentType, bytes, partial: res.status === 206 };
}

/** The measurement fields shared by the og and hero sub-objects. */
function emptyMeasurement() {
  return {
    status: null,
    contentType: null,
    format: null,
    width: null,
    height: null,
    aspect: null,
    width1200: false,
    pixels300k: false,
    wide16x9: false,
    broken: false,
    note: null,
  };
}

function emptyRow(url) {
  return {
    url,
    pageStatus: null,
    og: { src: null, hasImage: false, ...emptyMeasurement() },
    hero: { src: null, kind: "unknown", ...emptyMeasurement() },
  };
}

/**
 * Fetch one image's header and fill `target` (an og or hero sub-object) with
 * status, dimensions and flags. Never throws.
 */
async function measureImage(target, imageUrl) {
  try {
    let image = await fetchImageBytes(imageUrl);
    target.status = image.status;
    target.contentType = image.contentType;
    if (!image.bytes) {
      target.broken = true;
      target.note = `image HTTP ${image.status}`;
      return;
    }
    let dims = imageDimensions(image.bytes);
    if (!dims && image.partial) {
      // A JPEG with a large embedded ICC profile or EXIF thumbnail can push
      // its SOF marker past the first 64 KB. One full GET settles it.
      image = await fetchImageBytes(imageUrl, { full: true });
      target.status = image.status;
      dims = image.bytes ? imageDimensions(image.bytes) : null;
    }
    if (!dims) {
      target.broken = true;
      target.note = `undecodable image bytes (content-type ${image.contentType ?? "unknown"})`;
      return;
    }
    target.format = dims.format;
    target.width = dims.width;
    target.height = dims.height;
    Object.assign(target, classifyDimensions(dims.width, dims.height));
  } catch (error) {
    target.broken = true;
    target.note = `image fetch failed: ${message(error)}`;
  }
}

/** One story: page -> og:image + hero <img> -> image headers -> flags. Never throws. */
async function auditStory(url) {
  const row = emptyRow(url);

  let html;
  try {
    const res = await fetchWithTimeout(url);
    row.pageStatus = res.status;
    if (!res.ok) {
      row.og.broken = row.hero.broken = true;
      row.og.note = row.hero.note = `page HTTP ${res.status}`;
      return row;
    }
    html = await res.text();
  } catch (error) {
    row.og.broken = row.hero.broken = true;
    row.og.note = row.hero.note = `page fetch failed: ${message(error)}`;
    return row;
  }

  const work = [];

  const ogUrl = extractOgImage(html, url);
  if (ogUrl) {
    row.og.src = ogUrl;
    row.og.hasImage = true;
    work.push(measureImage(row.og, ogUrl));
  } else {
    row.og.note = "no og:image";
  }

  const hero = extractHeroImage(html, url);
  row.hero.src = hero.src;
  row.hero.kind = hero.kind;
  switch (hero.kind) {
    case "publisher":
      work.push(measureImage(row.hero, hero.src));
      break;
    case "placeholder":
      row.hero.note = "local placeholder art (not fetched)";
      break;
    case "none":
      row.hero.note = "no hero <img>: category placeholder art, no publisher image";
      break;
    default:
      row.hero.note = `hero <img> src not recognised (${hero.src ?? "missing"})`;
  }

  await Promise.all(work);
  return row;
}

/** Run `fn` over `items` with at most `limit` in flight; results keep order. */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function medianWidth(images) {
  const widths = images
    .map((img) => img.width)
    .filter((w) => typeof w === "number")
    .sort((a, b) => a - b);
  if (widths.length === 0) return null;
  const mid = Math.floor(widths.length / 2);
  return widths.length % 2 === 1
    ? widths[mid]
    : Math.round((widths[mid - 1] + widths[mid]) / 2);
}

/**
 * { sampled, og, hero }. Every percentage is over ALL sampled rows — a hero
 * that is placeholder art or missing counts as not-width1200 — except
 * hero.pctWidth1200OfPublisher, which is among publisher hero images only
 * (null when the sample has none). Median widths are over decoded images.
 */
export function summarize(rows) {
  const n = rows.length;
  const ratio = (count, total) =>
    total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
  const pct = (count) => ratio(count, n);
  const ogs = rows.map((r) => r.og ?? {});
  const heroes = rows.map((r) => r.hero ?? {});
  const publisher = heroes.filter((h) => h.kind === "publisher");
  return {
    sampled: n,
    og: {
      pctWithImage: pct(ogs.filter((o) => o.hasImage).length),
      pctWidth1200: pct(ogs.filter((o) => o.width1200).length),
      pctPixels300k: pct(ogs.filter((o) => o.pixels300k).length),
      pctWide16x9: pct(ogs.filter((o) => o.wide16x9).length),
      pctBroken: pct(ogs.filter((o) => o.broken).length),
      medianWidth: medianWidth(ogs),
    },
    hero: {
      pctPublisherImage: pct(publisher.length),
      pctPlaceholder: pct(heroes.filter((h) => h.kind === "placeholder").length),
      pctNone: pct(heroes.filter((h) => h.kind === "none").length),
      pctWidth1200: pct(heroes.filter((h) => h.width1200).length),
      pctPixels300k: pct(heroes.filter((h) => h.pixels300k).length),
      pctWide16x9: pct(heroes.filter((h) => h.wide16x9).length),
      pctBroken: pct(heroes.filter((h) => h.broken).length),
      medianWidth: medianWidth(heroes),
      pctWidth1200OfPublisher:
        publisher.length === 0
          ? null
          : ratio(publisher.filter((h) => h.width1200).length, publisher.length),
    },
  };
}

/**
 * History rows written before 2026-08-22 were flat and measured only the
 * og:image. Lift them into the current { og, hero } shape so the file stays
 * uniform; hero is null there because that run never measured it.
 */
export function upgradeHistoryRow(row) {
  if (!row || typeof row !== "object" || row.og) return row;
  const {
    date,
    sampled,
    pctWithImage,
    pctWidth1200,
    pctPixels300k,
    pctWide16x9,
    pctBroken,
    medianWidth,
  } = row;
  if (typeof pctWithImage !== "number") return row;
  return {
    date,
    sampled,
    og: { pctWithImage, pctWidth1200, pctPixels300k, pctWide16x9, pctBroken, medianWidth },
    hero: null,
  };
}

const KIND_LETTER = { publisher: "p", placeholder: "l", none: "n", unknown: "?" };

function printTable(rows) {
  const measureFlags = (img) =>
    (img.width1200 ? "W" : "-") +
    (img.pixels300k ? "P" : "-") +
    (img.wide16x9 ? "A" : "-") +
    (img.broken ? "X" : "-");
  const size = (img) => (img.width ? `${img.width}x${img.height}` : "-");
  console.log(
    "og flags:   I=has og:image  W=width>=1200  P=pixels>300k  A=aspect " +
      `${THRESHOLDS.aspectMin}-${THRESHOLDS.aspectMax}  X=broken`,
  );
  console.log(
    "hero flags: kind (p=publisher image  l=local placeholder  n=no hero <img>  ?=unknown) then W P A X as above",
  );
  console.log(
    `${"#".padStart(3)}  ${"page".padEnd(4)}  ${"og".padEnd(4)}  ${"og-size".padEnd(10)}  og     ` +
      `${"hero".padEnd(4)}  ${"hero-size".padEnd(10)}  hero   path`,
  );
  rows.forEach((r, i) => {
    const path = r.url.replace(/^https?:\/\/[^/]+/, "");
    const notes = [r.og.note && `og: ${r.og.note}`, r.hero.note && `hero: ${r.hero.note}`]
      .filter(Boolean)
      .join("; ");
    console.log(
      `${String(i + 1).padStart(3)}  ${String(r.pageStatus ?? "ERR").padEnd(4)}  ` +
        `${String(r.og.status ?? "-").padEnd(4)}  ${size(r.og).padEnd(10)}  ` +
        `${r.og.hasImage ? "I" : "-"}${measureFlags(r.og)}  ` +
        `${String(r.hero.status ?? "-").padEnd(4)}  ${size(r.hero).padEnd(10)}  ` +
        `${KIND_LETTER[r.hero.kind] ?? "?"}${measureFlags(r.hero)}  ${path}` +
        (notes ? `  (${notes})` : ""),
    );
  });
}

function readJsonArray(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // first run — created below
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const date = new Date().toISOString();
  const sitemapUrl = `${BASE}/news-sitemap.xml`;

  let xml;
  try {
    const res = await fetchWithTimeout(sitemapUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (error) {
    console.error(
      `[image-eligibility] FAIL: cannot fetch ${sitemapUrl} — ${message(error)}`,
    );
    process.exit(1);
  }

  const entries = parseNewsSitemap(xml);
  const sample = entries.slice(0, SAMPLE_SIZE);
  console.log(
    `[image-eligibility] ${date} base=${BASE} sitemap=${entries.length} story URLs, ` +
      `sampling the newest ${sample.length} (${CONCURRENCY} concurrent, ${TIMEOUT_MS / 1000}s timeout)`,
  );
  if (sample.length === 0) {
    console.warn(
      "[image-eligibility] WARN: the news sitemap lists no /story/ URLs — recording an empty sample",
    );
  }

  const rows = await mapConcurrent(sample, CONCURRENCY, (entry) =>
    auditStory(entry.url),
  );
  const summary = summarize(rows);
  const { og, hero } = summary;
  const wide = `wide(${THRESHOLDS.aspectMin}-${THRESHOLDS.aspectMax})`;

  printTable(rows);
  console.log(
    `[image-eligibility] SUMMARY ${date} sampled=${summary.sampled} | ` +
      "OG image technical eligibility (generated 1200x630 card): " +
      `withImage=${og.pctWithImage}% width>=1200=${og.pctWidth1200}% ` +
      `pixels>300k=${og.pctPixels300k}% ${wide}=${og.pctWide16x9}% ` +
      `broken=${og.pctBroken}% medianWidth=${og.medianWidth ?? "-"} | ` +
      "story hero image (publisher image rendered on the page): " +
      `publisher=${hero.pctPublisherImage}% placeholder=${hero.pctPlaceholder}% none=${hero.pctNone}% ` +
      `width>=1200=${hero.pctWidth1200}% (of publisher images ${hero.pctWidth1200OfPublisher ?? "-"}%) ` +
      `pixels>300k=${hero.pctPixels300k}% ${wide}=${hero.pctWide16x9}% ` +
      `broken=${hero.pctBroken}% medianWidth=${hero.medianWidth ?? "-"}`,
  );

  let history = readJsonArray(HISTORY_PATH).map(upgradeHistoryRow);
  history.push({ date, ...summary });
  if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);
  writeJson(HISTORY_PATH, history);
  writeJson(LATEST_PATH, { date, base: BASE, thresholds: THRESHOLDS, ...summary, rows });
  console.log(
    `[image-eligibility] wrote ${LATEST_PATH} and ${HISTORY_PATH} (history=${history.length})`,
  );
}

// Run only when executed directly, so the pure helpers above stay importable.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
