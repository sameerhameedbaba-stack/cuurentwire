import ReactDOM from "react-dom";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";

/**
 * Opens the TCP+TLS connection to the origin serving the page's LCP image
 * before the parser reaches the <img>.
 *
 * Publisher imagery is served from the publisher's own CDN and
 * `next.config.ts` sets `images.unoptimized`, so the largest element on a
 * ranked page is always a third-party request that cannot start until DNS,
 * TCP and TLS have completed against a host the browser has never seen.
 * Measured 2026-08-19 (`data/cwv-history.json`, keyless probe under
 * Lighthouse mobile throttling): homepage LCP 3,632 ms against 1,628 ms on
 * /top-100 and 1,588 ms on a story page, with the hero a 71 KB JPEG on
 * ichef.bbci.co.uk.
 *
 * The origin changes with every story, so it is derived from the rendered
 * image rather than hardcoded — a fixed list would be wrong within the hour.
 * Renders nothing; `ReactDOM.preconnect` is the API the bundled Next docs
 * name for this (03-api-reference/04-functions/generate-metadata.md,
 * "<link rel=\"preconnect\">").
 */
export function ImageOriginPreconnect({
  src,
}: {
  src: string | null | undefined;
}) {
  if (!src || !isSafeExternalUrl(src)) return null;
  let origin: string;
  try {
    origin = new URL(src).origin;
  } catch {
    return null;
  }
  // crossOrigin: images are fetched anonymously, and a preconnect whose CORS
  // mode does not match the later request opens a connection that goes unused.
  ReactDOM.preconnect(origin, { crossOrigin: "anonymous" });
  ReactDOM.preconnect(origin);
  return null;
}
