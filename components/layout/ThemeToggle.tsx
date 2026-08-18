"use client";

import { Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Dark-mode toggle. Persists to localStorage; falls back to system setting.
 * Which icon shows is driven purely by CSS (dark:) so there is no state to
 * hydrate and no mismatch flash. aria-pressed IS state, so it starts false on
 * the server and syncs from the <html> class after hydration — screen readers
 * get the real value without a hydration mismatch.
 */
const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function ThemeToggle() {
  // aria-pressed IS state: server snapshot false, client snapshot reads the
  // <html> class; toggle() notifies subscribers so the store re-reads.
  const isDark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    for (const listener of themeListeners) listener();
    try {
      localStorage.setItem("cw-theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable (private mode) — theme still applies for the session.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={isDark}
      className="flex h-11 w-11 items-center justify-center rounded-news text-muted transition-colors hover:bg-wash hover:text-ink"
    >
      <Moon className="block h-4 w-4 dark:hidden" aria-hidden />
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
    </button>
  );
}
