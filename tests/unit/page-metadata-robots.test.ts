import { describe, expect, it } from "vitest";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Page-level `robots` replaces the root layout's wholesale in this Next
 * version, so returning `undefined` from pageMetadata() ships NO robots meta
 * at all rather than inheriting the layout's. That is how `/us`, `/topics`,
 * `/top-100`, `/politics`, `/sources`, `/methodology` and `/about` silently
 * lost `max-image-preview:large` and `max-snippet:-1` — the directives that
 * make a page eligible for large Discover and Top Stories thumbnails —
 * until it was measured live on 2026-08-19.
 *
 * Nothing about that failure is visible in a page file: it just calls
 * pageMetadata() like every other page. So the assertion lives here.
 */
describe("pageMetadata robots directives", () => {
  const base = { title: "T", description: "D", path: "/x" };

  it("restates the full indexable directive set on indexable pages", () => {
    const robots = pageMetadata(base).robots;
    expect(robots, "indexable pages must not inherit-by-omission").toBeTruthy();
    expect(robots).toMatchObject({
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    });
  });

  it("keeps large-preview eligibility for Googlebot specifically", () => {
    expect(pageMetadata(base).robots).toMatchObject({
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    });
  });

  it("still noindexes when asked", () => {
    expect(pageMetadata({ ...base, noIndex: true }).robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("still emits noindex,follow for out-of-range pagination", () => {
    expect(pageMetadata({ ...base, noIndexFollow: true }).robots).toMatchObject({
      index: false,
      follow: true,
    });
  });
});
