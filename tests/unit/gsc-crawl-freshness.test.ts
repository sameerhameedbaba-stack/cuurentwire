import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MAX_UNREAD_HOURS,
  evaluateSitemapFreshness,
  formatFreshnessReport,
} from "../../scripts/gsc-crawl-freshness-lib.mjs";

const NOW = Date.parse("2026-09-07T22:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("evaluateSitemapFreshness", () => {
  it("passes when every sitemap was downloaded inside the window", () => {
    const result = evaluateSitemapFreshness(
      [
        { path: "https://currentwire.us/news-sitemap.xml", lastDownloaded: hoursAgo(2) },
        { path: "https://currentwire.us/sitemap.xml", lastDownloaded: hoursAgo(20) },
        { path: "https://currentwire.us/archive-sitemap.xml", lastDownloaded: hoursAgo(71.9) },
      ],
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    expect(result.stale).toHaveLength(0);
    expect(result.reason).toBeNull();
  });

  it("fails on the sitemap silence this monitor exists to catch", () => {
    // The real 2026-09-07 reading: news-sitemap and sitemap.xml last read
    // Aug 24 (14 days), archive-sitemap read Sep 4.
    const result = evaluateSitemapFreshness(
      [
        { path: "https://currentwire.us/news-sitemap.xml", lastDownloaded: hoursAgo(24 * 14) },
        { path: "https://currentwire.us/sitemap.xml", lastDownloaded: hoursAgo(24 * 14) },
        { path: "https://currentwire.us/archive-sitemap.xml", lastDownloaded: hoursAgo(24 * 3) },
      ],
      { now: NOW },
    );
    expect(result.ok).toBe(false);
    expect(result.stale.map((row: { path: string }) => row.path)).toEqual([
      "https://currentwire.us/news-sitemap.xml",
      "https://currentwire.us/sitemap.xml",
    ]);
    expect(result.reason).toContain("2 of 3");
  });

  it("puts the boundary at exactly the threshold, not near it", () => {
    const at = evaluateSitemapFreshness([{ path: "/a", lastDownloaded: hoursAgo(MAX_UNREAD_HOURS) }], { now: NOW });
    const past = evaluateSitemapFreshness(
      [{ path: "/a", lastDownloaded: hoursAgo(MAX_UNREAD_HOURS + 0.2) }],
      { now: NOW },
    );
    expect(at.ok).toBe(true);
    expect(past.ok).toBe(false);
  });

  it("does not alarm on a sitemap submitted moments ago and not yet read", () => {
    const result = evaluateSitemapFreshness([{ path: "/new.xml", lastSubmitted: hoursAgo(0.2) }], { now: NOW });
    expect(result.ok).toBe(true);
    expect(result.rows[0].neverRead).toBe(true);
    expect(result.rows[0].status).toBe("fresh");
  });

  it("alarms on a sitemap submitted long ago and never read", () => {
    const result = evaluateSitemapFreshness([{ path: "/new.xml", lastSubmitted: hoursAgo(200) }], { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.rows[0].neverRead).toBe(true);
  });

  it("reports an untimestamped sitemap as unknown, never as stale", () => {
    const result = evaluateSitemapFreshness([{ path: "/odd.xml" }, { path: "/b.xml", lastDownloaded: "not a date" }], {
      now: NOW,
    });
    expect(result.rows.map((row: { status: string }) => row.status)).toEqual(["unknown", "unknown"]);
    expect(result.stale).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it("fails when the property lists no sitemaps at all", () => {
    const result = evaluateSitemapFreshness([], { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("no sitemaps");
  });

  it("names every sitemap and the threshold in the alert body", () => {
    const result = evaluateSitemapFreshness(
      [{ path: "/news-sitemap.xml", lastDownloaded: hoursAgo(24 * 14) }],
      { now: NOW },
    );
    const text = formatFreshnessReport(result);
    expect(text).toContain("/news-sitemap.xml");
    expect(text).toContain("336h ago");
    expect(text).toContain("72h");
    expect(text).toContain("FAIL:");
  });
});

// ── The boundary this change moves ──────────────────────────────────────────
// GitHub auto-disables SCHEDULED workflows after 60 days of repository
// inactivity, so url-survival.yml and surface-coherence.yml each re-enable
// every scheduled workflow on every run — the two guard each other. On
// 2026-09-04 that list covered 3 of 9 workflows and the gap was found by
// hand. Adding a scheduled workflow without adding it to both lists
// re-creates exactly that gap, silently, so it is asserted here instead.
const WORKFLOW_DIR = fileURLToPath(new URL("../../.github/workflows/", import.meta.url));
const RE_ENABLERS = ["url-survival.yml", "surface-coherence.yml"];

function scheduledWorkflows(): string[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith(".yml"))
    .filter((name) => /^\s*-\s*cron:/m.test(readFileSync(`${WORKFLOW_DIR}${name}`, "utf8")))
    .map((name) => name.replace(/\.yml$/, ""))
    .sort();
}

function reEnabledBy(workflow: string): string[] {
  const body = readFileSync(`${WORKFLOW_DIR}${workflow}`, "utf8");
  const loop = /for wf in ([^;]+); do/.exec(body);
  if (!loop) throw new Error(`${workflow} no longer has a re-enable loop`);
  return loop[1].trim().split(/\s+/).sort();
}

describe("scheduled workflows cannot be silently auto-disabled", () => {
  it("has more than one scheduled workflow to protect", () => {
    expect(scheduledWorkflows().length).toBeGreaterThan(1);
  });

  it.each(RE_ENABLERS)("%s re-enables every scheduled workflow", (enabler) => {
    expect(reEnabledBy(enabler)).toEqual(scheduledWorkflows());
  });

  it("keeps the two guards mutually protecting", () => {
    for (const enabler of RE_ENABLERS) {
      const name = enabler.replace(/\.yml$/, "");
      const other = RE_ENABLERS.find((candidate) => candidate !== enabler)!.replace(/\.yml$/, "");
      expect(reEnabledBy(enabler)).toContain(other);
      expect(reEnabledBy(enabler)).toContain(name);
    }
  });
});
