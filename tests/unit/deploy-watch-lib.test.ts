import { describe, expect, it } from "vitest";

import {
  assessDeploys,
  collapseBySha,
  formatHours,
  isProductionEnvironment,
} from "../../scripts/deploy-watch-lib.mjs";

type Entry = {
  sha: string;
  environment: string;
  createdAt: string;
  state: string | null;
};

/** Two Vercel projects are wired to this repo, so every push makes two records. */
const bothProjects = (sha: string, createdAt: string, state: string | null): Entry[] => [
  { sha, environment: "Production – currentwire", createdAt, state },
  { sha, environment: "Production – cuurentwire", createdAt, state },
];

describe("isProductionEnvironment", () => {
  it("keeps Vercel's per-project production names and drops previews", () => {
    expect(isProductionEnvironment("Production – currentwire")).toBe(true);
    expect(isProductionEnvironment("Production – cuurentwire")).toBe(true);
    expect(isProductionEnvironment("Preview – currentwire")).toBe(false);
    expect(isProductionEnvironment(undefined)).toBe(false);
  });
});

describe("collapseBySha", () => {
  it("reduces both projects to one verdict per commit, newest first", () => {
    const commits = collapseBySha([
      ...bothProjects("bbb", "2026-09-01T22:03:07Z", "failure"),
      ...bothProjects("aaa", "2026-08-31T12:45:29Z", "success"),
    ]);
    expect(commits.map((c) => [c.sha, c.state])).toEqual([
      ["bbb", "failure"],
      ["aaa", "success"],
    ]);
  });

  it("treats a commit as shipped when either project succeeded", () => {
    // The duplicate-project mixup (backlog 00) must not manufacture alarms:
    // if the serving project shipped it, the code IS live.
    const commits = collapseBySha([
      { sha: "aaa", environment: "Production – currentwire", createdAt: "2026-09-01T00:00:00Z", state: "success" },
      { sha: "aaa", environment: "Production – cuurentwire", createdAt: "2026-09-01T00:00:05Z", state: "failure" },
    ]);
    expect(commits).toEqual([{ sha: "aaa", at: "2026-09-01T00:00:05Z", state: "success" }]);
  });

  it("ignores preview deployments entirely", () => {
    expect(collapseBySha([{ sha: "aaa", environment: "Preview", createdAt: "2026-09-01T00:00:00Z", state: "failure" }])).toEqual([]);
  });
});

describe("assessDeploys", () => {
  it("fails when a failed deploy stands with no success after it", () => {
    // The real 2026-08-31 shape: f8805af shipped, 72e30e7 onward did not.
    const verdict = assessDeploys(
      [
        ...bothProjects("72e30e7", "2026-08-31T21:39:53Z", "failure"),
        ...bothProjects("f8805af", "2026-08-31T12:45:29Z", "success"),
      ],
      { now: new Date("2026-09-03T00:00:00Z") },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.failingShas).toEqual(["72e30e7"]);
    expect(verdict.lastSuccess?.sha).toBe("f8805af");
    expect(verdict.hoursSinceSuccess).toBeCloseTo(59.24, 1);
    expect(verdict.summary).toContain("cannot ship code");
  });

  it("passes when the newest deploy succeeded, even after earlier failures", () => {
    // Self-clearing: the fix landing is what closes the alert.
    const verdict = assessDeploys(
      [
        ...bothProjects("ccc", "2026-09-03T10:00:00Z", "success"),
        ...bothProjects("bbb", "2026-09-02T10:00:00Z", "failure"),
        ...bothProjects("aaa", "2026-09-01T10:00:00Z", "success"),
      ],
      { now: new Date("2026-09-03T11:00:00Z") },
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.failingShas).toEqual([]);
    expect(verdict.lastSuccess?.sha).toBe("ccc");
  });

  it("does not treat an in-flight build as a failure", () => {
    const verdict = assessDeploys(
      [
        ...bothProjects("bbb", "2026-09-03T10:59:00Z", null),
        ...bothProjects("aaa", "2026-09-03T09:00:00Z", "success"),
      ],
      { now: new Date("2026-09-03T11:00:00Z") },
    );
    expect(verdict.ok).toBe(true);
    expect(verdict.lastSuccess?.sha).toBe("aaa");
  });

  it("fails when nothing in the window ever succeeded", () => {
    const verdict = assessDeploys(bothProjects("bbb", "2026-09-02T10:00:00Z", "failure"), {
      now: new Date("2026-09-03T10:00:00Z"),
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.lastSuccess).toBeNull();
    expect(verdict.hoursSinceSuccess).toBeNull();
    expect(verdict.summary).toContain("no successful deployment in the API window");
  });

  it("stays silent rather than guessing when every record is in flight", () => {
    const verdict = assessDeploys(bothProjects("bbb", "2026-09-03T10:59:00Z", null));
    expect(verdict.ok).toBe(true);
    expect(verdict.inconclusive).toBe(true);
  });

  it("counts every commit stranded behind the failure, not just the newest", () => {
    const verdict = assessDeploys(
      [
        ...bothProjects("ddd", "2026-09-03T10:00:00Z", "failure"),
        ...bothProjects("ccc", "2026-09-02T10:00:00Z", "failure"),
        ...bothProjects("bbb", "2026-09-01T10:00:00Z", "failure"),
        ...bothProjects("aaa", "2026-08-31T10:00:00Z", "success"),
      ],
      { now: new Date("2026-09-03T11:00:00Z") },
    );
    expect(verdict.failingShas).toEqual(["ddd", "ccc", "bbb"]);
  });
});

describe("assessDeploys — the integration-went-silent rule", () => {
  it("fails when Vercel created no deployment at all for the newest commit", () => {
    // The blind spot in rule one: disconnect the integration and the newest
    // record stays `success` forever while nothing ships.
    const verdict = assessDeploys(bothProjects("aaa", "2026-09-01T10:00:00Z", "success"), {
      now: new Date("2026-09-03T12:00:00Z"),
      headCommitAt: "2026-09-03T08:00:00Z",
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.summary).toContain("no deployment at all");
  });

  it("gives a fresh push time to produce its record before judging", () => {
    const verdict = assessDeploys(bothProjects("aaa", "2026-09-01T10:00:00Z", "success"), {
      now: new Date("2026-09-03T12:00:00Z"),
      headCommitAt: "2026-09-03T11:59:00Z",
    });
    expect(verdict.ok).toBe(true);
  });

  it("stays quiet when the newest commit already has its record", () => {
    const verdict = assessDeploys(bothProjects("aaa", "2026-09-03T08:00:30Z", "success"), {
      now: new Date("2026-09-03T12:00:00Z"),
      headCommitAt: "2026-09-03T08:00:00Z",
    });
    expect(verdict.ok).toBe(true);
  });

  it("reports a failed deploy as a failure, not as silence", () => {
    // Both rules can fire; the specific diagnosis must win.
    const verdict = assessDeploys(
      [
        ...bothProjects("bbb", "2026-09-03T08:00:30Z", "failure"),
        ...bothProjects("aaa", "2026-09-01T10:00:00Z", "success"),
      ],
      { now: new Date("2026-09-03T12:00:00Z"), headCommitAt: "2026-09-03T08:00:00Z" },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.summary).toContain("cannot ship code");
    expect(verdict.failingShas).toEqual(["bbb"]);
  });
});

describe("formatHours", () => {
  it("reads naturally across minutes, hours and days", () => {
    expect(formatHours(0.5)).toBe("30m");
    expect(formatHours(3.25)).toBe("3.3h");
    expect(formatHours(60)).toBe("2.5d");
    expect(formatHours(null)).toBe("unknown time");
  });
});
