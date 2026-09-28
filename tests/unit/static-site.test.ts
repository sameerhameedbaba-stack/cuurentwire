import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCH_CATEGORIES } from "@/lib/editorial/eligibility";
// Plain .mjs build script, imported for its allowlist only (main is guarded).
import { KEEP_APP } from "../../scripts/build-static-site.mjs";

/**
 * Guards for the static site (GitHub Pages, production since 2026-09-28).
 *
 * The build script already fails on a broken internal link, a missing
 * required file, or a rendered demo banner — but only when someone runs the
 * build. These are the cheap checks that run with every `vitest run`, so a
 * change that would break the static site fails fast, before a deploy.
 */

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const SITE_APP = join(ROOT, "site", "app");

/** Top-level route segments the static site serves. */
function staticRoutes(): Set<string> {
  const overlays = readdirSync(SITE_APP);
  return new Set([...(KEEP_APP as string[]), ...overlays]);
}

describe("static site allowlist", () => {
  it("names only things that actually exist in app/ or the overlay", () => {
    const overlays = new Set(readdirSync(SITE_APP));
    for (const entry of KEEP_APP as string[]) {
      expect(
        existsSync(join(APP, entry)) || overlays.has(entry),
        `KEEP_APP lists "${entry}" but neither app/ nor site/app/ has it`,
      ).toBe(true);
    }
  });

  it("never keeps an aggregator route that needs a server", () => {
    // Each of these needs ISR, the database, request-time params or an API
    // route. A static export refuses them — and they are the cost the move
    // exists to escape.
    const serverOnly = ["api", "story", "latest", "top-100", "search", "admin", "archive", "source", "topic"];
    for (const route of serverOnly) {
      expect(KEEP_APP as string[]).not.toContain(route);
    }
  });
});

describe("static navigation points only at pages the static site builds", () => {
  // Read the config file as text: importing it would evaluate IS_STATIC_SITE
  // with the test environment's (unset) mode and hand back the Vercel nav.
  const config = readFileSync(join(ROOT, "config", "site.ts"), "utf8");
  const block = config.slice(
    config.indexOf("const STATIC_NAVIGATION"),
    config.indexOf("export const siteConfig"),
  );
  const hrefs = [...block.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);

  it("has links to check", () => {
    expect(hrefs.length).toBeGreaterThan(5);
  });

  it.each(hrefs)("%s is served by the static site", (href) => {
    if (href === "/") return;
    const segment = href.replace(/^\//, "").split("/")[0];
    const routes = staticRoutes();
    const servedDirectly = routes.has(segment);
    const isCategoryPage = (LAUNCH_CATEGORIES as readonly string[]).includes(segment);
    expect(
      servedDirectly || isCategoryPage,
      `nav links ${href}, which the static site does not build`,
    ).toBe(true);
  });
});

describe("trust pages tell the truth about how the site works", () => {
  // Claims the Vercel-era pages made that are FALSE for AI-assisted articles.
  const falseClaims = [
    /no ai[- ]generated/i,
    /does not generate article/i,
    /employ no journalists/i,
    /nobody at currentwire/i,
    /is an aggregator/i,
  ];
  const overlayPages = ["about", "news-desk", "editorial-standards"];

  /**
   * The source minus block comments. Each overlay's header comment QUOTES the
   * old false claims to explain why the overlay exists; what matters is the
   * copy a reader sees, not the note to the next developer.
   */
  function renderedCopy(page: string): string {
    return readFileSync(join(SITE_APP, page, "page.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  }

  it.each(overlayPages)("site/app/%s makes none of the old aggregator claims", (page) => {
    const copy = renderedCopy(page);
    for (const claim of falseClaims) expect(copy).not.toMatch(claim);
  });

  it.each(overlayPages)("site/app/%s discloses AI assistance", (page) => {
    const source = readFileSync(join(SITE_APP, page, "page.tsx"), "utf8");
    expect(source).toMatch(/AI assistance/);
  });

  it("keeps the operator line on /about, verbatim, in both builds", () => {
    // Standing rule: never touch the operator line on /about.
    const line = "<em>Operator details: to be published.</em>";
    expect(readFileSync(join(APP, "about", "page.tsx"), "utf8")).toContain(line);
    expect(readFileSync(join(SITE_APP, "about", "page.tsx"), "utf8")).toContain(line);
  });

  it("the static llms.txt retracts the old permanent-URL promise", () => {
    const llms = readFileSync(join(ROOT, "site", "public", "llms.txt"), "utf8");
    expect(llms).not.toMatch(/top 100/i);
    expect(llms).toMatch(/no longer true/);
    expect(llms).toMatch(/AI\s+assistance/);
  });
});

describe("site mode flag", () => {
  it("is read as a literal NEXT_PUBLIC_ access, so it reaches client components", () => {
    // Next only inlines process.env.NEXT_PUBLIC_* written literally. Anything
    // else is undefined in the browser, and the nav would hydrate differently
    // from the server render on every page.
    const source = readFileSync(join(ROOT, "lib", "site-mode.ts"), "utf8");
    expect(source).toContain('process.env.NEXT_PUBLIC_SITE_MODE === "static"');
  });

  it("next.config reads the same variable", () => {
    const source = readFileSync(join(ROOT, "next.config.ts"), "utf8");
    expect(source).toContain('process.env.NEXT_PUBLIC_SITE_MODE === "static"');
  });
});
