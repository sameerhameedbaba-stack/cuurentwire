import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Backlog 2b. `/top-100` and `/latest` must read `searchParams`, which opts
 * them into dynamic rendering — so Next emits
 * `private, no-cache, no-store, max-age=0, must-revalidate` and no route
 * segment config can change it. The one sanctioned escape hatch is a
 * next.config `headers` rule, because the render pipeline only writes its own
 * Cache-Control when the response does not already carry one.
 *
 * That makes this the same class of bug as tests/unit/isr-route-config.test.ts
 * guards: a caching directive that is *present* but silently *not applied*.
 * These assertions pin the shape of the declaration — that the rule exists for
 * both paths, that it is a shared-cache directive with no `no-store`, and that
 * every request shape which must stay uncached is excluded. The live header is
 * verified by curl after deploy; a dev server rewrites Cache-Control
 * unconditionally, so Playwright cannot check it.
 */
const MUST_EXCLUDE = [
  // A cached HTML document must never be served to an RSC/prefetch request.
  { type: "header", key: "rsc" },
  { type: "header", key: "next-router-prefetch" },
  { type: "query", key: "_rsc" },
  // URL state: every key that changes what the page renders.
  { type: "query", key: "page" },
  { type: "query", key: "country" },
  { type: "query", key: "category" },
  { type: "query", key: "time" },
  { type: "query", key: "sort" },
];

describe("list-page CDN cache headers", () => {
  it("declares a headers() function", () => {
    expect(typeof nextConfig.headers).toBe("function");
  });

  for (const path of ["/top-100", "/latest"]) {
    describe(path, () => {
      it("puts the shared-cache TTL in the edge-only header", async () => {
        const rules = await nextConfig.headers!();
        const rule = rules.find((r) => r.source === path);
        expect(rule, `no headers() rule for ${path}`).toBeDefined();
        const edge = rule!.headers.find(
          (h) => h.key.toLowerCase() === "vercel-cdn-cache-control",
        );
        expect(edge, `${path} sets no edge cache header`).toBeDefined();
        expect(edge!.value).toMatch(/s-maxage=\d+/);
        expect(edge!.value).toContain("public");
      });

      it("never advertises a shared TTL to clients or third-party caches", async () => {
        // The edge header is stripped before the response leaves Vercel, so if
        // the edge ignores the rule nothing downstream was misinformed. The
        // client-facing header must therefore stay free of s-maxage: these two
        // pages exist to be fresh, and this rule also lands on error renders.
        const rules = await nextConfig.headers!();
        const rule = rules.find((r) => r.source === path)!;
        const client = rule.headers.find(
          (h) => h.key.toLowerCase() === "cache-control",
        );
        expect(client, `${path} sets no client Cache-Control`).toBeDefined();
        expect(client!.value).not.toContain("s-maxage");
        expect(client!.value).not.toContain("stale-while-revalidate");
        expect(client!.value).not.toContain("no-store");
      });

      it("excludes every request shape that must stay uncached", async () => {
        const rules = await nextConfig.headers!();
        const rule = rules.find((r) => r.source === path)!;
        const missing = rule.missing ?? [];
        for (const required of MUST_EXCLUDE) {
          expect(
            missing.some(
              (m) => m.type === required.type && m.key === required.key,
            ),
            `${path} does not exclude ${required.type} "${required.key}", so a filtered or RSC response could be shared-cached`,
          ).toBe(true);
        }
      });

      it("comes after the catch-all security rule so it is not overridden", async () => {
        const rules = await nextConfig.headers!();
        const catchAll = rules.findIndex((r) => r.source === "/(.*)");
        const listRule = rules.findIndex((r) => r.source === path);
        expect(catchAll).toBeGreaterThanOrEqual(0);
        expect(listRule).toBeGreaterThan(catchAll);
      });
    });
  }
});
