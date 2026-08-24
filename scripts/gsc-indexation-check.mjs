#!/usr/bin/env node
/**
 * URL Inspection sweep over the evergreen surfaces (seo/STRATEGY.md Sprint 1:
 * "dead-template indexation check FIRST" — a page with zero impressions can
 * be an INDEXING failure, which no retitle fixes, so every zero-traffic
 * surface is classified before any packaging work is judged).
 *
 * Inspects the homepage, the evergreen list surfaces, all public category
 * pages and all topic hubs through the Search Console URL Inspection API
 * (searchconsole.googleapis.com/v1/urlInspection/index:inspect, ~35 calls —
 * far under the 2,000/day quota) and writes data/gsc-indexation.json:
 * per URL the verdict, coverageState, indexingState, lastCrawlTime and the
 * Google-selected canonical, plus a `bucket` — "indexed", "crawled-not-
 * indexed", "not-crawled", "blocked" or "error" — the first split of the
 * strategy's six-bucket failure classification. Weekly runs read this to
 * decide retitle vs indexing work; the gsc.yml `data/gsc-*.json` glob
 * commits it.
 *
 * Auth is the same service-account JWT flow as scripts/gsc-report.mjs
 * (deliberately duplicated — that script is not importable, it has
 * top-level side effects). Without GSC_SERVICE_ACCOUNT_JSON it prints
 * "skipped" and exits 0 so the workflow stays green until the secret exists.
 *
 * Usage: GSC_SERVICE_ACCOUNT_JSON='{...}' node scripts/gsc-indexation-check.mjs
 *        [--base https://currentwire.us] [--site sc-domain:currentwire.us]
 */

import { createSign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { markdownTable } from "./gsc-report-lib.mjs";

const argValue = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

const BASE = argValue("--base") ?? "https://currentwire.us";
const SITE = argValue("--site") || process.env.GSC_SITE_URL || "sc-domain:currentwire.us";
const OUT_PATH = fileURLToPath(new URL("../data/gsc-indexation.json", import.meta.url));

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

/** The evergreen surfaces whose indexation state gates the retitle work. */
const PATHS = [
  "/",
  "/briefing",
  "/top-10",
  "/most-covered",
  "/latest",
  "/reports/media-coverage",
  "/topics",
  "/sources",
  "/us",
  "/canada",
  // Public categories (config/categories.ts PUBLIC_CATEGORY_IDS).
  "/politics", "/business", "/technology", "/world", "/climate",
  "/health", "/science", "/culture", "/sports",
  // Topic hubs (config/hubs.ts).
  "/ai", "/elections", "/immigration", "/courts", "/crime", "/education",
  "/housing", "/jobs", "/money", "/weather", "/energy", "/space",
  "/autos", "/travel", "/obituaries",
];

const secretJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!secretJson) {
  console.log("skipped: GSC_SERVICE_ACCOUNT_JSON not set");
  process.exit(0);
}
let account;
try {
  account = JSON.parse(secretJson);
  if (!account.client_email || !account.private_key) throw new Error("missing client_email / private_key");
} catch (error) {
  console.error(`[indexation-check] GSC_SERVICE_ACCOUNT_JSON is not a service-account key: ${error.message}`);
  process.exit(1);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(sa) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: sa.token_uri ?? TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  return `${header}.${claims}.${signer.sign(sa.private_key).toString("base64url")}`;
}

async function fetchAccessToken(sa) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signJwt(sa),
  });
  const response = await fetch(sa.token_uri ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(`token endpoint ${response.status}: ${json.error_description ?? json.error ?? "no access_token"}`);
  }
  return json.access_token;
}

/**
 * First split of the six-bucket classification. "indexed" pages may still
 * have demand/intent/CTR failures — those need query data, not this API.
 */
function bucketOf(result) {
  if (!result) return "error";
  const coverage = (result.coverageState ?? "").toLowerCase();
  if (result.verdict === "PASS") return "indexed";
  if (coverage.includes("blocked") || result.robotsTxtState === "DISALLOWED") return "blocked";
  if (coverage.includes("crawled")) return "crawled-not-indexed";
  if (coverage.includes("discovered") || coverage.includes("unknown") || !result.lastCrawlTime) {
    return "not-crawled";
  }
  return "crawled-not-indexed";
}

async function inspect(token, url) {
  const response = await fetch(INSPECT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status}: ${json.error?.message ?? "unknown error"}`);
  }
  return json.inspectionResult?.indexStatusResult ?? null;
}

async function main() {
  const token = await fetchAccessToken(account);
  const rows = [];
  for (const path of PATHS) {
    const url = `${BASE}${path}`;
    try {
      const result = await inspect(token, url);
      rows.push({
        path,
        bucket: bucketOf(result),
        verdict: result?.verdict ?? null,
        coverageState: result?.coverageState ?? null,
        indexingState: result?.indexingState ?? null,
        lastCrawlTime: result?.lastCrawlTime ?? null,
        googleCanonical: result?.googleCanonical ?? null,
      });
    } catch (error) {
      rows.push({ path, bucket: "error", error: error.message });
    }
  }

  const counts = {};
  for (const row of rows) counts[row.bucket] = (counts[row.bucket] ?? 0) + 1;

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(
    OUT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), site: SITE, base: BASE, counts, rows }, null, 2)}\n`,
  );

  console.log(`## Indexation check (${rows.length} evergreen surfaces)\n`);
  console.log(
    markdownTable(
      ["Path", "Bucket", "Coverage", "Last crawl"],
      rows.map((r) => [r.path, r.bucket, r.coverageState ?? r.error ?? "—", r.lastCrawlTime?.slice(0, 10) ?? "—"]),
    ),
  );
  console.log(`\n[indexation-check] wrote ${OUT_PATH} — ${JSON.stringify(counts)}`);
  const broken = rows.filter((r) => r.bucket !== "indexed");
  if (broken.length) {
    console.log(
      `Non-indexed surfaces need INDEXING work before any retitle is judged: ${broken.map((r) => r.path).join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(`[indexation-check] ${error.message}`);
  process.exit(1);
});
