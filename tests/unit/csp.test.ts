import { describe, expect, it } from "vitest";

import { NEWSLETTER_FORM_ORIGIN, buildContentSecurityPolicy } from "../../config/csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((d) => d.startsWith(`${name} `) || d === name);

const prod = buildContentSecurityPolicy({ isDev: false, gaEnabled: false });

describe("content security policy", () => {
  it("lets the newsletter form reach Buttondown", () => {
    // The regression this guards: `form-action 'self'` blocks the footer
    // signup's cross-origin POST in the browser, with nothing logged
    // server-side — the form would silently subscribe nobody.
    expect(directive(prod, "form-action")).toBe(`form-action 'self' ${NEWSLETTER_FORM_ORIGIN}`);
  });

  it("matches the origin the signup form actually posts to", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../../components/layout/NewsletterSignup.tsx", import.meta.url), "utf8"),
    );
    const action = source.match(/action="([^"]+)"/)?.[1];
    expect(action).toBeDefined();
    expect(new URL(action!).origin).toBe(NEWSLETTER_FORM_ORIGIN);
  });

  it("keeps the rest of the policy locked down", () => {
    expect(directive(prod, "default-src")).toBe("default-src 'self'");
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
  });

  it("admits unsafe-eval only in development", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isDev: true, gaEnabled: false })).toContain("'unsafe-eval'");
  });

  it("adds Google Analytics origins only when a measurement ID is configured", () => {
    expect(prod).not.toContain("googletagmanager.com");
    const withGa = buildContentSecurityPolicy({ isDev: false, gaEnabled: true });
    expect(directive(withGa, "script-src")).toContain("https://www.googletagmanager.com");
    expect(directive(withGa, "connect-src")).toContain("https://*.google-analytics.com");
  });
});
