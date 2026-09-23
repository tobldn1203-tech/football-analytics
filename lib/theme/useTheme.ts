"use client";

import { useCallback, useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot, setStoredTheme } from "./store";
import type { Theme } from "./resolveTheme";

/**
 * The one hook a component uses to read and change the theme. Same
 * `useSyncExternalStore` shape as lib/preferences/usePreferences.ts — the
 * initial render always matches `getServerSnapshot` ("dark"), then
 * reconciles to the real stored value immediately after mount. For a
 * returning light-mode user this means the toggle's own icon can, for one
 * frame, show the "dark" glyph before flipping to "light" — a small, purely
 * cosmetic reconciliation inside a tiny button, not the page-wide colour
 * flash the blocking script in app/layout.tsx exists to prevent (see that
 * file's comment); the same trade-off this codebase already accepts for
 * MyFootballNav's crest-vs-fallback icon.
 */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setStoredTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}
