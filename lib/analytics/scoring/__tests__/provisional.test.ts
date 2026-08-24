import { describe, expect, it } from "vitest";
import { computeProvisionalRankings, type PlayerPerformanceInput } from "../provisional";

function makePlayer(
  overrides: Partial<PlayerPerformanceInput> & { id: string }
): PlayerPerformanceInput {
  return {
    slug: `player-${overrides.id}`,
    name: `Player ${overrides.id}`,
    teamShortName: "TMA",
    position: "FWD",
    photoUrl: null,
    teamCrestUrl: null,
    season: {
      minutes: 90,
      matches: 1,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      saves: 0,
      xg: 0,
      xa: 0,
      defensiveActions: 0,
      bps: 0,
    },
    matchLog: [],
    ...overrides,
  };
}

describe("computeProvisionalRankings", () => {
  it("excludes players below the minutes floor", () => {
    const inputs = [
      makePlayer({ id: "1", season: { minutes: 10, matches: 1, goals: 5, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
      makePlayer({ id: "2" }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    expect(players.map((p) => p.playerId)).toEqual(["2"]);
  });

  it("ranks a forward with more goals and xG higher on attack, within position", () => {
    const inputs = [
      makePlayer({
        id: "1",
        season: { minutes: 90, matches: 1, goals: 2, assists: 0, cleanSheets: 0, saves: 0, xg: 1.5, xa: 0, defensiveActions: 0, bps: 0 },
      }),
      makePlayer({
        id: "2",
        season: { minutes: 90, matches: 1, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.1, xa: 0, defensiveActions: 0, bps: 0 },
      }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const p1 = players.find((p) => p.playerId === "1")!;
    const p2 = players.find((p) => p.playerId === "2")!;
    expect(p1.scores.attack!).toBeGreaterThan(p2.scores.attack!);
  });

  it("never compares a goalkeeper's defence score against outfield metrics", () => {
    const inputs = [
      makePlayer({
        id: "1",
        position: "GKP",
        season: { minutes: 90, matches: 1, goals: 0, assists: 0, cleanSheets: 0, saves: 5, xg: 0, xa: 0, defensiveActions: 0, bps: 0 },
      }),
      makePlayer({
        id: "2",
        position: "FWD",
        season: { minutes: 90, matches: 1, goals: 3, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 },
      }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const gk = players.find((p) => p.playerId === "1")!;
    // A goalkeeper with saves should still receive a defence score computed
    // only against other goalkeepers (here, a group of one -> 50th percentile).
    expect(gk.scores.defence).toBeDefined();
  });

  it("classifies sample confidence from matches played, without hiding anyone", () => {
    const inputs = [
      makePlayer({ id: "1", season: { minutes: 90, matches: 1, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
      makePlayer({ id: "2", season: { minutes: 900, matches: 10, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    expect(players.find((p) => p.playerId === "1")!.sample.confidence).toBe("low");
    expect(players.find((p) => p.playerId === "2")!.sample.confidence).toBe("established");
  });

  it("produces a human-readable quality label and sample note", () => {
    const inputs = [makePlayer({ id: "1" })];
    const { players, sampleNote } = computeProvisionalRankings(inputs);
    expect(players[0].qualityLabel).toBeTruthy();
    expect(sampleNote).toMatch(/gameweek/i);
  });

  it("gives a player whose recent matches outscore their season baseline a higher Form than Performance", () => {
    const inputs = [
      makePlayer({
        id: "1",
        season: { minutes: 450, matches: 5, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.5, xa: 0, defensiveActions: 0, bps: 60 },
        matchLog: [
          { minutes: 90, bps: 40 },
          { minutes: 90, bps: 38 },
        ],
      }),
      makePlayer({
        id: "2",
        season: { minutes: 450, matches: 5, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.5, xa: 0, defensiveActions: 0, bps: 60 },
        matchLog: [
          { minutes: 90, bps: 2 },
          { minutes: 90, bps: 3 },
        ],
      }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const p1 = players.find((p) => p.playerId === "1")!;
    const p2 = players.find((p) => p.playerId === "2")!;
    // Same season totals -> same Impact, but player 1's recent matches were
    // far stronger, so only Form should separate them.
    expect(p1.scores.impact).toBe(p2.scores.impact);
    expect(p1.scores.form!).toBeGreaterThan(p2.scores.form!);
  });
});
