import { expect, test } from "@playwright/test";

test.describe("google news sitemap", () => {
  test("serves valid XML with the news namespace", async ({ request }) => {
    const response = await request.get("/news-sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/xml");
    const body = await response.text();
    expect(body).toContain(`xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`);
    expect(body).toContain(`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`);
    expect(body).toContain("</urlset>");
  });
});

test.describe("sitemap", () => {
  test("does not list the noindexed /search page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).not.toContain("/search</loc>");
  });
});

test.describe("archive sitemap", () => {
  test("serves a valid urlset (empty allowed when no database)", async ({ request }) => {
    const response = await request.get("/archive-sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/xml");
    const body = await response.text();
    expect(body).toContain(`xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`);
    expect(body).toContain("</urlset>");
  });
});

test.describe("ai search and indexnow surfaces", () => {
  test("llms.txt is served", async ({ request }) => {
    const response = await request.get("/llms.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("# CurrentWire");
  });

  test("the IndexNow key file is served at the site root", async ({ request }) => {
    const key = "d67fe7ac1896e8fd9e691a2d2abeca89";
    const response = await request.get(`/${key}.txt`);
    expect(response.status()).toBe(200);
    expect((await response.text()).trim()).toBe(key);
  });
});

test.describe("discover directives", () => {
  test("home page allows large image previews", async ({ page }) => {
    await page.goto("/");
    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content");
    expect(robots).toContain("max-image-preview:large");
  });
});

test.describe("story page seo", () => {
  test("has one h1, self canonical, NewsArticle JSON-LD and the byline", async ({ page }) => {
    // Full page load (not a client-side transition) so <head> metadata is
    // guaranteed to belong to the story page before we read it.
    await page.goto("/top-100");
    const storyHref = await page
      .locator('main a[href^="/story/"]')
      .first()
      .getAttribute("href");
    expect(storyHref).toBeTruthy();
    await page.goto(storyHref as string);
    await expect(page).toHaveURL(/\/story\//, { timeout: 15_000 });

    // Exactly one h1, matching the story headline.
    await expect(page.locator("h1")).toHaveCount(1);

    // Self-referencing canonical.
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(new URL(canonical as string).pathname).toBe(new URL(page.url()).pathname);

    // NewsArticle structured data parses and matches the h1.
    const jsonLdBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const parsed = jsonLdBlocks.map((block) => JSON.parse(block));
    const newsArticle = parsed.find((data) => data["@type"] === "NewsArticle");
    expect(newsArticle).toBeTruthy();
    const h1Text = (await page.locator("h1").textContent())?.trim();
    expect(newsArticle.headline).toBe(h1Text);
    expect(newsArticle.author?.name).toBe("CurrentWire News Desk");
    expect(newsArticle.author?.url).toContain("/news-desk");

    // Visible truthful byline and labeled coverage times.
    await expect(page.getByText("Compiled by CurrentWire News Desk")).toBeVisible();
    await expect(page.getByText(/First coverage/)).toBeVisible();
  });
});

test.describe("latest pagination", () => {
  test("page 2 is reachable via a real link with rel prev/next", async ({ page }) => {
    await page.goto("/latest");
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    // Pagination only renders when the feed exceeds one page.
    if ((await pagination.count()) === 0) return;
    await pagination.getByRole("link", { name: "Next →" }).click();
    await expect(page).toHaveURL(/page=2/, { timeout: 15_000 });
    await expect(page.locator('link[rel="prev"]')).toHaveCount(1);
    await expect(page.locator("main article").first()).toBeVisible();
  });
});
