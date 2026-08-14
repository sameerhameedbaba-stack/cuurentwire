/**
 * Publisher feeds often reference small thumbnail renditions (BBC's feeds use
 * 240px-wide images) that blur when rendered on large cards. For CDNs whose
 * URLs encode the width and serve larger renditions of the same asset, we
 * request a bigger size. Rules are strictly per-CDN and conservative: signed
 * URLs (e.g. The Guardian's `s=` signature) are never touched, and unknown
 * hosts pass through unchanged.
 */

const BBC_TARGET_WIDTH = 976;

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

  return url;
}
