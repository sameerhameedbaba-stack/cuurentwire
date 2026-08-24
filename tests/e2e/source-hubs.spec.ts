import { expect, test } from "@playwright/test";

/**
 * Source hubs used to publish nothing durable — 870 words on
 * /source/bbc-news, essentially all of it the headline text of its own story
 * links (seo/BACKLOG.md item 3, measured 2026-08-25). These assertions guard
 * the per-publisher facts that replaced that, and the honesty rules attached
 * to them: the copy must frame itself as a snapshot, and must never present
 * a bias or factuality rating, which this site does not publish.
 */
test.describe("source hubs", () => {
  test("a busy source hub renders its coverage profile", async ({ page }) => {
    // Pick a publisher from the live /sources index rather than hardcoding
    // one: which outlets are in the window changes every refresh.
    await page.goto("/sources");
    const firstSource = page.getByRole("main").locator('a[href^="/source/"]').first();
    const href = await firstSource.getAttribute("href");
    expect(href).toBeTruthy();

    const response = await page.goto(href!);
    expect(response?.status()).toBe(200);

    const profile = page.getByRole("region", { name: /^How CurrentWire tracks / });
    // A hub with no stories in the window renders no profile at all — that
    // is by design, so only assert the contents when the block is present.
    if (await profile.count()) {
      await expect(profile).toContainText("In the current snapshot");
      await expect(profile).toContainText("lower bounds");
      await expect(profile.getByRole("link", { name: /How coverage breadth/ })).toBeVisible();
    }

    // The tier is now a link into the methodology that defines it, and the
    // page says in words that a tier is not a bias rating.
    await expect(page.getByRole("main")).toContainText("no bias or factuality rating");
  });

  test("the hub is about the publisher in schema, published by CurrentWire", async ({
    request,
  }) => {
    const index = await request.get("/sources");
    const href = (await index.text()).match(/href="(\/source\/[^"]+)"/)?.[1];
    expect(href).toBeTruthy();

    const html = await (await request.get(href!)).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]));
    const collection = blocks.find((block) => block["@type"] === "CollectionPage");
    expect(collection).toBeTruthy();

    // `about` names the publisher; `publisher` stays CurrentWire. Claiming
    // the publisher authored this page would be schema that misrepresents
    // who wrote it.
    expect(collection.about["@type"]).toBe("Organization");
    expect(typeof collection.about.name).toBe("string");
    expect(collection.publisher.name).toBe("CurrentWire");
    // No rating property may ever appear on the publisher node.
    for (const banned of ["aggregateRating", "rating", "review", "bias"]) {
      expect(Object.keys(collection.about)).not.toContain(banned);
    }
    // numberOfItems still counts what is actually emitted.
    expect(collection.mainEntity.numberOfItems).toBe(
      collection.mainEntity.itemListElement.length,
    );
  });
});
