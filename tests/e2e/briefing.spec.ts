import { expect, test } from "@playwright/test";

/** Same Eastern-time news-day clock the app uses. */
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

test.describe("daily briefing", () => {
  test("/briefing serves today's briefing with a compact list", async ({ page }) => {
    const response = await page.goto("/briefing");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Daily News Briefing");
    const items = page.locator("main ol > li");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);
  });

  test("today's date redirects to the canonical /briefing", async ({ request }) => {
    const response = await request.get(`/briefing/${todayET()}`, {
      maxRedirects: 0,
    });
    expect([307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/briefing");
  });

  test("days with no stored briefing are a real 404", async ({ request }) => {
    // Long before the site existed — never has a row, with or without a DB.
    const response = await request.get("/briefing/2019-01-01");
    expect(response.status()).toBe(404);
  });

  test("malformed and future dates 404", async ({ request }) => {
    expect((await request.get("/briefing/not-a-date")).status()).toBe(404);
    expect((await request.get("/briefing/2026-02-31")).status()).toBe(404);
    expect((await request.get("/briefing/2099-01-01")).status()).toBe(404);
  });

  test("sitemap lists the briefing page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("/briefing</loc>");
  });
});
