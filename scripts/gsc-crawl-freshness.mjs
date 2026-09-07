#!/usr/bin/env node
/**
 * Google crawl-freshness monitor (daily) — seo/BACKLOG.md item 0c.
 *
 * Asks the Search Console Sitemaps API when Google last DOWNLOADED each
 * submitted sitemap and fails when any of them has gone unread for longer
 * than MAX_UNREAD_HOURS (72). Run by .github/workflows/gsc-crawl-freshness.yml,
 * which turns a failure into an "[auto-alert]" issue and closes it on the
 * next green run.
 *
 * Why this exists, in one sentence: between 2026-08-24 and 2026-09-07
 * Googlebot stopped fetching this site — `news-sitemap.xml` and
 * `sitemap.xml` went fourteen days unread — while seo-health (24/24),
 * uptime, url-survival and surface-coherence stayed green every single day,
 * because all four measure what the site serves and none of them can see
 * what Google does. Item 0c was filed 2026-08-31 as "the item that would
 * have caught the other two" and was then the answer to two consecutive
 * weeks' worst finding.
 *
 * Cost: one OAuth token + one GET per run. It writes no file and commits
 * nothing, so it never triggers a Vercel deploy (ISR cost discipline).
 *
 * Auth is the same service-account JWT flow as scripts/gsc-report.mjs and
 * scripts/gsc-indexation-check.mjs, deliberately duplicated for the same
 * reason those two duplicate it: neither is importable (top-level side
 * effects and an immediate secret gate).
 *
 * Without GSC_SERVICE_ACCOUNT_JSON it prints "skipped" and exits 0, so the
 * workflow is green rather than misleadingly red on a repo without secrets.
 *
 * Usage: GSC_SERVICE_ACCOUNT_JSON='{...}' node scripts/gsc-crawl-freshness.mjs
 *        [--site sc-domain:currentwire.us] [--max-unread-hours 72]
 */

import { createSign } from "node:crypto";

import {
  MAX_UNREAD_HOURS,
  evaluateSitemapFreshness,
  formatFreshnessReport,
} from "./gsc-crawl-freshness-lib.mjs";

const argValue = (flag) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined;

// `||`, not `??`: the workflow passes an UNSET repository variable as "".
const SITE = argValue("--site") || process.env.GSC_SITE_URL || "sc-domain:currentwire.us";
const MAX_UNREAD = Number(argValue("--max-unread-hours") ?? MAX_UNREAD_HOURS);

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// ── 0. Secret gate ──────────────────────────────────────────────────────────
const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  console.log("skipped: GSC_SERVICE_ACCOUNT_JSON not set");
  process.exit(0);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("missing client_email / private_key");
  }
} catch (error) {
  console.error(`[crawl-freshness] GSC_SERVICE_ACCOUNT_JSON is not a service-account key: ${error.message}`);
  process.exit(1);
}

// ── 1. Auth: RS256 JWT → OAuth access token ─────────────────────────────────
const base64url = (value) => Buffer.from(value).toString("base64url");

function signJwt(account) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: account.token_uri ?? TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  return `${header}.${claims}.${signer.sign(account.private_key).toString("base64url")}`;
}

async function fetchAccessToken(account) {
  const response = await fetch(account.token_uri ?? TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(account),
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(`token endpoint ${response.status}: ${json.error_description ?? json.error ?? "no access_token"}`);
  }
  return json.access_token;
}

// ── 2. Sitemaps.list ────────────────────────────────────────────────────────
async function listSitemaps(token) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/sitemaps`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`sitemaps.list ${response.status}: ${text.slice(0, 300)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`sitemaps.list returned non-JSON: ${text.slice(0, 200)}`);
  }
  return json.sitemap ?? [];
}

// ── 3. Judge ────────────────────────────────────────────────────────────────
// An API failure exits 2, not 1: "could not check" is not "Google stopped
// reading", and the workflow reports the two differently (the same
// distinction deploy-watch learned on 2026-09-04).
let sitemaps;
try {
  const token = await fetchAccessToken(serviceAccount);
  sitemaps = await listSitemaps(token);
} catch (error) {
  console.error(`[crawl-freshness] could not check: ${error.message}`);
  process.exit(2);
}

const result = evaluateSitemapFreshness(sitemaps, {
  now: Date.now(),
  maxUnreadHours: MAX_UNREAD,
});
console.log(formatFreshnessReport(result));

if (!result.ok) {
  console.error(
    `[crawl-freshness] ${result.reason}. Google is not reading this site's sitemaps; see seo/BACKLOG.md item 0c.`,
  );
  process.exit(1);
}
console.log("crawl freshness: OK");
