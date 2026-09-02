/**
 * Pure decision logic for the deploy watch (scripts/deploy-watch.mjs).
 *
 * Answers the one question no check in this repo asked before 2026-09-03:
 * *is production running the code we pushed?* Every other probe — uptime.yml,
 * seo-health.yml, url-survival.yml — tests the SITE, and the site stays
 * perfectly healthy while the build that serves it goes stale, because the
 * cron and ISR keep feeding fresh news into an old bundle. That is exactly
 * how a shipping outage starting 2026-08-31 21:39 UTC went unseen for two
 * days: production served f8805af the whole time and answered every check.
 *
 * The signal used here is GitHub's deployments API, which the Vercel
 * integration writes to. The 2026-09-02 run dismissed it as noise ("all 30
 * report failure, including ones that demonstrably shipped") and that was
 * wrong — re-measured 2026-09-03, f8805af and 4b64c6e (the commits that DID
 * ship) report `success`, and every deployment from 72e30e7 onward reports
 * `failure`. The signal is clean, needs no endpoint on the site, and needs no
 * deploy to start working — which matters, because it has to work while
 * deploys are broken.
 *
 * Kept free of I/O so the verdict is unit-testable against recorded API
 * shapes; scripts/deploy-watch.mjs does the fetching.
 */

/** GitHub deployment states that mean "this attempt is over, and it lost". */
export const FAILED_STATES = new Set(["failure", "error"]);

/** …and the one that means it won. Anything else is still in flight. */
export const SUCCESS_STATE = "success";

/**
 * Vercel names its environments "Production – <project>". The duplicate
 * `cuurentwire` project was deleted 2026-09-03 (backlog 00d), so a commit now
 * produces ONE Production record; only previews are filtered out here. The
 * prefix match is deliberately generic so a renamed or re-added project keeps
 * working without a code change.
 */
export function isProductionEnvironment(environment) {
  return typeof environment === "string" && environment.startsWith("Production");
}

/**
 * Collapse deployment records to one verdict per commit.
 *
 * A commit counts as SHIPPED when any of its production deployments
 * succeeded. With the duplicate project gone (backlog 00d) there is normally
 * only one record per commit, so this is now a plain read of that record —
 * and the signal is strictly sharper than before, since a failing duplicate
 * can no longer mask anything. The any-success rule is kept because it is the
 * correct semantics if a second project is ever wired up again.
 *
 * @param {Array<{sha: string, environment: string, createdAt: string, state: string|null}>} entries
 * @returns {Array<{sha: string, at: string, state: "success"|"failure"|"pending"}>} newest first
 */
export function collapseBySha(entries) {
  const bySha = new Map();
  for (const entry of entries) {
    if (!isProductionEnvironment(entry.environment)) continue;
    const current = bySha.get(entry.sha) ?? { sha: entry.sha, at: entry.createdAt, state: "pending" };
    // Keep the newest timestamp for the commit, so ordering reflects the last
    // time Vercel acted on it rather than whichever project reported first.
    if (entry.createdAt > current.at) current.at = entry.createdAt;
    if (entry.state === SUCCESS_STATE) current.state = "success";
    else if (FAILED_STATES.has(entry.state) && current.state !== "success") current.state = "failure";
    bySha.set(entry.sha, current);
  }
  return [...bySha.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * The verdict.
 *
 * Alarms when a failed deployment stands with no successful one after it —
 * the precise shape of "we pushed and it did not ship". It self-clears on the
 * next success, so an open alert always means broken right now (the property
 * seo-health.yml had to be retrofitted with on 2026-08-27).
 *
 * Commits still in flight are ignored rather than treated as failures, so a
 * run that fires mid-build does not cry wolf.
 *
 * A second, independent rule catches the blind spot in the first: if the Vercel
 * integration is disconnected it stops writing records altogether, the newest
 * one stays `success` forever, and rule one goes permanently green while
 * nothing ships. So a HEAD commit older than `silenceHours` with no deployment
 * record at all is also an alarm. Every push observed creates a record —
 * including ones vercel.json's ignoreCommand skips — so silence really is
 * abnormal.
 *
 * @param {Array<{sha: string, environment: string, createdAt: string, state: string|null}>} entries
 * @param {{now?: Date, headCommitAt?: string|null, silenceHours?: number}} [options]
 */
export function assessDeploys(entries, { now = new Date(), headCommitAt = null, silenceHours = 2 } = {}) {
  const commits = collapseBySha(entries);
  const settled = commits.filter((c) => c.state !== "pending");

  const newestRecordAt = commits[0]?.at ?? null;
  const headAgeHours = headCommitAt ? (now.getTime() - new Date(headCommitAt).getTime()) / 3_600_000 : null;
  // Only judge silence once the commit has had well past a build's head start.
  if (headCommitAt && headAgeHours > silenceHours && (!newestRecordAt || newestRecordAt < headCommitAt)) {
    return {
      ok: false,
      inconclusive: false,
      lastSuccess: null,
      hoursSinceSuccess: null,
      failingShas: [],
      summary:
        `Vercel created no deployment at all for the newest commit on main (pushed ${formatHours(headAgeHours)} ago). ` +
        "The GitHub integration looks disconnected — that ships nothing while every site probe stays green.",
    };
  }

  if (settled.length === 0) {
    return {
      ok: true,
      inconclusive: true,
      lastSuccess: null,
      hoursSinceSuccess: null,
      failingShas: [],
      summary: "No settled production deployments in the API window — nothing to judge.",
    };
  }

  const successIndex = settled.findIndex((c) => c.state === "success");
  const lastSuccess = successIndex === -1 ? null : settled[successIndex];
  const failingSince = (successIndex === -1 ? settled : settled.slice(0, successIndex)).filter(
    (c) => c.state === "failure",
  );

  const hoursSinceSuccess = lastSuccess
    ? (now.getTime() - new Date(lastSuccess.at).getTime()) / 3_600_000
    : null;

  if (failingSince.length === 0) {
    return {
      ok: true,
      inconclusive: false,
      lastSuccess,
      hoursSinceSuccess,
      failingShas: [],
      summary: `Production is shipping — last successful deploy ${lastSuccess.sha.slice(0, 7)}, ${formatHours(hoursSinceSuccess)} ago.`,
    };
  }

  const stale =
    hoursSinceSuccess === null
      ? "no successful deployment in the API window at all"
      : `${formatHours(hoursSinceSuccess)} since the last one that shipped (${lastSuccess.sha.slice(0, 7)})`;

  return {
    ok: false,
    inconclusive: false,
    lastSuccess,
    hoursSinceSuccess,
    failingShas: failingSince.map((c) => c.sha),
    summary: `Production cannot ship code: ${failingSince.length} commit(s) failed to deploy and none has succeeded since — ${stale}.`,
  };
}

/** Hours as a short human string, so reports read the same everywhere. */
export function formatHours(hours) {
  if (hours === null || !Number.isFinite(hours)) return "unknown time";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
