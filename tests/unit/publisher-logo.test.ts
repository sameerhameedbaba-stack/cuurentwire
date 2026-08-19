import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLISHER_LOGO } from "@/lib/seo/structured-data";

/**
 * The publisher logo's width/height in JSON-LD are typed by hand:
 * scripts/generate-logo.mjs rewrites public/logo-600.png but cannot edit
 * lib/seo/structured-data.tsx. A regenerated logo with a different aspect
 * ratio would leave Google reading dimensions that do not match the image.
 * Read the PNG's IHDR chunk (bytes 16-23 of a PNG file) and compare.
 */
describe("publisher logo", () => {
  const png = readFileSync(join(process.cwd(), "public", "logo-600.png"));

  it("is a real PNG", () => {
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  });

  it("matches the dimensions declared in JSON-LD", () => {
    expect(png.readUInt32BE(16)).toBe(PUBLISHER_LOGO.width);
    expect(png.readUInt32BE(20)).toBe(PUBLISHER_LOGO.height);
  });

  it("stays inside Google's 600x60 publisher-logo box", () => {
    expect(PUBLISHER_LOGO.width).toBeLessThanOrEqual(600);
    expect(PUBLISHER_LOGO.height).toBeLessThanOrEqual(60);
  });

  it("points at the committed file, not the dimensionless svg", () => {
    expect(PUBLISHER_LOGO.url).toMatch(/\/logo-600\.png$/);
  });
});
