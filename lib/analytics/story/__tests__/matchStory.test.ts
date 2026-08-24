import { describe, expect, it } from "vitest";
import { describeStandout, buildMatchNarrative } from "../matchStory";

const noTeammates: { rating: { score: number } | null; started: boolean }[] = [];

function member(overrides: Partial<Parameters<typeof describeStandout>[0]> = {}) {
  return {
    playerId: "1",
    name: "Saka",
    position: "MID" as const,
    minutes: 90,
    started: true,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    ...overrides,
  };
}

describe("describeStandout", () => {
  it("always returns a non-empty observation and evidence", () => {
    const line = describeStandout(member({ goals: 1 }), "ARS", 9.4, "Excellent", {}, noTeammates);
    expect(line.observation.length).toBeGreaterThan(0);
    expect(line.evidence.length).toBeGreaterThan(0);
  });

  it("evidence always mentions the team and is factual", () => {
    const line = describeStandout(member({ goals: 1, assists: 1 }), "ARS", 9.4, "Excellent", {}, noTeammates);
    expect(line.evidence).toContain("9.4");
  });

  it("falls back to level 1/2 when no mechanism fires", () => {
    const line = describeStandout(member(), "NEW", 7.0, "Very good", {}, noTeammates);
    expect(line.level).toBeLessThanOrEqual(2);
    expect(line.mechanism).not.toBe("cardDespiteGoodPerformance");
  });

  it("detects a strong performance with a card (cardDespiteGoodPerformance)", () => {
    const line = describeStandout(member({ yellowCards: 1 }), "NEW", 7.5, "Very good", {}, noTeammates);
    expect(line.level).toBe(3);
    expect(line.mechanism).toBe("cardDespiteGoodPerformance");
  });

  it("detects an attacking player whose standout category is defence (categoryMismatch)", () => {
    const line = describeStandout(member({ position: "MID" }), "ARS", 7.5, "Very good", { defence: 8.0, attack: 2.0, creation: 2.0 }, noTeammates);
    expect(line.mechanism).toBe("categoryMismatch");
    expect(line.observation.toLowerCase()).toContain("midfielder");
  });

  it("does not fire categoryMismatch for a defender leading in defence (that's normal, not ironic)", () => {
    const line = describeStandout(member({ position: "DEF" }), "NEW", 7.5, "Very good", { defence: 8.0 }, noTeammates);
    expect(line.mechanism).not.toBe("categoryMismatch");
  });

  it("detects a substitute who outrated every starter", () => {
    const teammates = [
      { rating: { score: 6.0 }, started: true },
      { rating: { score: 6.5 }, started: true },
    ];
    const line = describeStandout(member({ started: false, minutes: 15 }), "NEW", 8.0, "Excellent", {}, teammates);
    expect(line.mechanism).toBe("substituteOutperformedStarters");
  });

  it("never claims a specific physical action not in the data", () => {
    const line = describeStandout(member({ position: "MID" }), "ARS", 8.5, "Excellent", { defence: 8.0 }, noTeammates);
    for (const text of [line.observation.toLowerCase(), line.evidence.toLowerCase()]) {
      expect(text).not.toContain("dominated");
      expect(text).not.toContain("shut down");
    }
  });

  it("never uses a capitalised/shouty format — no all-caps words in the observation", () => {
    const line = describeStandout(member({ position: "MID" }), "ARS", 8.5, "Excellent", { defence: 8.0 }, noTeammates);
    const shoutyWords = line.observation.split(/\s+/).filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
    expect(shoutyWords).toHaveLength(0);
  });

  it("is deterministic for the same player across repeat calls", () => {
    const a = describeStandout(member({ yellowCards: 1 }), "NEW", 7.5, "Very good", {}, noTeammates);
    const b = describeStandout(member({ yellowCards: 1 }), "NEW", 7.5, "Very good", {}, noTeammates);
    expect(a.observation).toBe(b.observation);
  });
});

describe("buildMatchNarrative", () => {
  const base = {
    homeTeam: "ARS",
    awayTeam: "COV",
    status: "finished",
    scorers: [],
    cards: [],
  };

  it("classifies a draw", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 2, awayScore: 2 });
    expect(text).toContain("ARS and COV drew 2–2");
  });

  it("classifies a goalless draw distinctly", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 0, awayScore: 0 });
    expect(text).toContain("goalless draw");
  });

  it("classifies a narrow (1-goal) win", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 2, awayScore: 1 });
    expect(text).toContain("edged past");
  });

  it("classifies a comfortable win plainly, with no forced flourish, when nothing genuinely notable happened", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 3, awayScore: 1 });
    expect(text).toContain("ARS beat COV");
  });

  it("adds a routine-rout observation only for a big, drama-free win", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 5, awayScore: 0 });
    expect(text.toLowerCase()).toMatch(/not much else|almost nothing|more or less the whole story/);
  });

  it("does not add the routine-rout observation when the rout had cards (real drama present)", () => {
    const text = buildMatchNarrative({
      ...base,
      homeScore: 5,
      awayScore: 0,
      cards: [
        { playerId: "1", slug: "a", name: "A", teamSide: "away", yellow: true, red: false },
        { playerId: "2", slug: "b", name: "B", teamSide: "away", yellow: true, red: false },
        { playerId: "3", slug: "c", name: "C", teamSide: "away", yellow: true, red: false },
      ],
    });
    expect(text.toLowerCase()).not.toMatch(/not much else|almost nothing/);
  });

  it("mentions a clean sheet only when one side actually kept one", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 3, awayScore: 0 });
    expect(text).toContain("ARS kept a clean sheet");
  });

  it("does not claim a clean sheet in a goalless draw (already implied, avoid redundancy)", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 0, awayScore: 0 });
    expect(text).not.toContain("clean sheet");
  });

  it("mentions multi-goal scorers with a count", () => {
    const text = buildMatchNarrative({
      ...base,
      homeScore: 3,
      awayScore: 0,
      scorers: [{ playerId: "1", slug: "saka", name: "Saka", teamSide: "home", count: 2 }],
    });
    expect(text).toContain("Saka (2)");
  });

  it("mentions a red card", () => {
    const text = buildMatchNarrative({
      ...base,
      homeScore: 1,
      awayScore: 1,
      cards: [{ playerId: "1", slug: "x", name: "Gabriel", teamSide: "home", yellow: false, red: true }],
    });
    expect(text).toContain("Gabriel was sent off");
  });

  it("never mentions a late equaliser, comeback, penalty, own goal, momentum, or tactical control — no data supports these claims", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 2, awayScore: 2 });
    for (const forbidden of ["late equaliser", "comeback", "penalty", "own goal", "momentum", "controlled the game", "tactical"]) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("never repeats the standout player — that's a separate, dedicated section now", () => {
    const text = buildMatchNarrative({ ...base, homeScore: 2, awayScore: 0 });
    expect(text.toLowerCase()).not.toContain("standout");
    expect(text.toLowerCase()).not.toContain("match rating of");
  });

  it("handles an unplayed match honestly", () => {
    const text = buildMatchNarrative({ ...base, homeScore: null, awayScore: null, status: "upcoming" });
    expect(text).toBe("ARS vs COV — not yet played.");
  });
});
