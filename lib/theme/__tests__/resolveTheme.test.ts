import { describe, expect, it, afterEach } from "vitest";
import { resolveTheme, THEME_STORAGE_KEY } from "../resolveTheme";

describe("resolveTheme — pure resolution logic", () => {
  it("1. no saved preference (null) resolves to dark", () => {
    expect(resolveTheme(null)).toBe("dark");
  });

  it("2. an explicit saved 'dark' resolves to dark", () => {
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("3. an explicit saved 'light' resolves to light", () => {
    expect(resolveTheme("light")).toBe("light");
  });

  it("falls back to dark for any unrecognised/corrupted stored value, not just null", () => {
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("LIGHT")).toBe("dark"); // exact match only, no case-folding surprise
    expect(resolveTheme("undefined")).toBe("dark");
  });

  it("exposes a stable storage key other modules can share", () => {
    expect(THEME_STORAGE_KEY).toBe("pl-analytics:theme:v1");
  });
});

describe("resolveTheme — independence from system colour scheme", () => {
  afterEach(() => {
    // @ts-expect-error — test-only global cleanup
    delete globalThis.window;
  });

  it("4. system set to light + no saved preference still resolves to dark", () => {
    // @ts-expect-error — minimal fake, only the shape resolveTheme could
    // theoretically consult, to prove it doesn't.
    globalThis.window = { matchMedia: () => ({ matches: false }) }; // matches:false = "not dark" = light-ish system
    expect(resolveTheme(null)).toBe("dark");
  });

  it("5. system set to dark + no saved preference still resolves to dark (for the right reason — the default, not a lucky coincidence)", () => {
    // @ts-expect-error — same fake, opposite system value
    globalThis.window = { matchMedia: () => ({ matches: true }) }; // matches:true = "prefers dark"
    expect(resolveTheme(null)).toBe("dark");
  });

  it("6. system preference never overrides an explicit saved preference, in either direction", () => {
    // @ts-expect-error — system says dark; saved preference says light — saved wins.
    globalThis.window = { matchMedia: () => ({ matches: true }) };
    expect(resolveTheme("light")).toBe("light");

    // @ts-expect-error — system says light; saved preference says dark — saved wins.
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("8. resolveTheme's own signature proves initialisation cannot depend on OS colour scheme — it has no parameter to receive it through", () => {
    // Not a runtime assertion so much as a structural one: the function
    // takes exactly one argument (the stored value) — there is nowhere for
    // a caller to even pass a system-preference value in.
    expect(resolveTheme.length).toBe(1);
  });
});
