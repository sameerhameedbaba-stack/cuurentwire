/**
 * Publisher feed images are whatever the publisher happened to reference, and
 * that ranges from a 60x60 thumbnail to a 7,559px original. Both extremes are
 * bugs for us: the small ones blur on cards, and the large ones own the
 * homepage LCP (measured 2026-08-19: a 71 KB hero rendered LCP 3,632 ms, a
 * 546 KB hero 8,556 ms on the same page).
 *
 * There is no local resizing path — `next.config.ts` sets
 * `images.unoptimized` because the Vercel optimizer's free tier is ~5K
 * transformations/month and its wildcard `remotePatterns` made `/_next/image`
 * an open proxy — so every rule here has to be one the publisher's own CDN
 * already honours. Each was verified live with a fetch that checked the status,
 * the byte count AND the decoded pixel dimensions; the date and numbers are
 * recorded beside the rule so nobody has to re-derive them.
 *
 * Rules are strictly per-host and conservative: signed URLs whose signature
 * binds one rendition (The Guardian's `s=`) are never touched, hosts with no
 * verified lever (static.politico.com) pass through unchanged, and an
 * unrecognised URL shape on a known host passes through rather than guessing.
 */

/**
 * One delivery width for every host. 976 is the BBC recipe width the site
 * already targeted, it covers the widest card at 2x on a phone, and every
 * rule below was measured at it.
 */
const TARGET_WIDTH = 976;

/**
 * Delivery quality for the CDNs that accept one. Publishers ship 80-90
 * themselves; 80 is the standard web-delivery setting and it is where the
 * measurements below were taken.
 */
const TARGET_QUALITY = 80;

/**
 * CBS renditions at or above this width are left alone — they are already
 * card-sized. Below it (the feeds' 60x60 thumbs) we serve the original.
 */
const CBS_MIN_KEEP_WIDTH = 400;

/**
 * Formats no image CDN resizes and no browser should be asked to download.
 * A publisher shipping one of these is always a mistake on their side:
 * `globalnews.ca/.../Classroom.bmp` was live on /health at **6,221 KB**
 * (verified 2026-08-19), and WordPress's `?w=` resizer ignores it because it
 * only handles jpg/png/gif/webp — so there is no lever except not using it.
 * Rendering the story without an image costs a large-thumbnail slot; rendering
 * a 6 MB uncompressed bitmap costs the LCP outright.
 */
const UNDELIVERABLE_FORMAT = /\.(?:bmp|tiff?)(?:$|[?#])/i;

/**
 * WordPress serves resized derivatives from `?w=` on these hosts. Verified
 * 2026-08-19 (bytes / decoded size, original -> `?w=976`):
 *   globalnews.ca            160 KB 1920x1080 ->  75 KB 976x549
 *   platform.theverge.com    607 KB 3840x2160 ->  99 KB 976x549
 *   thehill.com               89 KB 1400x787  ->  46 KB 976x548
 * An existing `w=` is the publisher's own choice of rendition and is kept
 * (The Hill's feed already ships `?w=900`); we only fill the gap when there
 * is none.
 */
const WORDPRESS_WIDTH_HOSTS = new Set([
  "globalnews.ca",
  "platform.theverge.com",
  "thehill.com",
]);

function appendQuery(url: string, params: string): string {
  // Concatenate rather than round-tripping through URLSearchParams: these URLs
  // carry unencoded commas (`crop=0,0,100,100`) that re-encoding would change.
  return `${url}${url.includes("?") ? "&" : "?"}${params}`;
}

export function upgradeImageUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (UNDELIVERABLE_FORMAT.test(parsed.pathname)) return undefined;

  // BBC: /ace/standard/<width>/... and /news/<width>/... accept the standard
  // recipe widths (240/480/624/800/976/1024...). Upgrade small renditions.
  //
  // The two recipes are NOT interchangeable, and which is cheaper depends
  // entirely on the source format. Measured 2026-08-21 at width 976, on 10
  // live assets, comparing bytes AND decoded pixels:
  //
  //   .png  ace/standard keeps PNG   140-929 KB  ->  news re-encodes to JPEG
  //                                                   28-106 KB, -80% to -92%
  //                                                   on 6 of 6, same pixels
  //   .jpg  ace/standard already JPEG 39-137 KB  ->  news is LARGER, +14% to
  //                                                   +19% on 4 of 4
  //
  // So the recipe swap is applied to PNG only. A blanket switch would have
  // been a 15% regression on the JPEGs that are the overwhelming majority of
  // BBC's feed images — the same trap as forcing our width over The Hill's
  // own `?w=900`. Photographic PNGs are the whole problem here: a 976px BBC
  // PNG was the single image that failed the health check on 2026-08-21 at
  // 683 KB, which is more than the entire rest of /top-100 put together.
  if (parsed.hostname === "ichef.bbci.co.uk") {
    const isPng = /\.png(?:$|[?#])/i.test(parsed.pathname);
    return url.replace(
      /\/(ace\/standard|news)\/(\d{2,4})\//,
      (match, prefix: string, width: string) => {
        const nextPrefix = isPng ? "news" : prefix;
        // An existing width at or above the target is BBC's own rendition
        // choice; only fill the gap when they picked a smaller one.
        const nextWidth = Math.max(Number(width), TARGET_WIDTH);
        if (nextPrefix === prefix && nextWidth === Number(width)) return match;
        return `/${nextPrefix}/${nextWidth}/`;
      },
    );
  }

  // CBS: feed <image> URLs are tiny signed renditions, e.g.
  // …cbsnewsstatic.com/hub/i/r/<date>/<id>/thumbnail/60x60/<32-hex>/pic.jpg.
  // The size cannot be swapped — the hex segment signs exactly one rendition
  // and every other size 404s (verified live 2026-08-18) — but removing the
  // whole /thumbnail/<size>/<hex>/ segment serves the ORIGINAL asset, and the
  // original is unbounded: 4,085 KB at 4896x3264 on /top-100 (2026-08-19).
  // The original DOES honour `?width=` (the signed thumbnails' fixed size was
  // never the CDN's only lever, only the only one tried): the same asset
  // returns 200 KB at 976x651 with `?width=976&quality=80`, a 95% cut,
  // verified across assets1/2/3. Signed thumbnails we keep are left exactly
  // as signed — `?width=` on those is unverified and the signature may bind
  // the response.
  if (/^assets\d+\.cbsnewsstatic\.com$/.test(parsed.hostname)) {
    const original = url.replace(
      /\/thumbnail\/(\d{2,4})x\d{2,4}\/[0-9a-f]{32}\//,
      (match, width) => (Number(width) < CBS_MIN_KEEP_WIDTH ? "/" : match),
    );
    if (original.includes("/thumbnail/")) return original;
    if (/[?&]width=/.test(original)) return original;
    return appendQuery(
      original,
      `width=${TARGET_WIDTH}&quality=${TARGET_QUALITY}`,
    );
  }

  // NPR (Brightspot dims3): the feed hands us the crop at its FULL source
  // size — `/resize/7559x5039!/` really did serve a 6,366 KB JPEG on /top-100
  // (2026-08-19). The endpoint is unsigned and the filter chain is editable:
  // rewriting to `/resize/976x651!/quality/80/` returned 84 KB at 976x651,
  // and 4,630 KB -> 174 KB on a second asset. Aspect ratio is preserved from
  // the requested box, and renditions already at or under the target are left
  // alone.
  if (parsed.hostname === "npr.brightspotcdn.com") {
    if (!/\/dims\d\//.test(parsed.pathname)) return url;
    const resized = url.replace(
      /\/resize\/(\d{2,5})x(\d{2,5})(!?)\//,
      (match, w, h, bang) => {
        const width = Number(w);
        const height = Number(h);
        if (width <= TARGET_WIDTH || height < 1) return match;
        const scaled = Math.max(1, Math.round((height * TARGET_WIDTH) / width));
        return `/resize/${TARGET_WIDTH}x${scaled}${bang}/`;
      },
    );
    if (resized === url || /\/quality\/\d+\//.test(resized)) return resized;
    return resized.replace("/?url=", `/quality/${TARGET_QUALITY}/?url=`);
  }

  if (
    WORDPRESS_WIDTH_HOSTS.has(parsed.hostname) &&
    parsed.pathname.includes("/wp-content/uploads/") &&
    !/[?&]w=/.test(url)
  ) {
    return appendQuery(url, `w=${TARGET_WIDTH}`);
  }

  return url;
}
