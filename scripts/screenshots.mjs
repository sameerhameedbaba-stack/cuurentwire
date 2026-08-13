import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const outDir = process.argv[2] ?? ".";
mkdirSync(outDir, { recursive: true });
const base = "http://localhost:3000";

const shots = [
  { name: "home-desktop", url: "/", width: 1440, height: 2600 },
  { name: "home-desktop-dark", url: "/", width: 1440, height: 2600, dark: true },
  { name: "home-mobile", url: "/", width: 375, height: 2400 },
  { name: "top100-desktop", url: "/top-100", width: 1440, height: 2000 },
  { name: "top100-mobile", url: "/top-100", width: 375, height: 1800 },
  { name: "story-desktop", url: "TOP_STORY", width: 1440, height: 2200 },
  { name: "story-mobile-dark", url: "TOP_STORY", width: 375, height: 2200, dark: true },
  { name: "us-desktop", url: "/us", width: 1280, height: 2000 },
  { name: "canada-tablet", url: "/canada", width: 768, height: 2000 },
  { name: "search-desktop", url: "/search?q=federal", width: 1440, height: 1400 },
  { name: "home-narrow", url: "/", width: 320, height: 1600 },
];

const browser = await chromium.launch();
// Resolve a real story slug first.
const page0 = await browser.newPage();
await page0.goto(`${base}/top-100`, { waitUntil: "networkidle" });
const storyHref = await page0.locator("main ol article h3 a").first().getAttribute("href");
await page0.close();

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    colorScheme: shot.dark ? "dark" : "light",
  });
  const page = await context.newPage();
  const url = shot.url === "TOP_STORY" ? storyHref : shot.url;
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  if (shot.dark) {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${shot.name}.png` });
  await context.close();
  console.log(`captured ${shot.name}`);
}
await browser.close();
