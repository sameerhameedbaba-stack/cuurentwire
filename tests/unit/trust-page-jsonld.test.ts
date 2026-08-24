import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guard: every page the site presents as a trust, policy or
 * archive-entry surface must render a JSON-LD block.
 *
 * Same guard class as isr-route-config.test.ts and page-metadata-robots.test.ts
 * — there is no runtime behaviour to assert, because the defect is a component
 * that was never added. Nothing in a page file *looks* wrong when the block is
 * missing, which is exactly how six pages shipped bare until 2026-08-19 and
 * five more until 2026-08-24.
 *
 * /news-desk is the one that mattered most: NewsMediaOrganization.masthead
 * points at it, so the Organization schema named a page that did not identify
 * itself. /archive is the HTML entry point to every permanent story URL.
 *
 * scripts/seo-health.mjs checks the same list against the LIVE HTML daily.
 * This test is the cheap half that fails in CI before a deploy, not after.
 */
const ROOT = process.cwd();

const PAGES_WITH_JSONLD: { path: string; component: string }[] = [
  { path: "/about", component: "TrustPageJsonLd" },
  { path: "/methodology", component: "TrustPageJsonLd" },
  { path: "/editorial-standards", component: "TrustPageJsonLd" },
  { path: "/corrections", component: "TrustPageJsonLd" },
  { path: "/contact", component: "TrustPageJsonLd" },
  { path: "/news-desk", component: "TrustPageJsonLd" },
  { path: "/privacy", component: "TrustPageJsonLd" },
  { path: "/terms", component: "TrustPageJsonLd" },
  { path: "/copyright", component: "TrustPageJsonLd" },
  { path: "/topics", component: "CollectionPageJsonLd" },
  { path: "/archive", component: "CollectionPageJsonLd" },
];

function pageSource(path: string): string {
  return readFileSync(join(ROOT, "app", path.slice(1), "page.tsx"), "utf8");
}

describe("pages that must carry JSON-LD", () => {
  it.each(PAGES_WITH_JSONLD)(
    "$path renders $component",
    ({ path, component }) => {
      const source = pageSource(path);
      expect(source).toContain(`<${component}`);
      expect(source).toContain(`from "@/lib/seo/structured-data"`);
    },
  );

  it.each(PAGES_WITH_JSONLD)(
    "$path declares its own canonical path in the schema",
    ({ path }) => {
      // A copy-pasted block pointing at another page is worse than none:
      // it hands the wrong URL to every consumer that reads the schema.
      expect(pageSource(path)).toContain(`path="${path}"`);
    },
  );

  it.each(PAGES_WITH_JSONLD)(
    "$path feeds one description to both <meta> and the schema",
    ({ path }) => {
      // Two independently-written strings drift, and then the page says one
      // thing to a crawler reading <meta> and another to one reading JSON-LD.
      const source = pageSource(path);
      expect(source).toMatch(/const DESCRIPTION\s*=/);
      expect(source).toContain("description: DESCRIPTION");
      expect(source).toContain("description={DESCRIPTION}");
    },
  );
});
