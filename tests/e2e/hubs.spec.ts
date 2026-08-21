import { expect, test } from "@playwright/test";

test.describe("topic hubs", () => {
  test("/ai renders the hub with its search-phrased heading", async ({ page }) => {
    const response = await page.goto("/ai");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("AI News");
    await expect(page).toHaveTitle(/AI News/);
    // Other hubs are one click away.
    await expect(page.getByRole("navigation", { name: "Other topic hubs" })).toBeVisible();
  });

  test("every hub route answers 200", async ({ request }) => {
    for (const id of [
      "elections", "immigration", "courts", "crime", "education", "housing",
      "jobs", "money", "weather", "energy", "space", "autos", "travel", "obituaries",
    ]) {
      const response = await request.get(`/${id}`);
      expect(response.status(), id).toBe(200);
    }
  });

  test("/topics lists the hubs under Browse by topic", async ({ page }) => {
    await page.goto("/topics");
    const section = page.getByRole("heading", { name: "Browse by topic" });
    await expect(section).toBeVisible();
    // Scoped to <main>: the footer links the same hubs, so an unscoped
    // locator matches twice and fails strict mode on a page that is
    // perfectly correct. What this test is about is the page's own list.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /^Elections 2026/ })).toBeVisible();
  });

  test("section pages link their related hubs", async ({ page }) => {
    await page.goto("/technology");
    const related = page.getByRole("navigation", { name: "Related topic hubs" });
    await expect(related).toBeVisible();
    await expect(related.getByRole("link", { name: "AI" })).toBeVisible();
  });
});
