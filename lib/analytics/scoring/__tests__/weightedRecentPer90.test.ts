import { describe, expect, it } from "vitest";
import { weightedRecentPer90 } from "../provisional";

describe("weightedRecentPer90", () => {
  it("returns 0 for an empty log", () => {
    expect(weightedRecentPer90([])).toBe(0);
  });

  it("returns the per-90 rate for a single full match", () => {
    expect(weightedRecentPer90([{ minutes: 90, bps: 30 }])).toBeCloseTo(30, 5);
  });

  it("weights the most recent match more heavily than older ones", () => {
    // Same two values, opposite order — the higher one should dominate more
    // when it's first (most recent).
    const recentHigh = weightedRecentPer90([
      { minutes: 90, bps: 40 },
      { minutes: 90, bps: 10 },
    ]);
    const recentLow = weightedRecentPer90([
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 40 },
    ]);
    expect(recentHigh).toBeGreaterThan(recentLow);
  });

  it("only considers as many matches as there are weights", () => {
    const withExtra = weightedRecentPer90([
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 1000 }, // 6th match, beyond the default 5 weights
    ]);
    expect(withExtra).toBeCloseTo(10, 5);
  });

  it("ignores zero-minute entries without dividing by zero", () => {
    expect(weightedRecentPer90([{ minutes: 0, bps: 0 }])).toBe(0);
  });
});
