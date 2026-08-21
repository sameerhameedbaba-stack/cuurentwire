import { logger } from "@/lib/utils/logger";

/**
 * Warm the homepage hero's optimized image variants after a refresh.
 *
 * The hero is the only image routed through the Vercel image optimizer
 * (next.config.ts). The optimizer transforms on demand: the FIRST request
 * for each (source, width, quality, format) is a cache MISS that fetches
 * the publisher original and re-encodes it — measured 2026-08-21 at 1-3 s
 * on a throttled probe, i.e. the whole LCP budget. Every visitor after the
 * first gets a HIT. Without warming, the visitor who pays the miss is often
 * the first one after a hero change: a real reader, or a PageSpeed/crawler
 * lab run. Two GETs per refresh (the two deviceSizes) move that cost off
 * the critical path. Counted in the quota math already — a warm request and
 * the visitor's request for the same variant are one transformation.
 *
 * Best-effort: network waits only, bounded, never throws.
 */

/** /_next/image URLs of the fetchpriority="high" <img> (src + srcset). */
export function extractHeroImageUrls(html: string): string[] {
  const tag = html.match(/<img[^>]*fetchpriority="high"[^>]*>/i)?.[0];
  if (!tag) return [];
  const urls = new Set<string>();
  const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
  if (src) urls.add(src);
  const srcset = tag.match(/\ssrcset="([^"]+)"/i)?.[1];
  if (srcset) {
    for (const candidate of srcset.split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) urls.add(url);
    }
  }
  return [...urls]
    .map((u) => u.replace(/&amp;/g, "&"))
    .filter((u) => u.startsWith("/_next/image?"));
}

export async function warmHomepageHero(baseUrl: string): Promise<number> {
  try {
    const page = await fetch(`${baseUrl}/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "CurrentWire/1.0 (hero warm-up)" },
    });
    if (!page.ok) return 0;
    const urls = extractHeroImageUrls(await page.text());
    if (urls.length === 0) return 0;
    const results = await Promise.allSettled(
      urls.map(async (path) => {
        const res = await fetch(`${baseUrl}${path}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
          // Browsers negotiate WebP; warm the variant they will actually ask for.
          headers: { Accept: "image/webp,image/*,*/*;q=0.8" },
        });
        // Drain so the optimizer completes and caches the transform.
        await res.arrayBuffer();
        return res.ok;
      }),
    );
    return results.filter((r) => r.status === "fulfilled" && r.value).length;
  } catch (error) {
    logger.warn("seo.hero_warm_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
}
