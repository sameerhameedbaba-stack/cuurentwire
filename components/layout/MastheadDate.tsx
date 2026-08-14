"use client";

import { mastheadDate } from "@/lib/utils/time";

/**
 * Masthead date as a Client Component.
 *
 * Rendering the date in a Server Component baked the BUILD machine's date
 * into statically prerendered pages (About, Methodology, …) — dynamic pages
 * showed today while static pages showed the deploy day forever. As a
 * Client Component the prerendered HTML still carries a build-time date,
 * but hydration recomputes it on the viewer's clock and React patches the
 * text; suppressHydrationWarning silences the expected mismatch so there is
 * no flicker or console noise. Using a Client Component does not opt the
 * route into dynamic rendering, so static pages stay static.
 */
export function MastheadDate() {
  return (
    <p className="text-xs text-muted" suppressHydrationWarning>
      {mastheadDate()}
    </p>
  );
}
