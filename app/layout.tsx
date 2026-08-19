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

/*
 * Do NOT hand-roll <link rel="preload" as="font"> here. next/font injects one
 * per preloaded subset by itself: "Fonts specified via `subsets` will have a
 * link preload tag injected into the head when the `preload` option is true,
 * which is the default", and a font called in the root layout "is preloaded on
 * all routes" (node_modules/next/dist/docs/01-app/03-api-reference/
 * 02-components/font.md — `subsets`, `preload`, "Preloading").
 *
 * Audit F9 claimed this build emitted none and added a manifest-reading block.
 * Measured live 2026-08-19 on the homepage: the head carried FOUR font preloads
 * for TWO files — Next's two plus that block's duplicates. The block is gone;
 * scripts/seo-health.mjs now fails if the live count drops below two or any
 * href repeats, so a real regression stays visible.
 */

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
