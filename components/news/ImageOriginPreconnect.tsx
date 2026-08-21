import ReactDOM from "react-dom";
import { isOptimizableImageHost } from "@/config/image-hosts";
import { isSafeExternalUrl } from "@/lib/news/normalization/canonicalize";

/**
 * Opens the TCP+TLS connection to the origin serving the page's LCP image
 * before the parser reaches the <img>.
 *
 * Publisher imagery is served raw from the publisher's own CDN on every
 * page except the homepage hero (which `next.config.ts` routes through the
 * optimizer for allowlisted hosts), so the largest element on a ranked page
 * is usually a third-party request that cannot start until DNS, TCP and TLS
 * have completed against a host the browser has never seen.
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
  optimized = false,
}: {
  src: string | null | undefined;
  /**
   * The page routes this image through the optimizer (homepage hero, see
   * next.config.ts): the browser then fetches same-origin /_next/image and
   * a preconnect to the publisher's CDN would open a connection nothing
   * uses. Hosts outside the allowlist still load raw, so preconnect then.
   */
  optimized?: boolean;
}) {
  if (!src || !isSafeExternalUrl(src)) return null;
  if (optimized && isOptimizableImageHost(src)) return null;
  let origin: string;
  try {
    origin = new URL(src).origin;
  } catch {
    return null;
  }
  // NO crossOrigin. A preconnect whose CORS mode does not match the later
  // request opens a second connection that is never used, and these <img>
  // tags carry no crossorigin attribute, so the browser fetches them in
  // no-cors mode. Emitting both forms (as this did on first write) cost an
  // extra TLS handshake competing with the LCP image on a throttled link.
  ReactDOM.preconnect(origin);
  return null;
}
