import { describe, expect, it } from "vitest";
import { percentileRank } from "../percentile";

describe("percentileRank", () => {
  it("returns 100 for a single value", () => {
    expect(percentileRank([5])).toEqual([50]);
  });

  it("returns an empty array for no values", () => {
    expect(percentileRank([])).toEqual([]);
  });

  it("ranks the lowest value 0 and the highest 100", () => {
    const result = percentileRank([1, 2, 3]);
    expect(result[0]).toBe(0);
    expect(result[2]).toBe(100);
    expect(result[1]).toBe(50);
  });

  it("gives tied values the same percentile", () => {
    const result = percentileRank([1, 5, 5, 10]);
    expect(result[1]).toBe(result[2]);
  });

  it("is order-preserving relative to input, not sorted output", () => {
    const result = percentileRank([10, 1, 5]);
    expect(result[0]).toBe(100); // 10 is the max
    expect(result[1]).toBe(0); // 1 is the min
    expect(result[2]).toBe(50); // 5 is the middle
  });
});
