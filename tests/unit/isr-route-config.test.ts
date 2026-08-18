import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Next 16 only applies ISR to a dynamic route segment when the page also
 * exports generateStaticParams — "You must return an empty array from
 * generateStaticParams ... in order to revalidate (ISR) paths at runtime"
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 * generate-static-params.md, "All paths at runtime").
 *
 * Without it `export const revalidate` is silently inert: the route lands in
 * the build's ƒ (Dynamic) bucket and every response carries
 * `Cache-Control: private, no-cache, no-store`. That failure is invisible in
 * source — the config line is right there — which is exactly why it survived
 * on /story/[slug], /topic/[slug], /source/[slug] and /archive/[date] until
 * live cache headers were measured. This test is the cheap standing check.
 */
const APP_DIR = join(process.cwd(), "app");

function pageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...pageFiles(full));
    } else if (entry === "page.tsx" || entry === "page.ts") {
      found.push(full);
    }
  }
  return found;
}

/** Route segments under a [param] directory — the ones the rule applies to. */
function isDynamicRoute(file: string): boolean {
  return relative(APP_DIR, file)
    .split(sep)
    .some((segment) => segment.startsWith("[") && segment.endsWith("]"));
}

describe("ISR route configuration", () => {
  const dynamicPages = pageFiles(APP_DIR).filter(isDynamicRoute);

  it("finds the dynamic route pages", () => {
    expect(dynamicPages.length).toBeGreaterThan(0);
  });

  it.each(dynamicPages.map((file) => relative(process.cwd(), file)))(
    "%s: declaring revalidate also exports generateStaticParams",
    (relPath) => {
      const source = readFileSync(join(process.cwd(), relPath), "utf8");
      const declaresRevalidate = /export const revalidate\s*=/.test(source);
      const forcesDynamic = /export const dynamic\s*=\s*"force-dynamic"/.test(source);
      if (!declaresRevalidate || forcesDynamic) return;
      expect(
        /export (?:async )?function generateStaticParams/.test(source),
        `${relPath} sets \`revalidate\` but exports no generateStaticParams, so ISR never engages`,
      ).toBe(true);
    },
  );
});
