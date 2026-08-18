"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Remote publisher image with a client-side dead-upstream fallback.
 *
 * Publisher CDNs eventually kill hotlinked assets on archived stories, and a
 * server component cannot observe that — `onError` requires a client
 * component (docs: 01-app/03-api-reference/02-components/image.md). On error
 * this swaps in `fallback`, the category placeholder the server-component
 * caller (StoryImage) passes down already rendered, so a dead URL degrades to
 * the same art as a missing one instead of a broken image frame.
 *
 * With images.unoptimized set in next.config.ts (Vercel Hobby's 5,000
 * transformations/month cannot cover our ingest), next/image serves the
 * publisher src as-is with no generated srcset. `sizes` is still passed
 * through — inert without a srcset, correct again if the optimizer ever
 * returns — and the loading/fetchPriority hints apply unchanged.
 */
export function RemoteImage({
  src,
  alt,
  sizes,
  priority = false,
  eager = false,
  fallback,
}: {
  src: string;
  alt: string;
  sizes: string;
  /** The LCP image of the page — eager plus fetchPriority="high". */
  priority?: boolean;
  /** Above the fold but not the LCP element — eager at normal priority. */
  eager?: boolean;
  /** Server-rendered placeholder shown when the upstream image is dead. */
  fallback: ReactNode;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  // An image that failed before hydration never fires onError afterwards —
  // read the browser's verdict off the element once on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return <>{fallback}</>;

  return (
    <Image
      ref={imgRef}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading={priority || eager ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
