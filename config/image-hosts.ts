/**
 * Publisher image hosts the Vercel image optimizer may transform.
 *
 * Why an allowlist exists at all. `images.unoptimized` went on in the 2026-08
 * audit for two measured reasons: the optimizer's Hobby quota is 5,000
 * transformations a month — billed per cache MISS, keyed by source URL +
 * width + quality + format (vercel.com/docs/image-optimization/
 * limits-and-pricing) — while the whole site's imagery needs 5k-21k; and the
 * wildcard remotePatterns it ran under made /_next/image an open proxy for
 * any https URL. The optimizer is now back ON for exactly one image per page,
 * the LCP hero (components/news/RemoteImage.tsx takes that decision), and only
 * when the hero's host is on this list. next.config.ts turns the same list
 * into `remotePatterns`, so the server-side allowlist and the client-side
 * decision cannot drift apart.
 *
 * Provenance (keep alphabetised, exact hostnames, lowercase):
 *   - the publisher image CDNs recorded in the 2026-08 ingest audit;
 *   - every https <img src> host on the live /, /top-100, /latest, /us,
 *     /canada and section pages fetched 2026-08-22 — this added
 *     cdn.mos.cms.futurecdn.net (Space.com / Future plc);
 *   - globalnews.ca, measured 2026-08-19 as a WordPress host serving story
 *     images (lib/news/normalization/image-upgrade.ts).
 * static01.nyt.com and media.cnn.com are deliberately absent: neither feed
 * is ingested (config/feeds.ts).
 *
 * This file must not import from lib/ or use the `@/` alias: next.config.ts
 * loads it through Next's own require hook, outside the app bundle.
 */
export const OPTIMIZED_IMAGE_HOSTS: readonly string[] = [
  "a57.foxnews.com",
  "assets.science.nasa.gov",
  "assets1.cbsnewsstatic.com",
  "assets2.cbsnewsstatic.com",
  "assets3.cbsnewsstatic.com",
  "ca-times.brightspotcdn.com",
  "calmatters.org",
  "cdn.arstechnica.net",
  "cdn.mos.cms.futurecdn.net",
  "cdn.vox-cdn.com",
  "d3i6fh83elv35t.cloudfront.net",
  "deadline.com",
  "globalnews.ca",
  "grist.org",
  "i.abcnewsfe.com",
  "i.cbc.ca",
  "i.guim.co.uk",
  "ichef.bbci.co.uk",
  "images.axios.com",
  "images.mktw.net",
  "images.theconversation.com",
  "insideclimatenews.org",
  "kffhealthnews.org",
  "media-cldnry.s-nbcnews.com",
  "media.npr.org",
  "media.zenfs.com",
  "npr.brightspotcdn.com",
  "platform.theverge.com",
  "s.abcnews.com",
  "s.france24.com",
  "sportshub.cbsistatic.com",
  "static.foxnews.com",
  "thehill.com",
  "variety.com",
  "www.aljazeera.com",
  "www.billboard.com",
  "www.cbsnews.com",
  "www.chalkbeat.org",
  "www.nasa.gov",
  "www.propublica.org",
  "www.sportsnet.ca",
  "www.statnews.com",
  "www.texastribune.org",
];

/**
 * True when `url` is an https URL whose hostname is an allowlisted host or a
 * subdomain of one. The match is on label boundaries, so a host that merely
 * ends with an allowlisted string (evil-ichef.bbci.co.uk.attacker.com) fails.
 * Mirrors the `remotePatterns` next.config.ts derives from the same list
 * (`host` plus `**.host`), which is what keeps the optimizer from answering
 * 400 to a URL this function said yes to.
 */
export function isOptimizableImageHost(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  // URL already lowercases and punycodes the hostname. Exact match only:
  // Next caps images.remotePatterns at 50 entries, so the config lists each
  // host once (no `**.host` companions) — the helper must agree exactly or
  // the server would 400 a URL the client believed optimizable. New CDN
  // subdomains are added to the list as they appear in live imagery.
  const { hostname } = parsed;
  return OPTIMIZED_IMAGE_HOSTS.includes(hostname);
}
