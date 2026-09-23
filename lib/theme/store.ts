import { resolveTheme, THEME_STORAGE_KEY, type Theme } from "./resolveTheme";

/**
 * The storage layer for the explicit theme choice — localStorage, same
 * pattern as lib/preferences/store.ts (cache + graceful degrade in private
 * browsing), but deliberately a SEPARATE key and module: this one also has
 * to be readable from the pre-hydration blocking script in app/layout.tsx
 * (see its own comment) to avoid a flash of the wrong theme, which the
 * React-context-based preferences system was never built for and doesn't
 * need — a brief post-mount reconciliation is fine for "which club crest
 * shows", not for the whole page's colours.
 */

let cache: Theme | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Private browsing / storage disabled — no persisted choice this tab.
    return null;
  }
}

/** The resolved theme to use right now — dark unless an explicit "light" choice was saved. */
export function getStoredTheme(): Theme {
  if (cache) return cache;
  cache = resolveTheme(readRaw());
  return cache;
}

export function setStoredTheme(theme: Theme): void {
  cache = theme;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Same degrade-gracefully rule as readRaw() — the choice just won't survive a refresh.
    }
    applyThemeToDocument(theme);
  }
  listeners.forEach((l) => l());
}

/**
 * Writes the theme onto <html data-theme="..."> — the single DOM effect
 * every consumer of a theme change goes through, via this module's own
 * setStoredTheme. Not exported: the blocking inline script in
 * app/layout.tsx needs the same effect before any bundled module has
 * loaded, so it applies it via an inlined, plain-JS equivalent rather than
 * importing this — see that file's comment.
 */
function applyThemeToDocument(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Theme {
  return getStoredTheme();
}

/**
 * React's hydration-safe "what to render before the client has mounted"
 * value — always "dark", matching exactly what the server rendered (the
 * server has no localStorage, and the product default is dark), so there is
 * nothing for React to reconcile a mismatch on for the *initial* render.
 * The blocking script has usually already corrected the DOM attribute to
 * "light" by the time this ever gets called, for a returning light-mode
 * user — this snapshot is what React *thinks* the server rendered, not
 * what's currently in the DOM, and those are allowed to differ here
 * precisely because app/layout.tsx marks the element `suppressHydrationWarning`.
 */
export function getServerSnapshot(): Theme {
  return "dark";
}

/** Testing/debug use only — not exposed in any UI. */
export function resetStoredTheme(): void {
  cache = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Testing use only — clears just the in-memory cache, leaving whatever's on
 * disk untouched, to simulate "a fresh page load" (a new module instance
 * always starts with `cache = null`) without also erasing the persisted
 * value, the way `resetStoredTheme` deliberately does. Lets a test prove a
 * saved theme genuinely round-trips through storage rather than merely
 * surviving in memory for the rest of the test file.
 */
export function __simulateReloadForTests(): void {
  cache = null;
}

export type { Theme };
