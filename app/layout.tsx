import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { siteConfig } from "@/config/site";
import { Footer } from "@/components/layout/Footer";
import { GoogleAnalytics } from "@/components/layout/GoogleAnalytics";
import { Header } from "@/components/layout/Header";
import { DemoBanner } from "@/components/layout/DemoBanner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.seo.defaultTitle,
    template: siteConfig.seo.titleTemplate,
  },
  description: siteConfig.seo.defaultDescription,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.seo.defaultTitle,
    description: siteConfig.seo.defaultDescription,
    // The root app/opengraph-image.tsx exists but this Next build does not
    // inject it on non-story routes (audit F3) — reference it explicitly.
    // Resolved against metadataBase.
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: siteConfig.name },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.seo.twitterHandle,
    images: ["/opengraph-image"],
  },
  alternates: {
    types: { "application/rss+xml": [{ url: "/rss", title: siteConfig.name }] },
  },
  // Sitewide default: indexable with large image previews (Discover/Top
  // Stories eligibility). Pages built with pageMetadata({noIndex}) replace
  // this wholesale with their own robots value.
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F5" },
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
  ],
};

/**
 * next/font emits self-hosted woff2 files, but this Next build injects no
 * <link rel="preload" as="font"> for them (audit F9) and offers no config
 * flag to turn injection on — so the links are hand-rolled from the build's
 * font manifest (never hardcoded hashes). Best-effort by design: a missing
 * or unreadable manifest simply yields no preload links, which is exactly
 * the status quo. The ?dpl asset suffix (skew protection) is mirrored from
 * the same global Next uses so preload URLs match the CSS's font URLs.
 */
let cachedFontPreloadHrefs: string[] | null = null;

function fontPreloadHrefs(): string[] {
  if (cachedFontPreloadHrefs) return cachedFontPreloadHrefs;
  const assetSuffix =
    (globalThis as { NEXT_CLIENT_ASSET_SUFFIX?: string }).NEXT_CLIENT_ASSET_SUFFIX ?? "";
  for (const manifestPath of [
    // Production / standalone server bundle, then `next dev`.
    join(process.cwd(), ".next", "server", "next-font-manifest.json"),
    join(process.cwd(), ".next", "dev", "server", "next-font-manifest.json"),
  ]) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        app?: Record<string, string[]>;
      };
      const files = new Set<string>();
      for (const perRoute of Object.values(manifest.app ?? {})) {
        for (const file of perRoute) {
          if (file.endsWith(".woff2")) files.add(file);
        }
      }
      if (files.size > 0) {
        cachedFontPreloadHrefs = [...files]
          .sort()
          .map((file) => `/_next/${file}${assetSuffix}`);
        return cachedFontPreloadHrefs;
      }
    } catch {
      // Try the next candidate path; fall through to no preloads.
    }
  }
  cachedFontPreloadHrefs = [];
  return cachedFontPreloadHrefs;
}

/** Applies the saved/system theme before first paint to avoid a flash. */
const themeInitScript = `(function(){try{var t=localStorage.getItem("cw-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${archivo.variable} h-full`}
    >
      <head>
        {fontPreloadHrefs().map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-news bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <DemoBanner />
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
