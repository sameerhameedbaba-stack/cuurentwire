import type { NextConfig } from "next";

const securityHeaders = [
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
    // Publisher imagery comes from arbitrary news CDNs; https only.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
  poweredByHeader: false,
};

export default nextConfig;
