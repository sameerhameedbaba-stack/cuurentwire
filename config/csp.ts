/**
 * The site's Content-Security-Policy, built in one place so it can be asserted
 * in tests rather than only observed on a live response.
 *
 * Extracted from next.config.ts on 2026-09-03, when a crawl of the served
 * headers caught `form-action 'self'` silently forbidding the newsletter form
 * that `72e30e7` had just added: `components/layout/NewsletterSignup.tsx` posts
 * straight to Buttondown's hosted endpoint, and a browser blocks a cross-origin
 * form submission that `form-action` does not name. Nothing logs server-side
 * when that happens — the signup would simply never subscribe anyone, on a
 * feature whose whole point is collecting addresses.
 */

/** Buttondown hosts the newsletter double-opt-in; the form posts directly to it. */
export const NEWSLETTER_FORM_ORIGIN = "https://buttondown.com";

export type CspOptions = {
  /** Dev needs 'unsafe-eval' for HMR. */
  isDev: boolean;
  /** GA domains join the policy only when a measurement ID is configured. */
  gaEnabled: boolean;
};

export function buildContentSecurityPolicy({ isDev, gaEnabled }: CspOptions): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' is required because Next.js emits inline bootstrap
    // scripts and the theme pre-paint script in app/layout.tsx is inline
    // (no nonce middleware).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${gaEnabled ? " https://www.googletagmanager.com" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Publisher imagery loads from arbitrary https news CDNs.
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    // gtag.js loads from googletagmanager.com; hits beacon to the
    // google-analytics collect endpoints, which shard across regional
    // subdomains (region1., etc.).
    `connect-src 'self'${gaEnabled ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // 'self' plus the newsletter provider, and nothing else: this directive is
    // the one that decides whether a signup reaches Buttondown at all.
    `form-action 'self' ${NEWSLETTER_FORM_ORIGIN}`,
    "object-src 'none'",
  ].join("; ");
}
