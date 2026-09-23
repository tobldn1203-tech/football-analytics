import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getStoredTheme, setStoredTheme, subscribe, resetStoredTheme, __simulateReloadForTests } from "../store";
import { THEME_STORAGE_KEY } from "../resolveTheme";

/**
 * This test environment is Node (vitest.config.mts), same as
 * lib/preferences/__tests__/store.test.ts — there is no real `window`. That
 * file deliberately only exercises the no-`window` degrade path; this one
 * additionally stands up a minimal in-memory localStorage + documentElement
 * so the real persistence round-trip (not just the fallback) gets covered —
 * the one behaviour this module adds that the preferences store doesn't
 * need: surviving a "reload" (cache cleared, storage intact).
 */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

let attrs: Record<string, string> = {};

beforeEach(() => {
  attrs = {};
  // @ts-expect-error — minimal test double, only what this module touches.
  globalThis.window = { localStorage: new MemoryStorage() };
  // @ts-expect-error — same, for applyThemeToDocument's setAttribute call.
  globalThis.document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  resetStoredTheme();
});

afterEach(() => {
  // @ts-expect-error
  delete globalThis.window;
  // @ts-expect-error
  delete globalThis.document;
});

describe("theme store", () => {
  it("1. no saved preference → dark", () => {
    expect(getStoredTheme()).toBe("dark");
  });

  it("2. saved dark → dark", () => {
    setStoredTheme("dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("3. saved light → light", () => {
    setStoredTheme("light");
    expect(getStoredTheme()).toBe("light");
  });

  it("setStoredTheme writes the raw value under the shared storage key", () => {
    setStoredTheme("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("setStoredTheme applies the choice to <html data-theme> immediately", () => {
    setStoredTheme("light");
    expect(attrs["data-theme"]).toBe("light");
    setStoredTheme("dark");
    expect(attrs["data-theme"]).toBe("dark");
  });

  it("7. reload preserves an explicit saved theme (cache cleared, storage intact)", () => {
    setStoredTheme("light");
    __simulateReloadForTests(); // new module instance would start with no in-memory cache
    expect(getStoredTheme()).toBe("light");
  });

  it("reload with no saved preference still resolves to dark, not a stale cached value", () => {
    expect(getStoredTheme()).toBe("dark");
    __simulateReloadForTests();
    expect(getStoredTheme()).toBe("dark");
  });

  it("notifies subscribers on every explicit change", () => {
    let calls = 0;
    const unsubscribe = subscribe(() => calls++);
    setStoredTheme("light");
    setStoredTheme("dark");
    unsubscribe();
    setStoredTheme("light"); // after unsubscribe — should not increment
    expect(calls).toBe(2);
  });

  it("degrades gracefully with no window at all (private browsing / SSR) — the same fallback lib/preferences/store.ts relies on", () => {
    // @ts-expect-error — simulate no window/localStorage
    delete globalThis.window;
    expect(getStoredTheme()).toBe("dark");
  });
});
