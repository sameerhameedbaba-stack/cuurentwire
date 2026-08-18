import type { NextConfig } from "next";

// 'unsafe-inline' for scripts/styles is required because Next.js emits inline
// bootstrap scripts and the theme pre-paint script in app/layout.tsx is inline
// (no nonce middleware). Dev additionally needs 'unsafe-eval' for HMR.
const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Publisher imagery loads from arbitrary https news CDNs (see images below).
  "img-src 'self' https: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
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
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
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
