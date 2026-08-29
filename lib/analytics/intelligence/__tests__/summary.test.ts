import { describe, expect, it } from "vitest";
import { buildPlayerIntelligence } from "../summary";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import type { MatchLogEntry } from "@/lib/analytics/scoring/provisional";

function makePlayer(overrides: Partial<RankedPlayer> = {}): RankedPlayer {
  return {
    playerId: "1",
    slug: "lewis-hall",
    name: "Lewis Hall",
    teamId: "team-new",
    teamShortName: "NEW",
    position: "DEF",
    sample: { matches: 10, minutes: 900, confidence: "established" },
    scores: { overall: 8.6, form: 9.1, attack: 3.0, creation: 4.0, defence: 9.0, impact: 7.5 },
    qualityLabel: "Excellent",
    photoUrl: null,
    teamCrestUrl: null,
    ...overrides,
  };
}

const STEADY_LOG: MatchLogEntry[] = [
  { minutes: 90, bps: 32 },
  { minutes: 90, bps: 30 },
  { minutes: 90, bps: 31 },
  { minutes: 90, bps: 29 },
];

describe("buildPlayerIntelligence", () => {
  it("assembles every field for an established player", () => {
    const intel = buildPlayerIntelligence(makePlayer(), STEADY_LOG, "Newcastle United");
    expect(intel.performance.score).toBe(8.6);
    expect(intel.performance.label).toBe("Excellent");
    expect(intel.form.score).toBe(9.1);
    expect(intel.confidence).toBe("Established");
    expect(intel.consistency.available).toBe(true);
    expect(intel.momentum.available).toBe(true);
    expect(intel.summary).toContain("Lewis Hall");
    expect(intel.summary).toContain("Newcastle United");
  });

  it("mentions the primary strength in the summary when one exists", () => {
    const intel = buildPlayerIntelligence(makePlayer(), STEADY_LOG, "Newcastle United");
    expect(intel.primaryStrengths[0]?.key).toBe("defence");
    expect(intel.summary.toLowerCase()).toContain("defensive");
  });

  it("falls back to team short name when no full name is supplied", () => {
    const intel = buildPlayerIntelligence(makePlayer(), STEADY_LOG);
    expect(intel.summary).toContain("NEW");
  });

  it("produces an honest, humble summary for a one-match sample instead of a confident verdict", () => {
    const player = makePlayer({
      sample: { matches: 1, minutes: 90, confidence: "low" },
      scores: { overall: 9.5, form: 9.5, attack: 9, creation: 9, defence: 9, impact: 9 },
    });
    const intel = buildPlayerIntelligence(player, [{ minutes: 90, bps: 40 }]);
    expect(intel.confidence).toBe("Limited");
    expect(intel.summary).toMatch(/early|so far/i);
    expect(intel.developmentAreas).toHaveLength(0);
    // Same confidence gate now applies to strengths, not just development
    // areas — see docs/PERFORMANCE_INTELLIGENCE_AUDIT.md §3.1.
    expect(intel.primaryStrengths).toHaveLength(0);
  });

  it("never throws for a player with no match log at all", () => {
    expect(() => buildPlayerIntelligence(makePlayer({ sample: { matches: 0, minutes: 0, confidence: "low" } }), [])).not.toThrow();
  });

  it("handles a goalkeeper profile (defence/impact only, no attack/creation)", () => {
    const gk = makePlayer({
      position: "GKP",
      scores: { overall: 7.8, form: 8.0, attack: 0, creation: 0, defence: 8.5, impact: 7.0 },
    });
    const intel = buildPlayerIntelligence(gk, STEADY_LOG, "Everton");
    expect(intel.primaryStrengths.every((s) => s.key !== "attack" && s.key !== "creation")).toBe(true);
  });

  it("reflects an unusually low performance honestly", () => {
    const player = makePlayer({
      scores: { overall: 1.2, form: 1.0, attack: 0.5, creation: 0.5, defence: 1.5, impact: 1.0 },
    });
    const intel = buildPlayerIntelligence(player, STEADY_LOG, "Some Club");
    expect(intel.performance.label).toBe("Below average");
    expect(intel.summary).not.toMatch(/excellent|elite/i);
  });
});
