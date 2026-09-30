#!/usr/bin/env node
/**
 * Build the production site: a static export for GitHub Pages.
 *
 *   node scripts/build-static-site.mjs [--out <dir>]
 *
 * Production moved here on 2026-09-28. Vercel's free plan paused the old
 * aggregator (402 DEPLOYMENT_DISABLED, from 2026-09-14) and did not lift at
 * the cycle reset; its only offer was "Upgrade", and the owner's rule is $0.
 * GitHub Pages serves static files for free, cannot be paused for usage, and
 * has no paid tier to fall into.
 *
 * HOW IT WORKS — nothing in the working tree is modified.
 *
 *   1. Copy the repo into a scratch directory (.static-build/), symlinking
 *      node_modules rather than copying 900 MB of it.
 *   2. In the scratch copy, delete every route that is NOT on KEEP_APP below.
 *      The aggregator's routes need a server (ISR, the database, request-time
 *      search params, middleware) and a static export refuses them.
 *   3. Copy site/ over the scratch copy: the static versions of the few
 *      routes that must differ (home, category, sitemap, robots, rss.xml).
 *   4. `next build` with NEXT_PUBLIC_SITE_MODE=static -> plain HTML in out/.
 *   5. Add CNAME and .nojekyll, then CHECK the output: required files exist,
 *      and every internal link in every page resolves to a file that exists.
 *
 * Step 5 is the point. A static site cannot fail at request time, so the only
 * way it breaks is by being built wrong — and a link to a page that was
 * pruned is the most likely way to build it wrong. The build fails rather
 * than ship one.
 */

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = join(ROOT, ".static-build");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://currentwire.us";
const CUSTOM_DOMAIN = new URL(SITE_URL).hostname;

const outArgIndex = process.argv.indexOf("--out");
const OUT = resolve(ROOT, outArgIndex >= 0 ? process.argv[outArgIndex + 1] : "out");

/**
 * What the static site is. Everything under app/ not named here is removed
 * from the scratch copy before building.
 *
 * An allowlist, not a blocklist, on purpose: a new aggregator route added to
 * app/ later is excluded automatically instead of breaking the export. Adding
 * a route to the static site is a deliberate act — add it here.
 */
export const KEEP_APP = [
  // Root files.
  "layout.tsx",
  "globals.css",
  "favicon.ico",
  "icon.svg",
  "apple-icon.tsx",
  "error.tsx",
  "not-found.tsx",
  "global-not-found.tsx",
  "robots.ts", // overlaid
  "sitemap.ts", // overlaid
  // Routes.
  "(home)", // overlaid
  "[category]", // overlaid
  "article",
  "articles",
  "about",
  "news-desk",
  "editorial-standards",
  "corrections",
  "contact",
  "privacy",
  "terms",
  "copyright",
  // Documents the machinery the selection gate still runs on — clustering,
  // publisher tiers, ranking, coverage breadth. True, and a trust signal.
  "methodology",
];

/** Repo-root paths the static build must not see. */
const DROP_ROOT = [
  // Next 16 "Proxy" (formerly middleware) is unsupported by static export.
  // It only served 410s for the retired /story/ corpus; on Pages those URLs
  // are simply absent and answer 404 with the explanatory 404 page.
  "middleware.ts",
  // `next build` type-checks every file tsconfig includes, and the test suite
  // imports aggregator routes that this copy has just pruned. Those imports
  // would fail the build for a reason that says nothing about the site. The
  // tests still run — against the full tree, in CI, before this script.
  "tests",
  "playwright.config.ts",
  "vitest.config.ts",
];

/** Files that must exist in the output or the build is wrong. */
const REQUIRED_OUTPUT = [
  "index.html",
  "404.html",
  "articles.html",
  "about.html",
  "editorial-standards.html",
  "corrections.html",
  "sitemap.xml",
  "robots.txt",
  "rss.xml",
  "CNAME",
  ".nojekyll",
];

const COPY_EXCLUDE = new Set([".git", "node_modules", ".next", "out", ".static-build"]);

function log(message) {
  console.log(`[static-site] ${message}`);
}

function fail(message) {
  console.error(`[static-site] FAILED: ${message}`);
  process.exit(1);
}

function copyRepoToScratch() {
  rmSync(SCRATCH, { recursive: true, force: true });
  mkdirSync(SCRATCH, { recursive: true });
  for (const entry of readdirSync(ROOT)) {
    if (COPY_EXCLUDE.has(entry)) continue;
    cpSync(join(ROOT, entry), join(SCRATCH, entry), { recursive: true });
  }
  // Symlink, not copy: node_modules is ~900 MB and read-only for a build.
  symlinkSync(join(ROOT, "node_modules"), join(SCRATCH, "node_modules"), "dir");
}

function pruneApp() {
  const appDir = join(SCRATCH, "app");
  const keep = new Set(KEEP_APP);
  const removed = [];
  for (const entry of readdirSync(appDir)) {
    if (keep.has(entry)) continue;
    rmSync(join(appDir, entry), { recursive: true, force: true });
    removed.push(entry);
  }
  for (const path of DROP_ROOT) rmSync(join(SCRATCH, path), { recursive: true, force: true });
  log(`pruned ${removed.length} app/ entries not on the static allowlist`);
}

/** Copy site/** over the scratch tree. Overlaid directories are replaced whole. */
function applyOverlay() {
  const siteDir = join(SCRATCH, "site");
  if (!existsSync(siteDir)) fail("site/ overlay directory is missing");
  const overlayApp = join(siteDir, "app");
  const entries = readdirSync(overlayApp);
  for (const entry of entries) {
    const target = join(SCRATCH, "app", entry);
    // Replace, don't merge: a leftover loading.tsx or opengraph-image from the
    // aggregator version of a route would drag its imports into the build.
    rmSync(target, { recursive: true, force: true });
    cpSync(join(overlayApp, entry), target, { recursive: true });
  }
  // public/ files are replaced file by file (never the whole directory: the
  // IndexNow key file and the brand images live there and are not overlaid).
  const overlayPublic = join(siteDir, "public");
  if (existsSync(overlayPublic)) {
    for (const entry of readdirSync(overlayPublic)) {
      cpSync(join(overlayPublic, entry), join(SCRATCH, "public", entry), { recursive: true });
      entries.push(`public/${entry}`);
    }
  }
  // The overlay must not also be compiled as a second copy of those routes.
  rmSync(siteDir, { recursive: true, force: true });
  log(`applied ${entries.length} overlay entries: ${entries.join(", ")}`);
}

/**
 * Static export refuses a dynamic route whose generateStaticParams returns
 * nothing. With zero published articles, /article/[slug] has nothing, and the
 * deploy would fail — a day with nothing to publish must not take the site
 * down. So drop the route for that build. The /articles index still renders
 * its empty state.
 *
 * This counts files claiming status "published"; the schema is still what
 * decides. A file that claims it but fails validation is skipped by the store,
 * and if that leaves zero, next build fails loudly — the correct outcome for a
 * broken article.
 */
function handleEmptyArticleStore() {
  const dir = join(SCRATCH, "content", "articles");
  const claimsPublished = existsSync(dir)
    ? walk(dir).some((file) => {
        if (!file.endsWith(".json")) return false;
        try {
          return JSON.parse(readFileSync(file, "utf8")).status === "published";
        } catch {
          return false;
        }
      })
    : false;
  if (!claimsPublished) {
    rmSync(join(SCRATCH, "app", "article"), { recursive: true, force: true });
    log("WARNING: no published articles — building without the /article route");
  }
}

function runBuild() {
  log(`next build (static export) for ${SITE_URL}`);
  const result = spawnSync("npx", ["next", "build"], {
    cwd: SCRATCH,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_MODE: "static",
      NEXT_PUBLIC_SITE_URL: SITE_URL,
      NEXT_TELEMETRY_DISABLED: "1",
      STATIC_BUILD_TURBOPACK_ROOT: ROOT,
      // The static site renders no aggregated stories. Pin the data mode so
      // nothing in a kept page can reach for a provider at build time.
      NEWS_DATA_MODE: "mock",
    },
  });
  if (result.status !== 0) fail(`next build exited ${result.status}`);
}

function collectOutput() {
  const built = join(SCRATCH, "out");
  if (!existsSync(built)) fail("next build produced no out/ directory");
  rmSync(OUT, { recursive: true, force: true });
  cpSync(built, OUT, { recursive: true });
  // GitHub Pages: CNAME binds the custom domain; .nojekyll stops Jekyll from
  // discarding the _next/ directory (Jekyll ignores paths starting with _).
  writeFileSync(join(OUT, "CNAME"), `${CUSTOM_DOMAIN}\n`);
  writeFileSync(join(OUT, ".nojekyll"), "");
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

/**
 * Does an internal URL resolve to a file GitHub Pages would serve?
 * Pages resolves `/x` to `x`, then `x.html`, then `x/index.html`.
 */
function resolvesInOutput(pathname) {
  const clean = decodeURIComponent(pathname.split("#")[0].split("?")[0]);
  if (clean === "/" || clean === "") return existsSync(join(OUT, "index.html"));
  const rel = clean.replace(/^\//, "").replace(/\/$/, "");
  return (
    existsSync(join(OUT, rel)) && statSync(join(OUT, rel)).isFile()
  ) || existsSync(join(OUT, `${rel}.html`)) || existsSync(join(OUT, rel, "index.html"));
}

function checkOutput() {
  const missing = REQUIRED_OUTPUT.filter((file) => !existsSync(join(OUT, file)));
  if (missing.length > 0) fail(`required output missing: ${missing.join(", ")}`);

  // Every internal href/src in every page must resolve to a file in out/.
  const pages = walk(OUT).filter((file) => file.endsWith(".html"));
  const broken = new Map();
  const attr = /\b(?:href|src)="([^"]+)"/g;
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    for (const match of html.matchAll(attr)) {
      let url = match[1];
      if (url.startsWith(SITE_URL)) url = url.slice(SITE_URL.length) || "/";
      if (!url.startsWith("/") || url.startsWith("//")) continue; // external or relative
      if (url.startsWith("/_next/")) continue; // checked implicitly: build emits them
      if (!resolvesInOutput(url)) {
        const from = relative(OUT, page).split(sep).join("/");
        if (!broken.has(url)) broken.set(url, new Set());
        broken.get(url).add(from);
      }
    }
  }
  if (broken.size > 0) {
    const lines = [...broken].map(
      ([url, from]) => `  ${url}  <- ${[...from].slice(0, 3).join(", ")}${from.size > 3 ? ` (+${from.size - 3})` : ""}`,
    );
    fail(`${broken.size} internal link(s) point at pages the static site does not have:\n${lines.join("\n")}`);
  }

  // Machine-read files list absolute URLs, and a crawler or AI engine will
  // follow every one. A sitemap URL that 404s is a Search Console error; an
  // llms.txt link that 404s is an AI engine citing a dead page.
  const siteUrl = new RegExp(`${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/[^\\s<>"')\\]]*)?`, "g");
  for (const file of ["llms.txt", "sitemap.xml", "rss.xml", "robots.txt"]) {
    const path = join(OUT, file);
    if (!existsSync(path)) continue;
    for (const match of readFileSync(path, "utf8").matchAll(siteUrl)) {
      const pathname = match[1] ?? "/";
      if (!resolvesInOutput(pathname)) {
        if (!broken.has(pathname)) broken.set(pathname, new Set());
        broken.get(pathname).add(file);
      }
    }
  }
  if (broken.size > 0) {
    const lines = [...broken].map(([url, from]) => `  ${url}  <- ${[...from].join(", ")}`);
    fail(`${broken.size} URL(s) in machine-read files point at pages the static site does not have:\n${lines.join("\n")}`);
  }

  // The live site must never announce demo data.
  for (const page of pages) {
    if (readFileSync(page, "utf8").includes("Demo data")) {
      fail(`demo-data banner rendered in ${relative(OUT, page)}`);
    }
  }

  log(`checked ${pages.length} pages + llms.txt/sitemap/rss/robots: every internal link and listed URL resolves`);
}

/** Run only when executed directly, so tests can import KEEP_APP safely. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  copyRepoToScratch();
  pruneApp();
  applyOverlay();
  handleEmptyArticleStore();
  runBuild();
  collectOutput();
  checkOutput();
  log(`done -> ${relative(ROOT, OUT) || "."}`);
}
