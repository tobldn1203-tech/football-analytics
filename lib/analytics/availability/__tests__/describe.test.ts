import { describe, expect, it } from "vitest";
import { describeAvailabilityDetail, formatAvailabilityContext } from "../describe";
import type { PlayerAvailability } from "../types";

function mk(overrides: Partial<PlayerAvailability>): PlayerAvailability {
  return {
    state: "unavailable",
    category: "injury",
    label: "Injured",
    detail: null,
    chanceOfPlayingNextRound: null,
    updatedAt: null,
    sourceName: "Fantasy Premier League",
    ...overrides,
  };
}

describe("describeAvailabilityDetail", () => {
  it("splits an injury with an unknown return date — real FPL text", () => {
    const result = describeAvailabilityDetail(mk({ category: "injury", detail: "Groin injury - Unknown return date" }));
    expect(result).toEqual({ reason: "Groin injury", timeframe: "return date unknown" });
  });

  it("splits an injury with a genuine expected return date — real FPL text, shown verbatim", () => {
    const result = describeAvailabilityDetail(mk({ category: "injury", detail: "Hamstring injury - Expected back 11 Oct" }));
    expect(result).toEqual({ reason: "Hamstring injury", timeframe: "expected back 11 Oct" });
  });

  it("splits a doubtful entry's percentage, scoped to 'next match' — real FPL text", () => {
    const result = describeAvailabilityDetail(mk({ category: "availability", state: "doubtful", detail: "Thigh injury - 75% chance of playing" }));
    expect(result).toEqual({ reason: "Thigh injury", timeframe: "75% chance of playing next match" });
  });

  it("never splits a suspension — already one complete, safe clause", () => {
    const result = describeAvailabilityDetail(mk({ category: "suspension", label: "Suspended", detail: "Suspended until 19 Sep" }));
    expect(result).toEqual({ reason: null, timeframe: null });
  });

  it("never splits a transfer — already one complete, safe clause", () => {
    const result = describeAvailabilityDetail(mk({ category: "transfer", label: "No longer at the club", detail: "Has joined Paris Saint-Germain permanently" }));
    expect(result).toEqual({ reason: null, timeframe: null });
  });

  it("returns nulls when there is no detail at all (stale/missing)", () => {
    expect(describeAvailabilityDetail(mk({ detail: null }))).toEqual({ reason: null, timeframe: null });
  });

  it("shows an unrecognised shape verbatim as the reason, rather than guessing a split", () => {
    const result = describeAvailabilityDetail(mk({ category: "injury", detail: "Some future FPL phrasing with no dash" }));
    expect(result).toEqual({ reason: "Some future FPL phrasing with no dash", timeframe: null });
  });
});

describe("formatAvailabilityContext", () => {
  it("reason + timeframe joined with a middle dot", () => {
    expect(formatAvailabilityContext(mk({ category: "availability", state: "doubtful", detail: "Hamstring injury - 75% chance of playing" }))).toBe(
      "Hamstring injury · 75% chance of playing next match"
    );
  });

  it("suspension falls back to the existing dedup-aware label/detail combination", () => {
    expect(formatAvailabilityContext(mk({ category: "suspension", label: "Suspended", detail: "Suspended until 19 Sep" }))).toBe("Suspended until 19 Sep");
  });

  it("transfer falls back to the existing label/detail combination", () => {
    expect(
      formatAvailabilityContext(mk({ category: "transfer", label: "No longer at the club", detail: "Has joined Paris Saint-Germain permanently" }))
    ).toBe("No longer at the club — Has joined Paris Saint-Germain permanently");
  });

  it("falls back to the bare label when there's no detail at all", () => {
    expect(formatAvailabilityContext(mk({ label: "Injured", detail: null }))).toBe("Injured");
  });
});
