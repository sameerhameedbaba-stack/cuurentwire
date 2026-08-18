import Image from "next/image";
import { CATEGORIES, type CategoryId } from "@/config/categories";

/**
 * Editorial image with graceful fallback.
 * - Remote publisher images render through next/image.
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
        // Next 16 deprecated `priority` in favour of explicit hints, and the
        // preload it emitted never carried fetchPriority through to the <img>
        // (docs: 01-app/03-api-reference/02-components/image.md — "use
        // loading='eager' or fetchPriority='high' instead of preload").
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className="object-cover"
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
