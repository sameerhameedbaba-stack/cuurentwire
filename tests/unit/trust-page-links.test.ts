import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The trust pages are the site's E-E-A-T cluster. Footer links do not make a
 * cluster — in-body links are the ones that carry context, and they are the
 * ones that quietly disappear when a page is rewritten.
 *
 * This table was built from the LIVE link graph measured on 2026-08-19 plus
 * the links added in the same change. It is a shape-of-source assertion, the
 * same technique tests/unit/isr-route-config.test.ts uses, because there is no
 * runtime behaviour to observe: a missing <Link> is simply absent prose.
 */
const REQUIRED_LINKS: Record<string, string[]> = {
  about: [
    "/methodology",
    "/news-desk",
    "/editorial-standards",
    "/corrections",
    "/contact",
  ],
  methodology: ["/corrections", "/editorial-standards", "/news-desk"],
  "editorial-standards": [
    "/methodology",
    "/corrections",
    "/news-desk",
    "/about",
    "/contact",
  ],
  corrections: [
    "/editorial-standards",
    "/contact",
    "/methodology",
    "/news-desk",
  ],
  contact: [
    "/corrections",
    "/copyright",
    "/methodology",
    "/editorial-standards",
    "/news-desk",
    "/about",
    "/privacy",
  ],
  "news-desk": ["/methodology", "/corrections", "/contact"],
};

describe("trust page interlinking", () => {
  for (const [slug, targets] of Object.entries(REQUIRED_LINKS)) {
    const source = readFileSync(
      join(process.cwd(), "app", slug, "page.tsx"),
      "utf8",
    );

    for (const target of targets) {
      it(`/${slug} links to ${target} in the body`, () => {
        expect(source).toContain(`href="${target}"`);
      });
    }

    it(`/${slug} does not link to itself`, () => {
      expect(source).not.toContain(`href="/${slug}"`);
    });
  }
});
