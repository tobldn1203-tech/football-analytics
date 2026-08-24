import { describe, expect, it } from "vitest";
import { describeTrend, directionFromScoreDelta } from "../trend";

describe("describeTrend", () => {
  it("reports steady with fewer than 2 values", () => {
    expect(describeTrend([]).direction).toBe("steady");
    expect(describeTrend([10]).direction).toBe("steady");
  });

  it("detects an upward trend", () => {
    expect(describeTrend([10, 10, 30, 30]).direction).toBe("up");
  });

  it("detects a downward trend", () => {
    expect(describeTrend([30, 30, 10, 10]).direction).toBe("down");
  });

  it("treats small fluctuations as steady", () => {
    expect(describeTrend([20, 21, 19, 20]).direction).toBe("steady");
  });
});

describe("directionFromScoreDelta", () => {
  it("classifies a meaningful positive delta as up", () => {
    expect(directionFromScoreDelta(1.2)).toBe("up");
  });
  it("classifies a meaningful negative delta as down", () => {
    expect(directionFromScoreDelta(-1.2)).toBe("down");
  });
  it("classifies a small delta as steady", () => {
    expect(directionFromScoreDelta(0.1)).toBe("steady");
  });
});
