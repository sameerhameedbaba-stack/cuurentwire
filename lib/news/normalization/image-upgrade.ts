/**
 * Publisher feeds often reference small thumbnail renditions (BBC's feeds use
 * 240px-wide images) that blur when rendered on large cards. For CDNs whose
 * URLs encode the width and serve larger renditions of the same asset, we
 * request a bigger size. Rules are strictly per-CDN and conservative: signed
 * URLs (e.g. The Guardian's `s=` signature) are never touched, and unknown
 * hosts pass through unchanged.
 */

const BBC_TARGET_WIDTH = 976;

/**
 * CBS renditions at or above this width are left alone — they are already
 * card-sized. Below it (the feeds' 60x60 thumbs) we serve the original.
 */
const CBS_MIN_KEEP_WIDTH = 400;

export function upgradeImageUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // BBC: /ace/standard/<width>/... and /news/<width>/... accept the standard
  // recipe widths (240/480/624/800/976/1024...). Upgrade small renditions.
  if (parsed.hostname === "ichef.bbci.co.uk") {
    return url.replace(
      /\/(ace\/standard|news)\/(\d{2,3})\//,
      (match, prefix, width) =>
        Number(width) < BBC_TARGET_WIDTH
          ? `/${prefix}/${BBC_TARGET_WIDTH}/`
          : match,
    );
  }

  // CBS: feed <image> URLs are tiny signed renditions, e.g.
  // …cbsnewsstatic.com/hub/i/r/<date>/<id>/thumbnail/60x60/<32-hex>/pic.jpg.
  // The size cannot be swapped — the hex segment signs exactly one rendition
  // and every other size 404s (verified live 2026-08-18) — but removing the
  // whole /thumbnail/<size>/<hex>/ segment serves the ORIGINAL asset
  // (verified 200 + image/jpeg across assets1/2/3.cbsnewsstatic.com). Only
  // small renditions are rewritten; anything card-sized passes through.
  if (/^assets\d+\.cbsnewsstatic\.com$/.test(parsed.hostname)) {
    return url.replace(
      /\/thumbnail\/(\d{2,4})x\d{2,4}\/[0-9a-f]{32}\//,
      (match, width) => (Number(width) < CBS_MIN_KEEP_WIDTH ? "/" : match),
    );
  }

  return url;
}
