import Script from "next/script";

/**
 * The measurement ID is interpolated into an inline script, so it is
 * validated against Google's G-XXXXXXX shape first — a malformed env value
 * disables analytics rather than shipping arbitrary text into a <script>.
 */
const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

/**
 * Google Analytics 4 page-view collection. Renders nothing unless
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so local dev, previews without the
 * variable and forks collect nothing — matching the privacy page's promise
 * that analytics only runs when it is deliberately configured.
 *
 * GA4's enhanced measurement tracks client-side navigations (history
 * events) on its own, so the single config call below covers both full
 * page loads and next/link navigations.
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId || !GA_MEASUREMENT_ID_PATTERN.test(gaId)) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
