import { describe, expect, it } from "vitest";
import {
  cardDespiteGoodPerformance,
  categoryMismatch,
  substituteOutperformedStarters,
  baselineDivergence,
  routineRout,
  chaoticLowScoring,
  cleanSheetDespiteCards,
  plotArmour,
  type PlayerVoiceInput,
  type MatchVoiceInput,
} from "../mechanisms";

function player(overrides: Partial<PlayerVoiceInput> = {}): PlayerVoiceInput {
  return {
    playerId: "1",
    name: "Player",
    teamShortName: "TMA",
    position: "MID",
    minutes: 90,
    started: true,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    rating: { score: 7.0, label: "Very good" },
    categoryScores: {},
    teammates: [],
    ...overrides,
  };
}

describe("cardDespiteGoodPerformance", () => {
  it("fires for a strong rating with a yellow card", () => {
    expect(cardDespiteGoodPerformance(player({ yellowCards: 1 }))).not.toBeNull();
  });
  it("does not fire for a strong rating with no cards", () => {
    expect(cardDespiteGoodPerformance(player())).toBeNull();
  });
  it("does not fire for a mediocre rating with a card", () => {
    expect(cardDespiteGoodPerformance(player({ rating: { score: 5.0, label: "Average" }, yellowCards: 1 }))).toBeNull();
  });
  it("distinguishes a red card in the evidence text", () => {
    const hit = cardDespiteGoodPerformance(player({ redCards: 1 }));
    expect(hit?.evidence.toLowerCase()).toContain("red card");
  });
});

describe("categoryMismatch", () => {
  it("fires for a midfielder whose leading category is defence", () => {
    const hit = categoryMismatch(player({ position: "MID", categoryScores: { defence: 8.0, attack: 2.0, creation: 1.0 } }));
    expect(hit).not.toBeNull();
    expect(hit?.mechanism).toBe("categoryMismatch");
  });
  it("fires for a forward whose leading category is defence", () => {
    expect(categoryMismatch(player({ position: "FWD", categoryScores: { defence: 7.0 } }))).not.toBeNull();
  });
  it("does not fire for a defender leading in defence", () => {
    expect(categoryMismatch(player({ position: "DEF", categoryScores: { defence: 8.0 } }))).toBeNull();
  });
  it("does not fire for a goalkeeper", () => {
    expect(categoryMismatch(player({ position: "GKP", categoryScores: { defence: 9.0 } }))).toBeNull();
  });
  it("does not fire when defence doesn't clear the threshold", () => {
    expect(categoryMismatch(player({ position: "MID", categoryScores: { defence: 4.0 } }))).toBeNull();
  });
  it("does not fire when attack/creation leads instead of defence", () => {
    expect(categoryMismatch(player({ position: "MID", categoryScores: { defence: 5.6, attack: 8.0 } }))).toBeNull();
  });
});

describe("substituteOutperformedStarters", () => {
  const teammates = [
    { rating: { score: 6.0 }, started: true },
    { rating: { score: 6.5 }, started: true },
  ];

  it("fires when a brief substitute outrates every starter", () => {
    const hit = substituteOutperformedStarters(player({ started: false, minutes: 15, rating: { score: 7.0, label: "Very good" }, teammates }));
    expect(hit).not.toBeNull();
  });
  it("does not fire for a starter", () => {
    expect(substituteOutperformedStarters(player({ started: true, teammates }))).toBeNull();
  });
  it("does not fire for a substitute who played too long to count as a cameo", () => {
    expect(substituteOutperformedStarters(player({ started: false, minutes: 60, rating: { score: 9.0, label: "Excellent" }, teammates }))).toBeNull();
  });
  it("does not fire when a starter actually rated higher", () => {
    expect(substituteOutperformedStarters(player({ started: false, minutes: 10, rating: { score: 5.0, label: "Average" }, teammates }))).toBeNull();
  });
});

describe("baselineDivergence", () => {
  it("fires for a big positive divergence from an established season baseline", () => {
    const hit = baselineDivergence(
      player({ rating: { score: 9.0, label: "Excellent" }, context: { seasonBaseline: { score: 6.0, confidence: "established" } } })
    );
    expect(hit).not.toBeNull();
    expect(hit?.evidence).toContain("9.0");
    expect(hit?.evidence).toContain("6.0");
  });

  it("fires for a big negative divergence", () => {
    const hit = baselineDivergence(
      player({ rating: { score: 3.0, label: "Below average" }, context: { seasonBaseline: { score: 7.0, confidence: "established" } } })
    );
    expect(hit).not.toBeNull();
  });

  it("does not fire for a small divergence", () => {
    const hit = baselineDivergence(
      player({ rating: { score: 6.5, label: "Good" }, context: { seasonBaseline: { score: 6.0, confidence: "established" } } })
    );
    expect(hit).toBeNull();
  });

  it("does not fire without an established season sample — a thin baseline can't support the comparison", () => {
    const hit = baselineDivergence(
      player({ rating: { score: 9.0, label: "Excellent" }, context: { seasonBaseline: { score: 6.0, confidence: "low" } } })
    );
    expect(hit).toBeNull();
  });

  it("does not fire when no context is provided at all", () => {
    expect(baselineDivergence(player({ rating: { score: 9.0, label: "Excellent" } }))).toBeNull();
  });
});

function matchSituation(overrides: Partial<MatchVoiceInput> = {}): MatchVoiceInput {
  return {
    homeTeam: "ARS",
    awayTeam: "COV",
    homeScore: 3,
    awayScore: 0,
    category: "rout",
    totalCards: 0,
    homeCards: 0,
    awayCards: 0,
    redCardCount: 0,
    homeTeamRating: null,
    awayTeamRating: null,
    ...overrides,
  };
}

describe("routineRout", () => {
  it("fires for a big win with almost no cards", () => {
    expect(routineRout(matchSituation({ category: "rout", totalCards: 1 }))).not.toBeNull();
  });
  it("does not fire when the rout had a red card", () => {
    expect(routineRout(matchSituation({ category: "rout", totalCards: 1, redCardCount: 1 }))).toBeNull();
  });
  it("does not fire for a comfortable (non-rout) win", () => {
    expect(routineRout(matchSituation({ category: "comfortable" }))).toBeNull();
  });
});

describe("chaoticLowScoring", () => {
  it("fires for a card-heavy draw", () => {
    expect(chaoticLowScoring(matchSituation({ category: "draw", totalCards: 6 }))).not.toBeNull();
  });
  it("does not fire for a low card count", () => {
    expect(chaoticLowScoring(matchSituation({ category: "draw", totalCards: 2 }))).toBeNull();
  });
  it("does not fire for a rout, even with many cards", () => {
    expect(chaoticLowScoring(matchSituation({ category: "rout", totalCards: 6 }))).toBeNull();
  });
});

describe("cleanSheetDespiteCards", () => {
  it("fires when the clean-sheet side picked up 3+ cards", () => {
    expect(cleanSheetDespiteCards(matchSituation({ homeScore: 2, awayScore: 0, homeCards: 3 }))).not.toBeNull();
  });
  it("does not fire with few cards", () => {
    expect(cleanSheetDespiteCards(matchSituation({ homeScore: 2, awayScore: 0, homeCards: 1 }))).toBeNull();
  });
  it("does not fire when there is no clean sheet", () => {
    expect(cleanSheetDespiteCards(matchSituation({ homeScore: 2, awayScore: 1, homeCards: 4 }))).toBeNull();
  });
});

describe("plotArmour", () => {
  it("fires when the winner had the lower Team Performance rating", () => {
    const hit = plotArmour(matchSituation({ homeScore: 2, awayScore: 1, category: "narrow", homeTeamRating: 4.0, awayTeamRating: 6.5 }));
    expect(hit).not.toBeNull();
    expect(hit?.evidence).toContain("4.0");
    expect(hit?.evidence).toContain("6.5");
  });

  it("does not fire when the winner also had the higher rating (no irony — expected outcome)", () => {
    expect(plotArmour(matchSituation({ homeScore: 2, awayScore: 1, homeTeamRating: 7.0, awayTeamRating: 5.0 }))).toBeNull();
  });

  it("does not fire for a small gap", () => {
    expect(plotArmour(matchSituation({ homeScore: 2, awayScore: 1, homeTeamRating: 5.4, awayTeamRating: 5.6 }))).toBeNull();
  });

  it("does not fire for a draw", () => {
    expect(plotArmour(matchSituation({ homeScore: 1, awayScore: 1, homeTeamRating: 3.0, awayTeamRating: 7.0 }))).toBeNull();
  });

  it("does not fire when a rating is unavailable", () => {
    expect(plotArmour(matchSituation({ homeScore: 2, awayScore: 1, homeTeamRating: null, awayTeamRating: 7.0 }))).toBeNull();
  });
});
