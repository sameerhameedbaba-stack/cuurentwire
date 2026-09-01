import { CATEGORIES, type CategoryId } from "@/config/categories";
import { CategoryPlaceholderArt } from "./CategoryPlaceholderArt";
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
        //
        // The placeholder travels as a LABEL, not as rendered art: props to a
        // Client Component are serialized into the RSC flight payload in the
        // HTML, so a pre-rendered node cost ~1,045 bytes on every image to
        // render at most one of them (see CategoryPlaceholderArt).
        <RemoteImage
          src={src}
          alt={alt}
          sizes={sizes}
          priority={priority}
          eager={eager}
          optimize={optimize}
          fallbackLabel={CATEGORIES[category].label}
        />
      )}
    </div>
  );
}

/**
 * Typographic/geometric placeholder — clearly graphic, never a fake photo.
 *
 * Server-side convenience wrapper: resolves the category to its label and
 * hands off to the art, which is kept in its own module so the Client
 * Component can render it without dragging `config/categories.ts` into the
 * browser bundle.
 */
export function CategoryPlaceholder({ category }: { category: CategoryId }) {
  return <CategoryPlaceholderArt label={CATEGORIES[category].label} />;
}
