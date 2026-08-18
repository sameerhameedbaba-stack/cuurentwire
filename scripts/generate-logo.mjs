import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Rasterizes public/logo.svg into public/logo-600.png — the publisher.logo
 * used by NewsArticle/Organization JSON-LD (audit F6). Google's article
 * structured-data guidance wants a raster logo with explicit dimensions,
 * at most 600px wide and 60px tall; the 408-byte dimensionless SVG was a
 * weak signal for Google News.
 *
 * Renders at exactly 60px tall (width follows the SVG's 560:96 aspect —
 * 350px). The PNG is committed; re-run this script only when logo.svg
 * changes, then update the width/height constants in
 * lib/seo/structured-data.tsx if the aspect ratio changed.
 *
 * Uses sharp, which is already present transitively via Next — $0, no new
 * dependency. Usage: node scripts/generate-logo.mjs
 */

const TARGET_HEIGHT = 60;

const svgPath = join(process.cwd(), "public", "logo.svg");
const outPath = join(process.cwd(), "public", "logo-600.png");

const { default: sharp } = await import("sharp");

const svg = readFileSync(svgPath);
// Render at 4x density for crisp text, then resize down to the target.
const image = sharp(svg, { density: 288 }).resize({ height: TARGET_HEIGHT });
const buffer = await image.png().toBuffer();
const { width, height } = await sharp(buffer).metadata();

writeFileSync(outPath, buffer);
console.log(`wrote public/logo-600.png (${width}x${height}, ${buffer.length} bytes)`);
if (height > 60 || width > 600) {
  console.error("WARNING: exceeds Google's 600x60 publisher logo limit");
  process.exitCode = 1;
}
