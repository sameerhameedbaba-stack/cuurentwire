import { expect, test } from "@playwright/test";

test.describe("top 10 pages", () => {
  test("/top-10 serves a ranked list capped at ten stories", async ({ page }) => {
    const response = await page.goto("/top-10");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Top 10 News Stories Right Now");
    const items = page.locator('ol[aria-label="Top 10 ranked stories"] > li');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);
    // ItemList structured data is present for the ranked list.
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const payloads = await jsonLd.allTextContents();
    expect(payloads.some((p) => p.includes('"ItemList"'))).toBe(true);
  });

  test("section top-10 pages serve search-phrased titles", async ({ page }) => {
    const response = await page.goto("/top-10/politics");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Top 10 Political News Today");
    const items = page.locator("ol > li");
    expect(await items.count()).toBeLessThanOrEqual(10);
  });

  test("the internal general bucket has no top-10 page", async ({ request }) => {
    const response = await request.get("/top-10/general");
    expect(response.status()).toBe(404);
  });

  test("unknown sections 404", async ({ request }) => {
    const response = await request.get("/top-10/nonsense");
    expect(response.status()).toBe(404);
  });

  test("sitemap lists the top-10 pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("/top-10</loc>");
    expect(body).toContain("/top-10/politics</loc>");
  });
});
