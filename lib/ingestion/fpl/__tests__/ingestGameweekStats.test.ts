import { describe, expect, it } from "vitest";
import { FplEventLiveElementSchema } from "@/lib/providers/fpl/types";
import { mapDefensiveFields } from "../ingestGameweekStats";

/**
 * Covers the defensive-action component enrichment added in
 * docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md §9 — parsing the three new
 * fields (tackles, clearances_blocks_interceptions, recoveries) from FPL's
 * live-gameweek payload, and confirming the existing combined
 * `defensiveActions` value is untouched by their addition.
 */
describe("FplEventLiveElementSchema — defensive component parsing", () => {
  const baseStats = {
    minutes: 90,
    expected_goals: "0.10",
    expected_assists: "0.20",
    expected_goals_conceded: "1.33",
    ict_index: "5.7",
  };

  it("parses tackles, clearances_blocks_interceptions and recoveries when present", () => {
    const parsed = FplEventLiveElementSchema.parse({
      id: 200,
      stats: {
        ...baseStats,
        defensive_contribution: 12,
        tackles: 5,
        clearances_blocks_interceptions: 7,
        recoveries: 2,
      },
    });

    expect(parsed.stats.tackles).toBe(5);
    expect(parsed.stats.clearances_blocks_interceptions).toBe(7);
    expect(parsed.stats.recoveries).toBe(2);
    // The existing combined field must remain exactly as before.
    expect(parsed.stats.defensive_contribution).toBe(12);
  });

  it("defaults missing component fields to 0, the same convention already used for defensive_contribution", () => {
    const parsed = FplEventLiveElementSchema.parse({
      id: 201,
      stats: {
        ...baseStats,
        // defensive_contribution, tackles, clearances_blocks_interceptions,
        // recoveries all omitted — simulating a provider payload gap.
      },
    });

    expect(parsed.stats.defensive_contribution).toBe(0);
    expect(parsed.stats.tackles).toBe(0);
    expect(parsed.stats.clearances_blocks_interceptions).toBe(0);
    expect(parsed.stats.recoveries).toBe(0);
  });
});

describe("mapDefensiveFields", () => {
  const stats = FplEventLiveElementSchema.shape.stats.parse({
    minutes: 90,
    expected_goals: "0",
    expected_assists: "0.20",
    expected_goals_conceded: "1.33",
    ict_index: "5.7",
    defensive_contribution: 12,
    tackles: 5,
    clearances_blocks_interceptions: 7,
    recoveries: 2,
  });

  it("maps each component to its own field, alongside the unchanged combined value", () => {
    expect(mapDefensiveFields(stats)).toEqual({
      defensiveActions: 12,
      tackles: 5,
      clearancesBlocksInterceptions: 7,
      recoveries: 2,
    });
  });

  it("does not alter defensiveActions when the components are added", () => {
    // Same defensive_contribution, components present vs a payload without
    // them — the combined figure must be identical either way.
    const withComponents = mapDefensiveFields(stats);
    const withoutComponents = mapDefensiveFields(
      FplEventLiveElementSchema.shape.stats.parse({
        minutes: 90,
        expected_goals: "0",
        expected_assists: "0.20",
        expected_goals_conceded: "1.33",
        ict_index: "5.7",
        defensive_contribution: 12,
      })
    );
    expect(withComponents.defensiveActions).toBe(withoutComponents.defensiveActions);
  });
});
