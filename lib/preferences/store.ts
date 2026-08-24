import { DEFAULT_PREFERENCES, type UserPreferences } from "./types";

/**
 * The storage layer for preferences — localStorage today, deliberately
 * hidden behind this module so nothing else in the app needs to know that.
 * A future authenticated-account version replaces only `read`/`write`
 * (swap localStorage for an API call) — every function below and every
 * caller stays exactly the same. See lib/preferences/usePreferences.ts for
 * the React-facing hook built on top of this.
 */

const STORAGE_KEY = "pl-analytics:preferences:v2";

let cache: UserPreferences | null = null;
const listeners = new Set<() => void>();

function read(): UserPreferences {
  // Cache first, regardless of environment — internally consistent both in
  // a real browser (avoids re-parsing on every call) and in a Node test
  // environment with no `window` at all (see lib/preferences/__tests__).
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  let result: UserPreferences;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    result = raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    // Private browsing / storage disabled — degrade to in-memory-only for this tab.
    result = DEFAULT_PREFERENCES;
  }
  cache = result;
  return result;
}

function write(next: UserPreferences): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Same degrade-gracefully rule as read() — preferences just won't survive a refresh.
  }
  listeners.forEach((l) => l());
}

export function getUserPreferences(): UserPreferences {
  return read();
}

export function getSupportedClub(): string | null {
  return read().supportedClubId;
}

export function setSupportedClub(teamId: string): void {
  write({ ...read(), supportedClubId: teamId, promptDismissed: true });
}

export function clearSupportedClub(): void {
  write({ ...read(), supportedClubId: null });
}

/** "Skip for now" — dismisses the prompt without picking a club. */
export function dismissPrompt(): void {
  write({ ...read(), promptDismissed: true });
}

/** Testing/debug use only — not exposed in any UI. */
export function resetPreferences(): void {
  write(DEFAULT_PREFERENCES);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): UserPreferences {
  return read();
}

/** React's hydration-safe "what to render before the client has mounted" value. */
export function getServerSnapshot(): UserPreferences {
  return DEFAULT_PREFERENCES;
}
