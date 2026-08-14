import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test("loads with masthead, top stories and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CurrentWire/);
    await expect(page.getByRole("link", { name: "CurrentWire home" })).toBeVisible();
    // Hero headline is the page's h1.
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("CurrentWire");
    // No horizontal scrolling.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("skip link targets main content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toHaveCount(1);
  });
});

test.describe("top 100", () => {
  test("shows ranked stories and filters via URL", async ({ page }) => {
    await page.goto("/top-100");
    await expect(page.getByRole("heading", { name: "Top 100 Right Now" })).toBeVisible();
    await expect(page.getByLabel("Rank 1", { exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Country filter" })
      .getByRole("link", { name: "Canada", exact: true })
      .click();
    // Dynamic pages need a server round-trip; dev builds can be slow under load.
    await expect(page).toHaveURL(/country=canada/, { timeout: 15_000 });
    await expect(page.getByLabel("Rank 1", { exact: true })).toBeVisible();
  });

  test("opens a story with attribution and a publisher link", async ({ page }) => {
    await page.goto("/top-100");
    await page.locator("main ol article h3 a").first().click();
    await expect(page).toHaveURL(/\/story\//, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Coverage", exact: true }),
    ).toBeVisible();
    const publisherLink = page.locator('a[rel="noopener noreferrer"][target="_blank"]').first();
    await expect(publisherLink).toBeVisible();
  });
});

test.describe("country pages", () => {
  test("US page renders", async ({ page }) => {
    await page.goto("/us");
    await expect(page.getByRole("heading", { name: "United States", level: 1 })).toBeVisible();
    await expect(page.locator("main article").first()).toBeVisible();
  });

  test("Canada page renders", async ({ page }) => {
    await page.goto("/canada");
    await expect(page.getByRole("heading", { name: "Canada", level: 1 })).toBeVisible();
    await expect(page.locator("main article").first()).toBeVisible();
  });
});

test.describe("search", () => {
  test("finds stories by keyword", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Search query").fill("interest rate");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=interest\+rate/, { timeout: 15_000 });
    await expect(page.getByRole("status")).toContainText(/stor(y|ies) for/);
  });
});

test.describe("dark mode", () => {
  test("toggle switches theme and persists", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    const button = page.getByRole("button", { name: "Toggle dark mode" });
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await button.click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*dark).*$/ : /dark/);
    await page.reload();
    const isDarkAfterReload = await html.evaluate((el) => el.classList.contains("dark"));
    expect(isDarkAfterReload).toBe(!wasDark);
  });
});

test.describe("latest", () => {
  test("shows chronological feed with tabs", async ({ page }) => {
    await page.goto("/latest");
    await expect(page.getByRole("heading", { name: "Latest", level: 1 })).toBeVisible();
    await page.getByRole("navigation", { name: "Region tabs" })
      .getByRole("link", { name: "Canada" })
      .click();
    await expect(page).toHaveURL(/country=canada/, { timeout: 15_000 });
    await expect(page.locator("main article").first()).toBeVisible();
  });
});

test.describe("mobile navigation", () => {
  test("drawer opens and navigates", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Site navigation" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Technology" }).click();
    await expect(page).toHaveURL(/\/technology/);
  });
});

test.describe("news desk", () => {
  test("news desk page responds 200 and explains the automated byline", async ({ page }) => {
    const response = await page.goto("/news-desk");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "The CurrentWire News Desk", level: 1 }),
    ).toBeVisible();
    // The core disclosures: automated compilation, no human journalists,
    // no AI-generated reporting.
    await expect(page.getByText("No human journalists:")).toBeVisible();
    await expect(page.getByText("No AI-generated reporting:")).toBeVisible();
    // Links out to methodology and corrections.
    await expect(page.locator('main a[href="/methodology"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/corrections"]').first()).toBeVisible();
  });

  test("story page byline links to /news-desk", async ({ page }) => {
    await page.goto("/top-100");
    await page.locator("main ol article h3 a").first().click();
    await expect(page).toHaveURL(/\/story\//, { timeout: 15_000 });
    const bylineLink = page.getByRole("link", { name: "CurrentWire News Desk" });
    await expect(bylineLink).toBeVisible();
    await expect(bylineLink).toHaveAttribute("href", "/news-desk");
  });
});

test.describe("rss and seo endpoints", () => {
  test("rss feed serves xml", async ({ request }) => {
    const response = await request.get("/rss");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/rss+xml");
    expect(await response.text()).toContain("<rss");
  });

  test("sitemap and robots respond", async ({ request }) => {
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
    expect((await request.get("/robots.txt")).status()).toBe(200);
  });

  test("unknown story returns 404", async ({ request }) => {
    const response = await request.get("/story/definitely-not-a-story");
    expect(response.status()).toBe(404);
  });
});
