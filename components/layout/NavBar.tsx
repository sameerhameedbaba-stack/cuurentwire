"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

/**
 * Primary category navigation. Sticky below the masthead; horizontally
 * scrollable on smaller screens instead of wrapping or truncating.
 */
export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-40 border-y border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/90"
    >
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6">
        <ul className="scrollbar-none -mx-1 flex items-stretch gap-0.5 overflow-x-auto">
          {siteConfig.navigation.primary.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block whitespace-nowrap px-3 py-2.5 text-[0.8125rem] font-semibold tracking-wide transition-colors ${
                    active ? "text-brand-ink" : "text-ink hover:text-brand-ink"
                  }`}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand transition-transform duration-200 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
