import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Wordmark } from "./Wordmark";

const COLUMNS: { heading: string; links: readonly { label: string; href: string }[] }[] = [
  { heading: "News", links: siteConfig.navigation.footer.news },
  {
    heading: "Explore",
    // Archive is appended in code: it is the sitewide HTML crawl path into
    // the permanent story archive, shipped alongside these components rather
    // than the brand config.
    links: [
      ...siteConfig.navigation.footer.explore,
      { label: "Archive", href: "/archive" },
    ],
  },
  { heading: "CurrentWire", links: siteConfig.navigation.footer.company },
  { heading: "Legal", links: siteConfig.navigation.footer.legal },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-ink-deep text-white dark:border-t dark:border-rule">
      <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <div className="invert dark:invert-0">
              <Wordmark className="h-8" />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {siteConfig.footerTagline}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={`Footer — ${column.heading}`}>
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                  {column.heading}
                </h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/80 transition-colors hover:text-white hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-white/15 pt-6">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/45">
            {siteConfig.name} aggregates and summarizes reporting from
            third-party publishers. Copyright in linked original reporting
            belongs to the respective publishers.
          </p>
        </div>
      </div>
    </footer>
  );
}
