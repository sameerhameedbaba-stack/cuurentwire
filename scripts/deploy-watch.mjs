#!/usr/bin/env node
/**
 * Deploy watch — "is production running the code we pushed?"
 *
 * Reads GitHub's deployments API (written by the Vercel integration), collapses
 * it to one verdict per commit and exits non-zero when a failed deployment
 * stands with no successful one after it. See scripts/deploy-watch-lib.mjs for
 * why this signal — and not a probe of the site — is the one that catches a
 * shipping outage: the site stays healthy through one, because the cron and
 * ISR keep feeding fresh news into a stale bundle.
 *
 * Exit codes, and the difference matters: 0 shipping, 1 NOT shipping,
 * 2 could-not-check. A rate limit is not evidence of an outage and must never
 * page the owner as one.
 *
 * $0: GitHub's REST API, no keys required for a public repo (GITHUB_TOKEN is
 * used when present, purely to lift the 60 req/h anonymous rate limit).
 *
 * Usage:  node scripts/deploy-watch.mjs [--repo owner/name] [--limit 30]
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  BUILD_EXCLUDED_PATHSPECS,
  assessDeploys,
  formatHours,
  isProductionEnvironment,
} from "./deploy-watch-lib.mjs";

const execFileAsync = promisify(execFile);

/**
 * The commit date of the newest commit that would actually trigger a build —
 * i.e. one touching something outside the paths vercel.json's ignoreCommand
 * skips. Skipped builds write no deployment record, so judging plain HEAD
 * turns every routine report commit into "the integration is disconnected"
 * (that was [auto-alert] #9, opened against a build that never ran).
 *
 * Returns null when git cannot answer — a shallow clone with no such commit in
 * range, or no git at all. Null makes the silence rule stand down rather than
 * guess: this repo has already paid for one alarm that cried wolf.
 */
async function newestDeployableCommitDate() {
  const args = [
    "log",
    "-1",
    "--format=%cI",
    "--",
    ".",
    ...BUILD_EXCLUDED_PATHSPECS.map((p) => `:(exclude)${p}`),
  ];
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: process.cwd() });
    const date = stdout.trim();
    if (date === "") return null;
    // git prints ISO 8601 in the COMMITTER's offset ("+05:30"), while every
    // GitHub timestamp is UTC "Z". Returning it raw made a lexicographic
    // comparison in the lib read 22:56Z as older than the same instant written
    // 04:26+05:30 and invert the verdict. Normalise here; the lib now also
    // compares instants rather than strings, so both ends are safe.
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } catch (error) {
    console.error(`Could not determine the newest code-changing commit: ${error.message}`);
    return null;
  }
}

const DEFAULT_REPO = "sameerhameedbaba-stack/cuurentwire";
// Statuses cost one request each, so only the newest records are resolved.
// 30 covers ~15 commits at two Vercel projects per push — several days.
const DEFAULT_LIMIT = 30;
const EXIT_UNDETERMINED = 2;

const argValue = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 || i === process.argv.length - 1 ? fallback : process.argv[i + 1];
};

const repo = argValue("--repo", process.env.GITHUB_REPOSITORY || DEFAULT_REPO);
const limit = Number(argValue("--limit", DEFAULT_LIMIT));
// GITHUB_API_URL is set by GitHub Actions itself; honouring it keeps the script
// correct on GHES and makes it addressable for tests.
const apiRoot = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
const api = `${apiRoot}/repos/${repo}`;

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "currentwire-deploy-watch",
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retries the transient statuses; a rate limit should not become a verdict. */
async function getJson(url) {
  let lastError;
  for (const backoffMs of [0, 2_000, 6_000]) {
    if (backoffMs) await sleep(backoffMs);
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res.json();
      // 403/429 are rate limits, 5xx are GitHub's problem — both worth a retry.
      if (res.status !== 403 && res.status !== 429 && res.status < 500) {
        throw new Error(`${res.status} ${res.statusText} for ${url}`);
      }
      lastError = new Error(`${res.status} ${res.statusText} for ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Sets the exit code instead of calling process.exit(): on Windows, exiting
 * with undici sockets still open aborts the process with a libuv assertion and
 * reports 127, which would make a real verdict unreadable.
 */
function finish(code, label) {
  const line = `\nDeploy watch: ${label}`;
  if (code === 0) console.log(line);
  else console.error(line);
  process.exitCode = code;
}

async function main() {
  let records;
  const deployableHeadAt = await newestDeployableCommitDate();
  try {
    records = await getJson(`${api}/deployments?per_page=100`);
  } catch (error) {
    console.error(`Could not read the deployments API: ${error.message}`);
    return finish(EXIT_UNDETERMINED, "UNDETERMINED (this is not evidence either way)");
  }

  if (!Array.isArray(records)) {
    console.error(`Unexpected deployments payload: ${JSON.stringify(records).slice(0, 200)}`);
    return finish(EXIT_UNDETERMINED, "UNDETERMINED (this is not evidence either way)");
  }

  const production = records.filter((r) => isProductionEnvironment(r.environment)).slice(0, limit);

  const entries = [];
  try {
    for (const record of production) {
      const statuses = await getJson(`${api}/deployments/${record.id}/statuses?per_page=1`);
      entries.push({
        sha: record.sha,
        environment: record.environment,
        createdAt: record.created_at,
        state: statuses[0]?.state ?? null,
      });
    }
  } catch (error) {
    console.error(`Could not read deployment statuses: ${error.message}`);
    return finish(EXIT_UNDETERMINED, "UNDETERMINED (this is not evidence either way)");
  }

  const verdict = assessDeploys(entries, { deployableHeadAt });

  console.log(`repo: ${repo}`);
  console.log(
    `newest code-changing commit: ${deployableHeadAt ?? "unknown (silence rule stood down)"}`,
  );
  console.log(`production deployment records inspected: ${entries.length}\n`);
  for (const entry of entries.slice(0, 12)) {
    const state = entry.state ?? "in flight";
    console.log(`  ${entry.createdAt}  ${entry.sha.slice(0, 7)}  ${entry.environment.padEnd(26)} ${state}`);
  }

  console.log(`\n${verdict.summary}`);

  if (verdict.ok) return finish(0, "PASS");

  const failing = [...new Set(verdict.failingShas)].map((s) => s.slice(0, 7));
  if (failing.length > 0) {
    console.error(`\nCommits that did not reach production: ${failing.join(", ")}`);
  }
  console.error(
    `Production has been unable to ship for ${formatHours(verdict.hoursSinceSuccess)}.\n` +
      "\nThe site itself may be perfectly healthy — it serves the last build that\n" +
      "succeeded, kept fresh by the cron and ISR. Only the Vercel dashboard can say\n" +
      "why a build fails: Vercel -> CurrentWire -> Deployments -> newest failed one.\n",
  );
  return finish(1, "FAIL");
}

await main();
