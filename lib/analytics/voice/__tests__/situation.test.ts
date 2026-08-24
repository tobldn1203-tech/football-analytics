import { describe, expect, it } from "vitest";
import { classifyResult, isCardHeavy, isHighScoring } from "../situation";

describe("classifyResult", () => {
  it("classifies a goalless draw distinctly from a scoring draw", () => {
    expect(classifyResult(0, 0)).toBe("goalless_draw");
    expect(classifyResult(2, 2)).toBe("draw");
  });
  it("classifies a 1-goal margin as narrow", () => {
    expect(classifyResult(2, 1)).toBe("narrow");
  });
  it("classifies a 2-3 goal margin as comfortable", () => {
    expect(classifyResult(3, 1)).toBe("comfortable");
    expect(classifyResult(3, 0)).toBe("comfortable");
  });
  it("classifies a 4+ goal margin as a rout", () => {
    expect(classifyResult(4, 0)).toBe("rout");
  });
});

describe("isCardHeavy / isHighScoring", () => {
  it("flags a heavy card count at the stated threshold", () => {
    expect(isCardHeavy(4)).toBe(false);
    expect(isCardHeavy(5)).toBe(true);
  });
  it("flags a high-scoring match at the stated threshold", () => {
    expect(isHighScoring(4)).toBe(false);
    expect(isHighScoring(5)).toBe(true);
  });
});
