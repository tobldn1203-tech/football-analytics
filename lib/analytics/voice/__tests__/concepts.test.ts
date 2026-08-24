import { describe, expect, it } from "vitest";
import { CONCEPT_CATALOGUE } from "../concepts";

describe("CONCEPT_CATALOGUE", () => {
  it("gives every concept a meaning and a list of required context", () => {
    for (const c of CONCEPT_CATALOGUE) {
      expect(c.meaning.length).toBeGreaterThan(0);
      expect(c.requiresContext.length).toBeGreaterThan(0);
    }
  });

  it("names a mechanism for every implemented concept, and none for unimplemented ones", () => {
    for (const c of CONCEPT_CATALOGUE) {
      if (c.implemented) {
        expect(c.mechanism).toBeTruthy();
      } else {
        expect(c.mechanism).toBeUndefined();
      }
    }
  });

  it("has no duplicate concept keys", () => {
    const keys = CONCEPT_CATALOGUE.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("currently implements exactly the concepts this session built (PLOT_ARMOUR, STOCKS_RISING, STOCKS_FALLING) — everything else is honestly deferred", () => {
    const implemented = CONCEPT_CATALOGUE.filter((c) => c.implemented).map((c) => c.key).sort();
    expect(implemented).toEqual(["PLOT_ARMOUR", "STOCKS_FALLING", "STOCKS_RISING"]);
  });
});
