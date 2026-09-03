import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The Vercel "Ignored Build Step". Contract: exit 0 = skip the build,
 * exit 1 = run it, anything else = Vercel marks the deployment "Build Failed".
 *
 * This suite builds a throwaway git repo and drives the script the way Vercel
 * does, because the 2026-08-31 shipping outage was caused by an exit code
 * nobody had ever executed: the inline command exited 128 on `fatal: bad
 * object` when VERCEL_GIT_PREVIOUS_SHA aged out of Vercel's shallow clone,
 * and stayed that way for three days.
 */

const script = resolve(__dirname, "../../scripts/vercel-ignore-build.sh");
let repo: string;

const git = (args: string[], cwd = repo) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Runs the script the way Vercel does and returns its exit code. */
const run = (previousSha: string | undefined, cwd = repo) => {
  try {
    execFileSync("bash", [script], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        ...(previousSha === undefined ? {} : { VERCEL_GIT_PREVIOUS_SHA: previousSha }),
      },
    });
    return 0;
  } catch (error) {
    return (error as { status: number }).status;
  }
};

const commit = (path: string, body: string, message: string) => {
  const full = join(repo, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", message]);
  return git(["rev-parse", "HEAD"]);
};

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "ignore-build-"));
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "test"]);
  commit("app/page.tsx", "export default function P() {}\n", "initial");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("vercel ignore build step", () => {
  it("builds when the base commit is missing from a shallow clone", () => {
    // THE OUTAGE. A sha that is not in this repo at all is exactly what
    // VERCEL_GIT_PREVIOUS_SHA became once the last successful deploy aged out.
    // The old inline command exited 128 here and Vercel called it a build
    // failure; the only safe answer is 1 (build).
    expect(run("f8805af4282c6a4405daca6b8961ea5ae092b42e")).toBe(1);
  });

  it("skips the build for a docs-only commit", () => {
    const base = git(["rev-parse", "HEAD"]);
    commit("seo/reports/2026-09-03.md", "# report\n", "seo: daily run");
    expect(run(base)).toBe(0);
  });

  it("builds for a commit that touches app code", () => {
    const base = git(["rev-parse", "HEAD"]);
    commit("app/page.tsx", "export default function P() { return null }\n", "feat: change");
    expect(run(base)).toBe(1);
  });

  it("skips when only data/ and .github/ changed", () => {
    const base = git(["rev-parse", "HEAD"]);
    writeFileSync(join(repo, "data-ledger.tmp"), "");
    mkdirSync(join(repo, "data"), { recursive: true });
    mkdirSync(join(repo, ".github", "workflows"), { recursive: true });
    writeFileSync(join(repo, "data", "url-ledger.json"), "{}\n");
    writeFileSync(join(repo, ".github", "workflows", "x.yml"), "name: x\n");
    rmSync(join(repo, "data-ledger.tmp"));
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "chore: ledger"]);
    expect(run(base)).toBe(0);
  });

  it("builds when a compiled-in data file changed, though data/ is excluded", () => {
    // backlog 00b. data/ is excluded as an ISR cost control, but three files
    // under it are static imports compiled into the bundle, so a commit that
    // only touches one of them still has to ship. Measured before this rule
    // existed, by running this script against real history: the GSC commits
    // 9ee4cc9, bf493b7 and 520caef each rewrote data/gsc-url-signals.json and
    // each exited 0 = skip, so the noindex policy those files govern never
    // reached production on its own.
    const base = git(["rev-parse", "HEAD"]);
    commit("data/gsc-url-signals.json", '{"generatedAt":"2026-09-04"}\n', "chore: gsc report");
    expect(run(base)).toBe(1);
  });

  it("builds for a tombstone commit that touches nothing but data/", () => {
    // The sharper half of the same defect: 593e369 shipped its two tombstones
    // only because it happened to touch tests/ as well. Without that accident
    // the two URLs would have gone on answering 500 to crawlers.
    const base = git(["rev-parse", "HEAD"]);
    commit("data/lost-stories.json", '["c123"]\n', "fix(archive): tombstone");
    expect(run(base)).toBe(1);
  });

  it("still skips a data/ commit that touches no compiled-in file", () => {
    // The boundary the rule moves, asserted from the other side. Report and
    // measurement files under data/ land ~12x/day and every deploy wipes the
    // ISR cache; widening the rule to all of data/ would have re-created the
    // cost problem the exclusion exists to solve.
    const base = git(["rev-parse", "HEAD"]);
    commit("data/cwv-history.json", "[]\n", "chore: cwv history");
    expect(run(base)).toBe(0);
  });

  it("falls back to HEAD^ when Vercel supplies no previous sha", () => {
    // First-ever deployment of a project: the variable is absent entirely.
    commit("app/page.tsx", "export default function P() { return <p/> }\n", "feat: another");
    expect(run(undefined)).toBe(1);
  });

  it("never exits with a code Vercel would read as a build error", () => {
    // The property that actually matters, asserted over every case above.
    const codes = [
      run("f8805af4282c6a4405daca6b8961ea5ae092b42e"),
      run("not-a-sha-at-all"),
      run(""),
      run(git(["rev-parse", "HEAD~1"])),
    ];
    for (const code of codes) expect([0, 1]).toContain(code);
  });
});
