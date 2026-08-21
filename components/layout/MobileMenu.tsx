"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";

/** Accessible mobile navigation drawer (native <dialog>, focus-trapped). */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-news text-ink hover:bg-wash"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Site navigation"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-paper text-ink backdrop:bg-black/50 open:animate-[section-in_200ms_ease]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <span className="font-display text-lg font-extrabold tracking-tight">
              {siteConfig.logoText}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-news hover:bg-wash"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="border-b border-rule px-4 py-3">
            <Link
              href="/search"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-news border border-rule bg-surface px-3 py-2.5 text-sm text-muted"
            >
              <Search className="h-4 w-4" aria-hidden />
              Search {siteConfig.name}
            </Link>
          </div>

          <nav aria-label="Mobile primary" className="flex-1 overflow-y-auto px-2 py-2">
            <ul>
              {siteConfig.navigation.primary.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-news px-3 py-3 text-base font-semibold hover:bg-wash"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-rule pt-2">
                <Link
                  href="/top-10"
                  onClick={() => setOpen(false)}
                  className="block rounded-news px-3 py-3 text-base font-bold text-brand-ink hover:bg-wash"
                >
                  Top 10 Today
                </Link>
              </li>
              <li>
                <Link
                  href="/top-100"
                  onClick={() => setOpen(false)}
                  className="block rounded-news px-3 py-3 text-base font-bold text-brand-ink hover:bg-wash"
                >
                  Top 100 Right Now
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </dialog>
    </div>
  );
}
