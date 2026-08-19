import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Evergreen reference pages (/methodology/*): source-level guards, in the
 * style of isr-route-config.test.ts. These pages are static prose, so the
 * failure modes are not runtime ones — they are a title that busts the
 * 60-character SERP budget, a canonical that does not match the directory the
 * file sits in, and the page silently becoming an orphan because nothing
 * links to it. All three are checkable from source at zero cost.
 */
const ROOT = process.cwd();

const REFERENCE_PAGES = [
  "/methodology/coverage-breadth",
  "/methodology/publisher-tiers",
  "/methodology/duplicate-stories",
] as const;

/** layout.tsx: `title: { template: "%s | CurrentWire" }`. */
const TITLE_SUFFIX = " | CurrentWire";
const MAX_TITLE_LENGTH = 60;

function pageSource(path: string): string {
  return readFileSync(join(ROOT, "app", `${path.slice(1)}`, "page.tsx"), "utf8");
}

describe("evergreen reference pages", () => {
  it.each(REFERENCE_PAGES)("%s: page file exists and is a server component", (path) => {
    const source = pageSource(path);
    expect(source).not.toContain('"use client"');
    expect(source).toMatch(/export default function \w+Page\(/);
  });

  it.each(REFERENCE_PAGES)("%s: canonical path matches the route", (path) => {
    expect(pageSource(path)).toContain(`const PATH = "${path}";`);
  });

  it.each(REFERENCE_PAGES)("%s: title fits the 60-char budget with the suffix", (path) => {
    const match = pageSource(path).match(/const TITLE =\s*"([^"]+)";/);
    expect(match, `${path}: no TITLE constant found`).toBeTruthy();
    const title = (match as RegExpMatchArray)[1];
    expect(title.length + TITLE_SUFFIX.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });

  it.each(REFERENCE_PAGES)("%s: emits breadcrumbs and page schema", (path) => {
    const source = pageSource(path);
    expect(source).toContain("<BreadcrumbJsonLd");
    expect(source).toContain("<ReferencePageJsonLd");
    // Breadcrumb trail must match the URL hierarchy.
    expect(source).toContain('{ name: "Methodology", path: "/methodology" }');
  });

  it.each(REFERENCE_PAGES)("%s: is listed in the sitemap", (path) => {
    const sitemap = readFileSync(join(ROOT, "app", "sitemap.ts"), "utf8");
    expect(sitemap).toContain(`"${path}"`);
  });

  it.each(REFERENCE_PAGES)("%s: is listed in llms.txt", (path) => {
    const llms = readFileSync(join(ROOT, "public", "llms.txt"), "utf8");
    expect(llms).toContain(`https://currentwire.us${path}`);
  });

  it.each(REFERENCE_PAGES)("%s: is not an orphan — /methodology links to it", (path) => {
    const hub = readFileSync(join(ROOT, "app", "methodology", "page.tsx"), "utf8");
    expect(hub).toContain(`href="${path}"`);
  });

  it("each reference page links back to the methodology hub", () => {
    for (const path of REFERENCE_PAGES) {
      expect(pageSource(path), path).toContain('href="/methodology"');
    }
  });
});
