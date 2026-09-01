"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { isOptimizableImageHost } from "@/config/image-hosts";
import { CategoryPlaceholderArt } from "./CategoryPlaceholderArt";

/**
 * Remote publisher image with a staged client-side fallback.
 *
 * Three delivery modes, tried in order:
 *
 *   "optimized" — /_next/image WebP via the Vercel optimizer. Only when the
 *     caller opts in (`optimize`, the page's LCP hero) AND the host is in
 *     config/image-hosts.ts. The optimizer's Hobby quota (5,000
 *     transformations/month) cannot cover the whole ingest, so everything else
 *     stays raw — next.config.ts keeps `images.unoptimized` false solely so
 *     this one image can opt in, which is why every <Image> here passes an
 *     explicit `unoptimized` value.
 *   "raw" — the publisher src as-is, no srcset. The default for every
 *     non-hero image, and the first fallback when an optimized request errors:
 *     a blown quota answers 402 for every NEW image for the rest of the month
 *     (vercel.com/docs/image-optimization/limits-and-pricing), and an
 *     allowlisted CDN can still refuse the optimizer's fetch (502/504). Neither
 *     means the publisher asset is gone, so the hero must fall back to the raw
 *     URL rather than to placeholder art — a broken or blank hero for a month
 *     would cost more LCP than the optimizer ever saved.
 *   "failed" — the raw URL errored too: the publisher CDN has killed the
 *     hotlinked asset (archived stories do this eventually). Swap in the
 *     category placeholder, so a dead URL degrades to the same art as a
 *     missing one instead of a broken image frame. The caller passes only the
 *     resolved category LABEL: this is a Client Component, so every prop is
 *     serialized into the RSC flight payload embedded in the HTML, and the
 *     art used to travel as a pre-rendered `ReactNode` — ~1,045 bytes per
 *     image, on every image, to render at most one of them (see
 *     CategoryPlaceholderArt for the measurements).
 *
 * `onError` requires a client component (docs:
 * 01-app/03-api-reference/02-components/image.md). An image that failed
 * before hydration never fires onError afterwards, so the browser's verdict is
 * also read off the element once on mount, and it walks the same stages.
 *
 * `sizes` only produces a srcset in "optimized" mode; it is passed through in
 * every mode so the loading/fetchPriority hints stay identical across stages.
 */
type DeliveryMode = "optimized" | "raw" | "failed";

export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  eager = false,
  optimize = false,
  fallbackLabel,
}: {
  src: string;
  alt: string;
  sizes: string;
  /** The LCP image of the page — eager plus fetchPriority="high". */
  priority?: boolean;
  /** Above the fold but not the LCP element — eager at normal priority. */
  eager?: boolean;
  /**
   * Ask the Vercel optimizer for this image. Honoured only when the host is
   * allowlisted in config/image-hosts.ts; reserved for the LCP hero because
   * every optimized source costs transformation quota.
   */
  optimize?: boolean;
  /**
   * Category label for the placeholder shown when the upstream image is dead.
   * A string, not a rendered node — see the delivery-mode note above.
   */
  fallbackLabel: string;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Pure function of props, so server and client agree on the first render.
  const [mode, setMode] = useState<DeliveryMode>(() =>
    optimize && isOptimizableImageHost(src) ? "optimized" : "raw",
  );

  // One step down the ladder: optimized -> raw -> failed.
  const degrade = useCallback(() => {
    setMode((current) => (current === "optimized" ? "raw" : "failed"));
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) degrade();
  }, [degrade]);

  if (mode === "failed") return <CategoryPlaceholderArt label={fallbackLabel} />;

  return (
    <Image
      ref={imgRef}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={mode !== "optimized"}
      loading={priority || eager ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className="object-cover"
      onError={degrade}
    />
  );
}
