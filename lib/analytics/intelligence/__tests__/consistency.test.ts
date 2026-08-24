import { describe, expect, it } from "vitest";
import { computeConsistency } from "../consistency";

describe("computeConsistency", () => {
  it("is unavailable with no matches", () => {
    const result = computeConsistency([]);
    expect(result.available).toBe(false);
    expect(result.score).toBeNull();
  });

  it("is unavailable with only one match (edge case: single match played)", () => {
    const result = computeConsistency([{ minutes: 90, bps: 30 }]);
    expect(result.available).toBe(false);
    expect(result.label).toBe("Not enough data yet");
  });

  it("excludes very low-minute cameos from the qualifying sample", () => {
    // Three real matches plus two 5-minute cameos with wild extrapolated
    // rates — the cameos should not be enough to flip this into "available"
    // territory with skewed numbers, nor should they count as qualifying.
    const result = computeConsistency([
      { minutes: 5, bps: 20 }, // extrapolates to 360/90 — noise, must be excluded
      { minutes: 90, bps: 30 },
      { minutes: 90, bps: 28 },
      { minutes: 90, bps: 32 },
    ]);
    expect(result.matchesConsidered).toBe(3);
  });

  it("scores a genuinely steady player as highly consistent", () => {
    const result = computeConsistency([
      { minutes: 90, bps: 30 },
      { minutes: 90, bps: 29 },
      { minutes: 90, bps: 31 },
      { minutes: 90, bps: 30 },
    ]);
    expect(result.available).toBe(true);
    expect(result.score!).toBeGreaterThan(8);
    expect(result.label).toBe("High consistency");
  });

  it("scores a spectacular-then-anonymous player as highly variable", () => {
    const result = computeConsistency([
      { minutes: 90, bps: 45 },
      { minutes: 90, bps: 2 },
      { minutes: 90, bps: 40 },
      { minutes: 90, bps: 1 },
    ]);
    expect(result.available).toBe(true);
    expect(result.score!).toBeLessThan(4);
  });

  it("does not divide by zero when every qualifying match has zero contribution", () => {
    const result = computeConsistency([
      { minutes: 90, bps: 0 },
      { minutes: 90, bps: 0 },
      { minutes: 90, bps: 0 },
    ]);
    expect(result.available).toBe(true);
    expect(result.score).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it("rewards a consistently strong player, not just a consistently mediocre one", () => {
    // Two players, both perfectly steady — consistency should be identical
    // regardless of their performance LEVEL. Consistency is orthogonal to
    // how good the player is, by design.
    const strong = computeConsistency([
      { minutes: 90, bps: 40 },
      { minutes: 90, bps: 40 },
      { minutes: 90, bps: 40 },
    ]);
    const mediocre = computeConsistency([
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
      { minutes: 90, bps: 10 },
    ]);
    expect(strong.score).toBe(mediocre.score);
  });
});
