import { expect, test } from "@playwright/test";

test.describe("security headers", () => {
  test("home response carries CSP and nosniff", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    const csp = headers["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' https: data:");
  });
});

test.describe("admin auth", () => {
  // Production-mode gating of /admin/status (404 without the cookie) is not
  // testable against the local dev server — dev access is intentionally open.
  // We can still assert the cookie behavior of the auth route itself.
  test("/admin/auth?key=wrong redirects without setting the admin cookie", async ({
    request,
  }) => {
    const response = await request.get("/admin/auth?key=wrong", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain("/admin/status");
    const setCookie = response.headers()["set-cookie"] ?? "";
    expect(setCookie).not.toContain("cw-admin");
  });
});
