import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { HUB_IDS, HUBS } from "@/config/hubs";

/**
 * Google renders roughly 155-160 characters of a meta description; the rest is
 * cut with an ellipsis, so every character past the ceiling is copy that was
 * written and never read. These descriptions were literals with no assertion
 * on them, and eight hubs plus three list pages had drifted over the line
 * (measured live 2026-09-04: /most-covered 180, /energy 173, /obituaries 166,
 * /top-10 163, /reports/media-coverage 235).
 *
 * The hub string is not only metadata — components/hubs/HubPage.tsx renders
 * the same value as the visible intro paragraph under the h1, so a rewrite
 * here changes on-page copy too. Keep them whole sentences.
 *
 * /briefing is deliberately EXEMPT. Its served description is built from live
 * headlines by briefingMetaDescription() under BRIEFING_DESCRIPTION_MAX_CHARS
 * (300), and the module-level DESCRIPTION literal is only the no-stories
 * fallback. Lowering that ceiling truncates real headlines and is blocked in
 * seo/BACKLOG.md pending a headline-preservation test — asserting 160 on the
 * fallback literal would make this test read green while the live page still
 * serves ~298, which is the proxy-instead-of-outcome trap.
 */
const MAX_CHARS = 160;
const APP_DIR = join(process.cwd(), "app");
const EXEMPT_PAGES = new Set(["briefing/page.tsx"]);

function pageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...pageFiles(full));
    else if (entry === "page.tsx" || entry === "page.ts") found.push(full);
  }
  return found;
}

const DESCRIPTION_LITERAL = /const\s+(?:DESCRIPTION|META_DESCRIPTION)\s*=\s*\n?\s*"([^"]*)"/g;

describe("meta description length", () => {
  it("every topic hub description fits what Google renders", () => {
    for (const id of HUB_IDS) {
      const { description } = HUBS[id];
      expect(description.length, `hub "${id}" description is ${description.length} chars`).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it("every page-level DESCRIPTION literal fits what Google renders", () => {
    const found: string[] = [];
    for (const file of pageFiles(APP_DIR)) {
      const route = relative(APP_DIR, file).split(sep).join("/");
      if (EXEMPT_PAGES.has(route)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(DESCRIPTION_LITERAL)) {
        found.push(route);
        expect(match[1].length, `${route} description is ${match[1].length} chars`).toBeLessThanOrEqual(MAX_CHARS);
      }
    }
    // The scan must actually be finding literals — a regex that silently
    // stops matching would turn this whole test into a no-op.
    expect(found.length).toBeGreaterThan(10);
  });
});
