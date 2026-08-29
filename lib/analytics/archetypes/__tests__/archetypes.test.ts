import { describe, expect, it } from "vitest";
import { classifyArchetype } from "../archetypes";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";

function makePlayer(
  position: RankedPlayer["position"],
  scores: Partial<RankedPlayer["scores"]>,
  confidence: RankedPlayer["sample"]["confidence"] = "established"
): RankedPlayer {
  return {
    playerId: "1",
    slug: "player",
    name: "Player",
    teamId: "team-tma",
    teamShortName: "TMA",
    position,
    sample: { matches: confidence === "low" ? 1 : confidence === "moderate" ? 4 : 10, minutes: 900, confidence },
    scores,
    qualityLabel: "Good",
    photoUrl: null,
    teamCrestUrl: null,
  };
}

describe("classifyArchetype", () => {
  it("identifies a Creative Hub midfielder", () => {
    const player = makePlayer("MID", { attack: 3.0, creation: 8.5, defence: 3.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("creative_hub");
    expect(archetype.label).toBe("Creative Hub");
  });

  it("identifies a Box-to-Box midfielder when both attack and defence are elevated", () => {
    const player = makePlayer("MID", { attack: 6.5, creation: 4.0, defence: 6.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("box_to_box");
  });

  it("identifies a Ball-Winning Midfielder", () => {
    const player = makePlayer("MID", { attack: 2.5, creation: 3.0, defence: 8.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("ball_winning_midfielder");
  });

  it("identifies a Defensive Anchor defender", () => {
    const player = makePlayer("DEF", { attack: 1.0, creation: 1.5, defence: 8.5, impact: 5.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("defensive_anchor");
  });

  it("identifies an Attacking Defender", () => {
    const player = makePlayer("DEF", { attack: 6.0, creation: 6.5, defence: 5.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("attacking_defender");
  });

  it("never labels a defender with a flank-specific term", () => {
    const player = makePlayer("DEF", { attack: 6.0, creation: 6.5, defence: 5.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.label.toLowerCase()).not.toContain("full-back");
    expect(archetype.label.toLowerCase()).not.toContain("full back");
    expect(archetype.label.toLowerCase()).not.toContain("wing-back");
  });

  it("identifies a Complete Forward", () => {
    const player = makePlayer("FWD", { attack: 7.0, creation: 6.5, defence: 2.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("complete_forward");
  });

  it("identifies a Goal Threat forward", () => {
    const player = makePlayer("FWD", { attack: 8.5, creation: 3.0, defence: 1.0, impact: 6.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("goal_threat");
  });

  it("labels a Pressing Forward as a proxy, not a literal pressing stat", () => {
    const player = makePlayer("FWD", { attack: 3.0, creation: 3.0, defence: 6.5, impact: 5.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("pressing_forward");
    expect(archetype.description.toLowerCase()).toContain("proxy");
  });

  it("gives goalkeepers a Shot-Stopper archetype from defence alone", () => {
    const player = makePlayer("GKP", { attack: 0, creation: 0, defence: 7.5, impact: 5.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("shot_stopper");
  });

  it("never assigns a shape archetype to a goalkeeper below the defence threshold", () => {
    const player = makePlayer("GKP", { attack: 0, creation: 0, defence: 4.0, impact: 5.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBeNull();
  });

  it("returns no profile when nothing clears any threshold", () => {
    const player = makePlayer("MID", { attack: 2.0, creation: 2.5, defence: 2.0, impact: 3.0 });
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBeNull();
    expect(archetype.label).toBe("Profile still taking shape");
  });

  it("still returns a shape at Limited confidence, but flags it as an early profile", () => {
    const player = makePlayer("MID", { attack: 3.0, creation: 8.5, defence: 3.0, impact: 6.0 }, "low");
    const archetype = classifyArchetype(player);
    expect(archetype.key).toBe("creative_hub");
    expect(archetype.qualifier).toBe("Early profile");
    expect(archetype.confidence).toBe("Limited");
  });

  it("flags an emerging profile at Developing confidence", () => {
    const player = makePlayer("MID", { attack: 3.0, creation: 8.5, defence: 3.0, impact: 6.0 }, "moderate");
    const archetype = classifyArchetype(player);
    expect(archetype.qualifier).toBe("Emerging profile");
    expect(archetype.confidence).toBe("Developing");
  });

  it("has no qualifier at Established confidence", () => {
    const player = makePlayer("MID", { attack: 3.0, creation: 8.5, defence: 3.0, impact: 6.0 }, "established");
    const archetype = classifyArchetype(player);
    expect(archetype.qualifier).toBeNull();
    expect(archetype.confidence).toBe("Established");
  });

  it("always carries the raw dimensions for future similarity/discovery use", () => {
    const player = makePlayer("FWD", { attack: 8.5, creation: 3.0, defence: 1.0, impact: 6.5 });
    const archetype = classifyArchetype(player);
    expect(archetype.dimensions).toEqual({ attack: 8.5, creation: 3.0, defence: 1.0, impact: 6.5 });
  });

  it("handles missing category scores without throwing", () => {
    const player = makePlayer("MID", { attack: undefined, creation: undefined, defence: undefined, impact: undefined });
    expect(() => classifyArchetype(player)).not.toThrow();
  });
});
