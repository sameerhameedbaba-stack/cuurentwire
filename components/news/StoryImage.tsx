import { CATEGORIES, type CategoryId } from "@/config/categories";
import { RemoteImage } from "./RemoteImage";

/**
 * Editorial image with graceful fallback.
 * - Remote publisher images render through next/image with the optimizer
 *   bypassed per image (unoptimized={true} — Vercel Hobby's 5,000
 *   transformations/month cannot cover our ingest, and a blown quota 402s
 *   every NEW image mid-cycle): plain publisher src, no generated srcset.
 * - The one exception is a caller that passes `optimize`: the page's LCP
 *   hero goes through the optimizer as WebP at two widths when its host is
 *   allowlisted in config/image-hosts.ts, and degrades to the raw src (then
 *   to the placeholder) client-side if the optimized request fails.
 * - A remote image whose publisher CDN has died swaps to the category
 *   placeholder client-side (see RemoteImage) instead of a broken frame.
 * - Local placeholder art renders as plain <img> (SVG assets).
 * - Missing imagery falls back to a typographic category placeholder —
 *   never a fabricated news photograph.
 */
export function StoryImage({
  src,
  alt,
  category,
  aspect = "16/9",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  eager = false,
  optimize = false,
}: {
  src?: string;
  alt: string;
  category: CategoryId;
  aspect?: "16/9" | "3/2" | "4/3" | "1/1";
  sizes?: string;
  /** The LCP image of the page — eager plus fetchPriority="high". */
  priority?: boolean;
  /** Above the fold but not the LCP element — eager at normal priority. */
  eager?: boolean;
  /**
   * Send this image through the Vercel optimizer (allowlisted hosts only).
   * Deliberately separate from `priority`: every /story/[slug] page and every
   * section hero also marks its lead image priority, and ~755 story pages a
   * refresh would burn the 5,000/month quota in days. The quota math only
   * holds for the homepage hero (~30-60 source changes a day, two widths
   * each), so the caller that IS that hero opts in explicitly.
   */
  optimize?: boolean;
}) {
  const aspectClass = {
    "16/9": "aspect-[16/9]",
    "3/2": "aspect-[3/2]",
    "4/3": "aspect-[4/3]",
    "1/1": "aspect-square",
  }[aspect];

  if (!src) {
    return (
      <div className={`img-frame relative ${aspectClass}`}>
        <CategoryPlaceholder category={category} />
      </div>
    );
  }

  const isLocal = src.startsWith("/");
  return (
    <div className={`img-frame relative ${aspectClass}`}>
      {isLocal ? (
        // Local SVG placeholder art — no optimizer pass needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        // Client wrapper: onError needs a client component, and archived
        // stories hotlink publisher CDNs forever — when the upstream dies
        // the frame swaps to the placeholder passed here as a
        // server-rendered node. Next 16 deprecated `priority` in favour of
        // explicit hints, and the preload it emitted never carried
        // fetchPriority through to the <img> (docs:
        // 01-app/03-api-reference/02-components/image.md — "use
        // loading='eager' or fetchPriority='high' instead of preload").
        <RemoteImage
          src={src}
          alt={alt}
          sizes={sizes}
          priority={priority}
          eager={eager}
          optimize={optimize}
          fallback={<CategoryPlaceholder category={category} />}
        />
      )}
    </div>
  );
}

/** Typographic/geometric placeholder — clearly graphic, never a fake photo. */
export function CategoryPlaceholder({ category }: { category: CategoryId }) {
  const label = CATEGORIES[category].label;
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-end bg-wash p-4 dark:bg-[#1a1a19]"
    >
      <svg
        className="absolute inset-0 h-full w-full text-rule dark:text-[#2a2a28]"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 400 225"
        fill="none"
      >
        <line x1="0" y1="225" x2="400" y2="25" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="185" x2="400" y2="-15" stroke="currentColor" strokeWidth="1" />
        <line x1="0" y1="265" x2="400" y2="65" stroke="currentColor" strokeWidth="1" />
        <circle cx="330" cy="60" r="34" stroke="currentColor" strokeWidth="1" />
        <rect x="24" y="36" width="10" height="26" fill="#c91920" opacity="0.85" />
        <rect x="40" y="48" width="10" height="14" fill="#c91920" opacity="0.5" />
      </svg>
      <span className="relative font-display text-xs font-bold uppercase tracking-[0.2em] text-faint">
        {label}
      </span>
    </div>
  );
}
