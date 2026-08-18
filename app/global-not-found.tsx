import Link from "next/link";
import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

/**
 * Global 404 for unmatched URLs (experimental.globalNotFound, audit F4).
 * The previous behavior shipped an empty <body> that only filled in
 * client-side — blank for crawlers and no-JS visitors. This file bypasses
 * the root layout entirely, so it must be a full HTML document and restate
 * the fonts, global styles and theme script itself. Route-level notFound()
 * calls still render app/not-found.tsx inside the normal layout.
 */

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
  title: `Page not found | ${siteConfig.name}`,
  // Next injects noindex for 404 responses; stated anyway for parity with
  // app/not-found.tsx.
  robots: { index: false, follow: false },
};

/** Same pre-paint theme script as the root layout — no flash on 404s. */
const themeInitScript = `(function(){try{var t=localStorage.getItem("cw-theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function GlobalNotFound() {
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
        {/* No router mounts outside the root layout, so plain anchors. */}
        <header className="border-b border-rule">
          <div className="mx-auto max-w-[1100px] px-4 py-4 sm:px-6">
            <Link href="/" className="headline text-xl">
              Current<span className="text-brand-ink">Wire</span>
            </Link>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto flex max-w-[700px] flex-col items-start px-4 py-24 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-ink">
              404
            </p>
            <h1 className="headline mt-2 text-3xl sm:text-5xl">
              This story couldn’t be found.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
              It may have moved, expired, or been removed from the CurrentWire
              index. News moves fast — the story you’re looking for may simply
              have aged out of the current window.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/"
                className="bg-ink px-5 py-3 text-sm font-bold text-paper transition-colors hover:bg-brand hover:text-white"
              >
                Go to Top Stories
              </Link>
              <Link
                href="/search"
                className="border border-ink px-5 py-3 text-sm font-bold transition-colors hover:border-brand hover:text-brand-ink dark:border-rule-strong"
              >
                Search CurrentWire
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
