import { Search } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { IS_STATIC_SITE } from "@/lib/site-mode";
import { MastheadDate } from "./MastheadDate";
import { MobileMenu } from "./MobileMenu";
import { NavBar } from "./NavBar";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/** Multi-level news header: utility bar, brand masthead, sticky primary nav. */
export function Header() {
  return (
    <header>
      {/* Utility bar */}
      <div className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between px-4 py-1.5 sm:px-6">
          {/* Client Component so statically prerendered pages show the
              viewer's current date, not the build day. */}
          <MastheadDate />
          <div className="flex items-center gap-1">
            {/* The static site (GitHub Pages) has no /latest, /top-100 or
                /search — they need a server. Linking them would put a 404 in
                the chrome of every page. */}
            {IS_STATIC_SITE ? (
              <Link
                href="/articles"
                className="rounded-news px-2 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
              >
                Latest articles
              </Link>
            ) : (
              <>
                <Link
                  href="/latest"
                  className="rounded-news px-2 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
                >
                  Latest
                </Link>
                <Link
                  href="/top-100"
                  className="rounded-news px-2 py-2 text-xs font-semibold text-muted transition-colors hover:text-ink"
                >
                  Top 100
                </Link>
                <Link
                  href="/search"
                  aria-label="Search"
                  className="flex h-11 w-11 items-center justify-center rounded-news text-muted transition-colors hover:bg-wash hover:text-ink"
                >
                  <Search className="h-4 w-4" aria-hidden />
                </Link>
              </>
            )}
            <ThemeToggle />
            <MobileMenu />
          </div>
        </div>
      </div>

      {/* Brand masthead */}
      <div className="bg-paper">
        <div className="mx-auto flex max-w-[1360px] flex-col items-start gap-1 px-4 py-4 sm:px-6 md:py-5">
          <Link href="/" aria-label={`${siteConfig.name} home`}>
            <Wordmark className="h-7 md:h-9" />
          </Link>
          <p className="text-xs text-muted md:text-sm">{siteConfig.tagline}</p>
        </div>
      </div>

      <NavBar />
    </header>
  );
}
