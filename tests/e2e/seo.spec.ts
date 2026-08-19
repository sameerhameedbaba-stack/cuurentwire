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

test.describe("archive browse", () => {
  test("/archive responds 200 with the archive heading", async ({ page }) => {
    // The index renders (with an empty state) even without a database, so
    // this holds on local runs where story_archive has no data.
    const response = await page.goto("/archive");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Archive" }),
    ).toBeVisible();
  });
});

test.describe("internal category bucket", () => {
  test("/general renders but is noindexed", async ({ page }) => {
    const response = await page.goto("/general");
    expect(response?.status()).toBe(200);
    const robots = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content");
    expect(robots).toContain("noindex");
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

test.describe("evergreen reference pages", () => {
  const REFERENCE_PAGES = [
    "/methodology/coverage-breadth",
    "/methodology/publisher-tiers",
    "/methodology/duplicate-stories",
  ];

  for (const path of REFERENCE_PAGES) {
    test(`${path} is indexable with one h1, a self canonical and valid schema`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page.locator("h1")).toHaveCount(1);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical).toBeTruthy();
      expect(new URL(canonical as string).pathname).toBe(path);

      // Not noindexed: these are the site's evergreen pages.
      const robots = await page
        .locator('meta[name="robots"]')
        .first()
        .getAttribute("content");
      expect(robots ?? "").not.toContain("noindex");

      // Both JSON-LD blocks parse, and the breadcrumb trail ends on this page.
      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      const parsed = blocks.map((block) => JSON.parse(block));
      const webPage = parsed.find((data) => data["@type"] === "WebPage");
      expect(webPage).toBeTruthy();
      expect(new URL(webPage.url).pathname).toBe(path);
      const crumbs = parsed.find((data) => data["@type"] === "BreadcrumbList");
      expect(crumbs).toBeTruthy();
      const trail = crumbs.itemListElement;
      expect(trail).toHaveLength(3);
      expect(new URL(trail[1].item).pathname).toBe("/methodology");
      expect(new URL(trail[2].item).pathname).toBe(path);

      // Links back to the hub, so the page is never a dead end.
      await expect(page.locator('main a[href="/methodology"]').first()).toBeVisible();
    });
  }

  test("the methodology hub links to every reference page", async ({ page }) => {
    await page.goto("/methodology");
    for (const path of REFERENCE_PAGES) {
      await expect(page.locator(`main a[href="${path}"]`).first()).toBeVisible();
    }
  });

  test("the sitemap lists the reference pages", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    for (const path of REFERENCE_PAGES) {
      expect(body).toContain(`${path}</loc>`);
    }
  });
});

test.describe("most covered", () => {
  test("/most-covered is its own indexable URL with ItemList schema", async ({
    page,
  }) => {
    // Coverage breadth is CurrentWire's most differentiated signal and used
    // to exist only as ?sort=most-covered, which canonicalized straight back
    // to /top-100 — so the signal had no indexable home at all.
    const response = await page.goto("/most-covered");
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/Most Covered/i);
    await expect(
      page.locator('link[rel="canonical"]'),
    ).toHaveAttribute("href", /\/most-covered$/);

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(blocks.length).toBeGreaterThan(0);
    const parsed = blocks.map((b) => JSON.parse(b));
    expect(parsed.some((b) => b["@type"] === "BreadcrumbList")).toBe(true);

    // When the page has items, its ItemList must not claim more than it lists.
    const itemList = parsed.find((b) => b["@type"] === "ItemList");
    if (itemList) {
      expect(itemList.numberOfItems).toBe(itemList.itemListElement.length);
      expect(itemList.url).toContain("/most-covered");
    }
  });

  test("states plainly what breadth does not mean", async ({ page }) => {
    // The honesty section is what keeps this page from being a thin list and
    // from overclaiming: breadth is not importance, agreement or verification.
    await page.goto("/most-covered");
    const main = page.locator("main");
    await expect(main).toContainText(/not.*importance/i);
    await expect(main).toContainText(/lower bound/i);
  });

  test("/top-100 links out to it instead of offering a sort filter", async ({
    page,
  }) => {
    await page.goto("/top-100");
    await expect(page.locator('a[href="/most-covered"]').first()).toBeVisible();
    // The old chip generated ?sort=most-covered URLs that canonicalized away.
    expect(await page.locator('a[href*="sort=most-covered"]').count()).toBe(0);
  });

  test("the sitemap lists it", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    expect(body).toContain("/most-covered</loc>");
  });
});
