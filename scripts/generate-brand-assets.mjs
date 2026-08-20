import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cuts every raster brand asset from the 2026-08 "Pulse" logo kit (three
 * signal bars, rising red terminal — the kit's direction 1a):
 *
 *   public/opengraph-image.png  1200x630 social card (kit artboard 04);
 *                             served from public/ because this Next build
 *                             does not inject app/ og-image files on
 *                             non-story routes (audit F3) — metadata
 *                             references the URL explicitly
 *   public/logo-600.png       publisher.logo strip for JSON-LD (artboard 05,
 *                             cropped snug; <=600x60 per Google's guidance)
 *   public/icon-512.png       dark app-icon tile — directory uploads
 *   public/icon-512-light.png light variant of the same tile
 *   app/favicon.ico           16/32/48 PNG-in-ICO from the dark tile
 *
 * Renders in Playwright's Chromium so the wordmark is real Archivo (loaded
 * from Google Fonts — needs network). sharp (transitive via Next) downsizes
 * the 2x screenshots. The PNGs are committed; re-run only when the mark or
 * wordmark changes, then sync the width/height constants in
 * lib/seo/structured-data.tsx if logo-600.png's size changed (the script
 * prints it; tests/unit/publisher-logo.test.ts fails on drift).
 *
 * Usage: node scripts/generate-brand-assets.mjs
 */

// Mark geometry: 100u grid, 20u bars, 13u gutters, 87u baseline.
const mark = (a, b) => `
  <rect x="13" y="13" width="20" height="74" fill="${a}"></rect>
  <rect x="46" y="41" width="20" height="46" fill="${a}"></rect>
  <rect x="79" y="27" width="20" height="60" fill="${b}"></rect>`;

const wordmark = (size, ink, red) => `
  <div style="font-size:${size}px;font-weight:800;letter-spacing:-0.045em;line-height:1;color:${ink};white-space:nowrap">Current<span style="color:${red}">Wire</span></div>`;

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&display=block" rel="stylesheet">
<style>body{margin:0;background:transparent;font-family:Archivo,Arial,sans-serif}</style>
</head><body>

<div id="og" style="width:1200px;height:630px;background:#F7F7F5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px">
  <div style="display:flex;align-items:center;gap:32px">
    <svg width="96" height="96" viewBox="0 0 100 100" style="display:block;flex:none">${mark("#111111", "#C91920")}</svg>
    ${wordmark(84, "#111111", "#C91920")}
  </div>
  <div style="width:420px;height:2px;background:#201e1d"></div>
  <div style="font-size:30px;font-weight:600;letter-spacing:0.01em;color:#46433f">Top US &amp; Canada News, Ranked</div>
</div>

<div id="strip" style="display:inline-flex;padding:7px 4px">${wordmark(46, "#111111", "#C91920")}</div>

<div id="tile-dark" style="width:512px;height:512px;background:#111111;display:flex;align-items:center;justify-content:center">
  <svg width="308" height="308" viewBox="0 0 100 100" style="display:block">${mark("#F7F7F5", "#E0343B")}</svg>
</div>

<div id="tile-light" style="width:512px;height:512px;background:#F7F7F5;display:flex;align-items:center;justify-content:center">
  <svg width="308" height="308" viewBox="0 0 100 100" style="display:block">${mark("#111111", "#C91920")}</svg>
</div>

<!-- Favicon sizes use the kit's 16px treatment: mark box at 75% of tile. -->
<div id="tile-favicon" style="width:256px;height:256px;background:#111111;display:flex;align-items:center;justify-content:center">
  <svg width="192" height="192" viewBox="0 0 100 100" style="display:block">${mark("#F7F7F5", "#E0343B")}</svg>
</div>

</body></html>`;

/** ICO container with PNG-encoded entries (supported by every modern reader). */
function buildIco(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size & 0xff, e);
    header.writeUInt8(size & 0xff, e + 1);
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(buf.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.buf)]);
}

const { chromium } = await import("playwright");
const { default: sharp } = await import("sharp");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1400, height: 2600 },
  deviceScaleFactor: 2, // downsized below for crisp type
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// check() alone fails open: when the stylesheet request itself failed, no
// "Archivo" face is registered at all and check() treats the name as a system
// font, returning true. Require a loaded Archivo face as well.
const archivoLoaded = await page.evaluate(
  () =>
    [...document.fonts].some(
      (f) =>
        f.family.replace(/["']/g, "") === "Archivo" && f.status === "loaded",
    ) && document.fonts.check('800 84px "Archivo"'),
);
if (!archivoLoaded) {
  throw new Error("Archivo did not load — check network and rerun");
}

const shot = (id, opts) => page.locator(id).screenshot(opts);
const out = (...p) => join(process.cwd(), ...p);

const og = await sharp(await shot("#og")).resize(1200, 630).png().toBuffer();
writeFileSync(out("public", "opengraph-image.png"), og);

const strip = await sharp(await shot("#strip", { omitBackground: true }))
  .resize({ height: 60 })
  .png()
  .toBuffer();
const { width: stripW, height: stripH } = await sharp(strip).metadata();
writeFileSync(out("public", "logo-600.png"), strip);

for (const [id, file] of [
  ["#tile-dark", "icon-512.png"],
  ["#tile-light", "icon-512-light.png"],
]) {
  const png = await sharp(await shot(id)).resize(512, 512).png().toBuffer();
  writeFileSync(out("public", file), png);
}

const faviconShot = await shot("#tile-favicon");
const icoEntries = [];
for (const size of [16, 32, 48]) {
  icoEntries.push({
    size,
    // ensureAlpha: Turbopack's ICO decoder rejects PNG entries without RGBA.
    buf: await sharp(faviconShot).resize(size, size).ensureAlpha().png().toBuffer(),
  });
}
writeFileSync(out("app", "favicon.ico"), buildIco(icoEntries));

await browser.close();

console.log(`wrote public/opengraph-image.png (1200x630, ${og.length} bytes)`);
console.log(
  `wrote public/logo-600.png (${stripW}x${stripH}, ${strip.length} bytes) — keep lib/seo/structured-data.tsx PUBLISHER_LOGO in sync`,
);
console.log("wrote public/icon-512.png, public/icon-512-light.png, app/favicon.ico");
if (stripH > 60 || stripW > 600) {
  console.error("WARNING: exceeds Google's 600x60 publisher logo limit");
  process.exitCode = 1;
}
