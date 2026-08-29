import { describe, expect, it } from "vitest";
import { detectStrengths } from "../strengths";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";

function makePlayer(
  scores: Partial<RankedPlayer["scores"]>,
  confidence: RankedPlayer["sample"]["confidence"] = "established"
): RankedPlayer {
  return {
    playerId: "1",
    slug: "player",
    name: "Player",
    teamId: "team-tma",
    teamShortName: "TMA",
    position: "MID",
    sample: { matches: 10, minutes: 900, confidence },
    scores,
    qualityLabel: "Good",
    photoUrl: null,
    teamCrestUrl: null,
  };
}

describe("detectStrengths", () => {
  it("identifies a clear defensive strength for a defender", () => {
    const player = makePlayer({ attack: 2.0, creation: 2.5, defence: 9.1, impact: 6.0 });
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths[0]?.key).toBe("defence");
  });

  it("identifies a clear attacking strength for a forward", () => {
    const player = makePlayer({ attack: 9.4, creation: 6.0, defence: 1.0, impact: 8.0 });
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths[0]?.key).toBe("attack");
  });

  it("returns no strengths when nothing clears the threshold", () => {
    const player = makePlayer({ attack: 3.0, creation: 3.5, defence: 4.5, impact: 4.0 });
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths).toHaveLength(0);
  });

  it("caps strengths at two, ranked by score", () => {
    const player = makePlayer({ attack: 9.0, creation: 8.5, defence: 7.0, impact: 6.0 });
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths).toHaveLength(2);
    expect(primaryStrengths.map((s) => s.key)).toEqual(["attack", "creation"]);
  });

  it("does not report development areas for a low-confidence (small sample) player", () => {
    const player = makePlayer({ attack: 1.0, creation: 1.0, defence: 1.0, impact: 1.0 }, "low");
    const { developmentAreas } = detectStrengths(player, { allowDevelopmentAreas: false });
    expect(developmentAreas).toHaveLength(0);
  });

  it("does report development areas once confidence is established", () => {
    const player = makePlayer({ attack: 1.0, creation: 8.0, defence: 7.5, impact: 6.5 }, "established");
    const { developmentAreas } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(developmentAreas.map((a) => a.key)).toContain("attack");
  });

  it("uses gentle framing labels, never the word 'weakness'", () => {
    const player = makePlayer({ attack: 1.0, creation: 8.0, defence: 7.5, impact: 6.5 }, "established");
    const { developmentAreas } = detectStrengths(player, { allowDevelopmentAreas: true });
    for (const area of developmentAreas) {
      expect(area.label.toLowerCase()).not.toContain("weak");
      expect(area.label.toLowerCase()).not.toContain("bad");
      expect(area.label.toLowerCase()).not.toContain("poor");
    }
  });

  it("handles missing/undefined category scores without throwing", () => {
    const player = makePlayer({ attack: undefined, creation: 8.0 });
    expect(() => detectStrengths(player, { allowDevelopmentAreas: true })).not.toThrow();
  });

  // --- Confidence gating on primaryStrengths (docs/PERFORMANCE_INTELLIGENCE_AUDIT.md §3.1) ---

  it("reports no primary strengths at Limited confidence, however high the scores", () => {
    // De Cuyper-shaped case: a defender, one match, elite-looking category scores.
    const player = makePlayer({ attack: 9.7, creation: 9.2, defence: 6.0, impact: 9.8 }, "low");
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: false });
    expect(primaryStrengths).toHaveLength(0);
  });

  it("does not mutate the underlying scores when suppressing strengths at Limited confidence", () => {
    const scores = { attack: 9.7, creation: 9.2, defence: 6.0, impact: 9.8 };
    const player = makePlayer({ ...scores }, "low");
    detectStrengths(player, { allowDevelopmentAreas: false });
    expect(player.scores).toEqual(scores);
  });

  it("restores primary strengths once confidence reaches Developing", () => {
    const player = makePlayer({ attack: 2.0, creation: 2.5, defence: 9.1, impact: 6.0 }, "moderate");
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths.length).toBeGreaterThan(0);
    expect(primaryStrengths[0]?.key).toBe("defence");
  });

  it("reports primary strengths normally at Established confidence", () => {
    const player = makePlayer({ attack: 2.0, creation: 2.5, defence: 9.1, impact: 6.0 }, "established");
    const { primaryStrengths } = detectStrengths(player, { allowDevelopmentAreas: true });
    expect(primaryStrengths[0]?.key).toBe("defence");
  });

  it("stays safe with missing scores at Limited confidence (no throw, no strengths)", () => {
    const player = makePlayer({ attack: undefined, creation: undefined }, "low");
    expect(() => detectStrengths(player, { allowDevelopmentAreas: false })).not.toThrow();
    const { primaryStrengths, developmentAreas } = detectStrengths(player, { allowDevelopmentAreas: false });
    expect(primaryStrengths).toHaveLength(0);
    expect(developmentAreas).toHaveLength(0);
  });
});
