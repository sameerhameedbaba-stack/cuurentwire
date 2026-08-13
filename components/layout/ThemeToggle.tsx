"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Dark-mode toggle. Persists to localStorage; falls back to system setting.
 * Which icon shows is driven purely by CSS (dark:) so there is no state to
 * hydrate and no mismatch flash.
 */
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("cw-theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode) — theme still applies for the session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-news text-muted transition-colors hover:bg-wash hover:text-ink"
    >
      <Moon className="block h-4 w-4 dark:hidden" aria-hidden />
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
    </button>
  );
}
