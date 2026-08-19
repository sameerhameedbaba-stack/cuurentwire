import type { NextConfig } from "next";

// 'unsafe-inline' for scripts/styles is required because Next.js emits inline
// bootstrap scripts and the theme pre-paint script in app/layout.tsx is inline
// (no nonce middleware). Dev additionally needs 'unsafe-eval' for HMR.
const isDev = process.env.NODE_ENV === "development";
// Google Analytics domains join the policy only when a measurement ID is
// configured at build time — without one the GoogleAnalytics component
// renders nothing and the CSP stays minimal. gtag.js loads from
// googletagmanager.com; hits beacon to the google-analytics collect
// endpoints, which shard across regional subdomains (region1., etc.).
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${gaEnabled ? " https://www.googletagmanager.com" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Publisher imagery loads from arbitrary https news CDNs (see images below).
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  `connect-src 'self'${gaEnabled ? " https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// Backlog 2b — CDN caching for the canonical /top-100 and /latest documents.
//
// Neither page can be made ISR. Both `await searchParams` for filters and
// pagination, and "searchParams is a Request-time API whose values cannot be
// known ahead of time. Using it will opt the page into dynamic rendering at
// request time" (node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/page.md). Next then emits
// `private, no-cache, no-store, max-age=0, must-revalidate` for any route whose
// collected revalidate is 0 (node_modules/next/dist/server/lib/cache-control.js),
// so the `generateStaticParams` fix that turned /story/[slug] into SSG (3e8397a)
// has nothing to bite on here.
//
// Next.js leaves exactly one escape hatch, and it is this file: the render
// pipeline writes its own Cache-Control only when the response does not already
// carry one — "If cache control is already set on the response we don't override
// it to allow users to customize it via next.config"
// (node_modules/next/dist/server/send-payload.js) — and next.config `headers`
// are step 1 of the routing order, before the render.
//
// 300s matches the ISR window every other cached surface already uses (live
// `X-Nextjs-Stale-Time: 300`). The trade-off: the cron's revalidatePath()
// cannot purge a raw CDN entry, so these two documents can lag a fresh dataset
// by up to s-maxage + stale-while-revalidate.
//
// Two headers, deliberately split, because whether Vercel's edge honours a
// header rule for a dynamic function route is NOT established by the bundled
// docs and NOT demonstrated anywhere on this deployment — every cache HIT
// measured on 2026-08-19 (`/`, `/us`) carries `X-Nextjs-Prerender: 1`, i.e. it
// came from the prerender manifest, not from a Cache-Control string.
//
// LIST_EDGE_CACHE_CONTROL is the shared-cache instruction. It goes in
// `Vercel-CDN-Cache-Control`, which the Vercel edge consumes and STRIPS before
// the response reaches the client. If Vercel ignores it, it reached no cache
// at all and nothing downstream was misinformed.
//
// LIST_CLIENT_CACHE_CONTROL is what browsers and any third-party cache see. It
// is byte-identical to what `/` and `/us` already serve today, so this rule
// tells the public internet nothing new. It must never contain s-maxage while
// the edge behaviour is unproven: a page whose entire value is freshness must
// not advertise a 5-minute shared TTL that no cache is actually honouring —
// and this rule also lands on error renders, which set
// `private, no-cache, no-store` in Next's own base-server.
const LIST_EDGE_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=60";
const LIST_CLIENT_CACHE_CONTROL = "public, max-age=0, must-revalidate";

// Every request shape that must NOT be served from a shared cache. matchHas
// computes `has.every(...) && !missing.some(...)`, so ALL of these must be
// absent for the header to apply
// (node_modules/next/dist/shared/lib/router/utils/prepare-destination.js).
//
// One nuance: an empty value counts as absent (`if (!hasItem.value && value)`
// in that file), so `/top-100?page=` and `/latest?country=` also get the
// header. That is safe here — `Number.parseInt("")` clamps to page 1,
// `parseCountryFilter("")` returns "all", and generateMetadata emits the plain
// `/top-100` / `/latest` canonical for both — but it is not literally
// "the canonical request and nothing else".
const NON_CANONICAL_LIST_REQUEST = [
  // RSC payload and prefetch requests keep Next's dynamic `no-store`, so a
  // cached HTML document can never be handed to the client router.
  { type: "header" as const, key: "rsc" },
  { type: "header" as const, key: "next-router-prefetch" },
  { type: "query" as const, key: "_rsc" },
  // URL state. Anything that changes what the page renders stays uncached, so
  // filtered variants, the ?page=N canonicals and the out-of-range
  // `noindex, follow` responses are untouched by this rule.
  { type: "query" as const, key: "page" },
  { type: "query" as const, key: "country" },
  { type: "query" as const, key: "category" },
  { type: "query" as const, key: "time" },
  { type: "query" as const, key: "sort" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker/generic Node hosting.
  // Vercel's build pipeline conflicts with standalone output, so skip it there.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    // Serve images as-is (2026-08 audit): the Vercel image optimizer's free
    // tier is ~5K transformations/month — a news homepage full of publisher
    // imagery burns through that — and the wildcard remotePatterns the
    // optimizer needed made /_next/image an open proxy for arbitrary https
    // URLs. Unoptimized kills both; publisher CDNs already serve sized,
    // compressed variants. remotePatterns removed: it is inert (and
    // misleading) once the optimizer is off.
    unoptimized: true,
  },
  headers: async () => [
    { source: "/(.*)", headers: securityHeaders },
    // Listed after the catch-all on purpose: when two rules set the same
    // header key, the last one wins.
    {
      source: "/top-100",
      missing: NON_CANONICAL_LIST_REQUEST,
      headers: [
        { key: "Vercel-CDN-Cache-Control", value: LIST_EDGE_CACHE_CONTROL },
        { key: "Cache-Control", value: LIST_CLIENT_CACHE_CONTROL },
      ],
    },
    {
      source: "/latest",
      missing: NON_CANONICAL_LIST_REQUEST,
      headers: [
        { key: "Vercel-CDN-Cache-Control", value: LIST_EDGE_CACHE_CONTROL },
        { key: "Cache-Control", value: LIST_CLIENT_CACHE_CONTROL },
      ],
    },
  ],
  experimental: {
    // Server-rendered 404 for unmatched URLs (app/global-not-found.tsx) —
    // the default client-only 404 shipped an empty <body> without JS.
    globalNotFound: true,
  },
  // www serves the whole site as a duplicate host without this — one
  // canonical host (the apex) for every URL.
  redirects: async () => [
    {
      source: "/:path*",
      has: [{ type: "host", value: "www.currentwire.us" }],
      destination: "https://currentwire.us/:path*",
      permanent: true,
    },
  ],
  poweredByHeader: false,
};

export default nextConfig;
