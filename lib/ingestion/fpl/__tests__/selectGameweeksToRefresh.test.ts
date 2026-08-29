import { describe, expect, it } from "vitest";
import { GAMEWEEK_REFRESH_WINDOW, selectGameweeksToRefresh } from "../selectGameweeksToRefresh";

describe("selectGameweeksToRefresh", () => {
  it("returns everything when there are fewer finished gameweeks than the window", () => {
    expect(selectGameweeksToRefresh([1])).toEqual([1]);
    expect(selectGameweeksToRefresh([1, 2])).toEqual([2, 1]);
  });

  it("bounds to the window even with many finished gameweeks — the real GW38 case", () => {
    const allFinished = Array.from({ length: 38 }, (_, i) => i + 1); // 1..38
    const result = selectGameweeksToRefresh(allFinished);
    expect(result).toHaveLength(GAMEWEEK_REFRESH_WINDOW);
    expect(result).toEqual([38, 37]); // only the most recent, never gameweek 1
  });

  it("is order-independent — the input isn't assumed sorted", () => {
    expect(selectGameweeksToRefresh([5, 1, 3, 2, 4])).toEqual([5, 4]);
  });

  it("de-duplicates before windowing", () => {
    expect(selectGameweeksToRefresh([3, 3, 3, 2, 1])).toEqual([3, 2]);
  });

  it("returns an empty array for no finished gameweeks (season not started)", () => {
    expect(selectGameweeksToRefresh([])).toEqual([]);
  });
});
