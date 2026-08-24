import { describe, expect, it } from "vitest";
import { computeMomentum } from "../momentum";

describe("computeMomentum", () => {
  it("is unavailable with no matches", () => {
    const result = computeMomentum([]);
    expect(result.available).toBe(false);
    expect(result.direction).toBe("STABLE");
  });

  it("is unavailable with only one match played", () => {
    const result = computeMomentum([{ minutes: 90, bps: 30 }]);
    expect(result.available).toBe(false);
  });

  it("is unavailable when there isn't a genuine 'before' to compare against", () => {
    // Exactly 3 matches — all inside the recent window, so there is no
    // distinct earlier baseline to compare against.
    const result = computeMomentum([
      { minutes: 90, bps: 30 },
      { minutes: 90, bps: 30 },
      { minutes: 90, bps: 30 },
    ]);
    expect(result.available).toBe(false);
  });

  it("detects rising form", () => {
    const result = computeMomentum([
      { minutes: 90, bps: 40 }, // recent 3, high
      { minutes: 90, bps: 38 },
      { minutes: 90, bps: 42 },
      { minutes: 90, bps: 10 }, // earlier matches, low
      { minutes: 90, bps: 8 },
    ]);
    expect(result.available).toBe(true);
    expect(result.direction).toBe("RISING");
    expect(result.magnitude).toBeGreaterThan(0);
  });

  it("detects falling form", () => {
    const result = computeMomentum([
      { minutes: 90, bps: 5 },
      { minutes: 90, bps: 6 },
      { minutes: 90, bps: 4 },
      { minutes: 90, bps: 35 },
      { minutes: 90, bps: 38 },
    ]);
    expect(result.direction).toBe("FALLING");
    expect(result.magnitude).toBeLessThan(0);
  });

  it("treats small fluctuations as stable", () => {
    const result = computeMomentum([
      { minutes: 90, bps: 21 },
      { minutes: 90, bps: 19 },
      { minutes: 90, bps: 20 },
      { minutes: 90, bps: 20 },
      { minutes: 90, bps: 21 },
    ]);
    expect(result.direction).toBe("STABLE");
  });

  it("ignores very low-minute cameos when judging the trend", () => {
    const result = computeMomentum([
      { minutes: 3, bps: 15 }, // noise, should be excluded
      { minutes: 90, bps: 20 },
      { minutes: 90, bps: 19 },
      { minutes: 90, bps: 21 },
      { minutes: 90, bps: 20 },
    ]);
    expect(result.direction).toBe("STABLE");
  });
});
