/**
 * THEME RESOLUTION — the one place that decides light vs dark.
 * ==========================================================================
 * Deliberately a pure function with no `window`, no `matchMedia`, no
 * `prefers-color-scheme` — the application's theme default is DARK
 * (Floodlit is the product's intended visual identity), and the device's
 * OS/browser colour-scheme setting has no say in that default at all. The
 * only thing that can produce light mode is an explicit, previously-saved
 * user choice (see lib/theme/store.ts).
 *
 * This function's own signature is the enforcement mechanism: it cannot
 * consult system preference even by accident, because it has no parameter
 * to receive it through.
 */

export type Theme = "light" | "dark";

/** localStorage key for the raw stored preference — see lib/theme/store.ts. */
export const THEME_STORAGE_KEY = "pl-analytics:theme:v1";

/**
 * `stored` is whatever raw value was read back from storage — `null` when
 * nothing has ever been saved (a brand-new user, or a private/no-storage
 * session), otherwise whatever the last explicit choice was. Anything that
 * isn't exactly "light" is treated as "no explicit preference" rather than
 * throwing, since storage can hold arbitrary/corrupted data (an old key
 * format, a manually-edited value, a future value this build doesn't know
 * about yet) — falling back to the product default is the correct,
 * conservative behaviour for all of those, not just a missing key.
 */
export function resolveTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}
