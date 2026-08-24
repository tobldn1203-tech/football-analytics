import { describe, expect, it } from "vitest";
import { buildSeasonStory } from "../seasonStory";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import type { PlayerIntelligence } from "@/lib/analytics/intelligence/types";

function makePlayer(
  scores: Partial<RankedPlayer["scores"]>,
  confidence: RankedPlayer["sample"]["confidence"],
  matches: number
): RankedPlayer {
  return {
    playerId: "1",
    slug: "player",
    name: "Hall",
    teamShortName: "NEW",
    position: "DEF",
    sample: { matches, minutes: matches * 90, confidence },
    scores,
    qualityLabel: "Good",
    photoUrl: null,
    teamCrestUrl: null,
  };
}

function makeIntel(overrides: Partial<PlayerIntelligence> = {}): PlayerIntelligence {
  return {
    playerId: "1",
    name: "Hall",
    teamShortName: "NEW",
    performance: { score: 7.0, label: "Very good", confidence: "Established" },
    form: { score: 7.0, label: "Strong", deltaFromPerformance: 0 },
    impact: { score: 7.0, label: "Very good" },
    consistency: { available: false, score: null, label: "Not enough data yet", matchesConsidered: 0, explanation: "" },
    momentum: { available: false, direction: "STABLE", magnitude: 0, label: "Not enough matches yet", explanation: "" },
    confidence: "Established",
    primaryStrengths: [],
    developmentAreas: [],
    summary: "",
    ...overrides,
  };
}

describe("buildSeasonStory", () => {
  it("uses early-days language and never claims an identity at Limited confidence", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "low", 1);
    const intel = makeIntel({ confidence: "Limited", primaryStrengths: [] });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    expect(paragraph).toContain("Early signs");
    expect(paragraph).toContain("Too early to draw firm conclusions");
    expect(paragraph.toLowerCase()).not.toContain("has established himself");
    expect(paragraph.toLowerCase()).not.toContain("one of the premier league's best");
  });

  it("uses provisional, emerging language at Developing confidence", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "moderate", 4);
    const intel = makeIntel({
      confidence: "Developing",
      primaryStrengths: [{ key: "defence", label: "Defensive contribution", score: 8 }],
    });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    expect(paragraph).toContain("beginning to show");
    expect(paragraph.toLowerCase()).toContain("emerging strength");
  });

  it("uses confident, specific language at Established confidence", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "established", 10);
    const intel = makeIntel({
      confidence: "Established",
      primaryStrengths: [{ key: "defence", label: "Defensive contribution", score: 8 }],
    });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    expect(paragraph).toContain("consistently show");
    expect(paragraph).toContain("One of Hall's clearest strengths has been defensive contribution");
  });

  it("mentions rising momentum only when momentum is available", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "established", 10);
    const intel = makeIntel({ confidence: "Established", momentum: { available: true, direction: "RISING", magnitude: 5, label: "Rising", explanation: "" } });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    expect(paragraph.toLowerCase()).toContain("trending upward");
  });

  it("never mentions momentum direction when momentum is unavailable", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "established", 10);
    const intel = makeIntel({ confidence: "Established", momentum: { available: false, direction: "RISING", magnitude: 0, label: "", explanation: "" } });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    expect(paragraph.toLowerCase()).not.toContain("trending upward");
  });

  it("never uses a pronoun for the player", () => {
    const player = makePlayer({ attack: 2, creation: 3, defence: 8, impact: 6 }, "established", 10);
    const intel = makeIntel({
      confidence: "Established",
      primaryStrengths: [{ key: "defence", label: "Defensive contribution", score: 8 }],
      momentum: { available: true, direction: "FALLING", magnitude: -5, label: "Falling", explanation: "" },
    });
    const { paragraph } = buildSeasonStory(player, intel, "Newcastle");
    for (const pronoun of [" he ", " his ", " him ", " she ", " her "]) {
      expect(paragraph.toLowerCase()).not.toContain(pronoun);
    }
  });
});
