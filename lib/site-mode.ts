/**
 * Which site is being built.
 *
 * `static` is the production site from 2026-09-28: the slim relaunch, built as
 * a plain static export and served free by GitHub Pages. It carries original
 * articles and the trust pages — nothing that needs a server, a database or a
 * per-request render.
 *
 * WHY: the owner's rule is $0, and Vercel's free Hobby plan paused the old
 * aggregator (402 DEPLOYMENT_DISABLED from 2026-09-14) and did not lift at the
 * cycle reset. Its only offer was "Upgrade". A static site on GitHub Pages
 * cannot be paused for usage and has no paid tier to fall into.
 *
 * Unset means the original Vercel app, which is left intact and buildable as a
 * fallback. It is not what currentwire.us serves.
 *
 * Read at BUILD time. `next build` bakes this in; nothing here varies per
 * request, because in the static site there are no requests to vary on.
 *
 * It MUST be a NEXT_PUBLIC_ variable. The navigation is rendered by client
 * components (NavBar, MobileMenu), and Next only inlines NEXT_PUBLIC_ values
 * into browser bundles. A server-only variable would be undefined in the
 * browser, so the server would render the static nav and the client would
 * hydrate the aggregator's — a hydration mismatch on every page. The access
 * must also stay a literal `process.env.NEXT_PUBLIC_SITE_MODE` for the inliner
 * to find it.
 */
export const IS_STATIC_SITE = process.env.NEXT_PUBLIC_SITE_MODE === "static";
