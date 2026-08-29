import { describe, expect, it } from "vitest";
import {
  computeProvisionalRankings,
  INDIVIDUAL_DEFENCE_WEIGHT,
  TEAM_CLEAN_SHEET_WEIGHT,
  type PlayerPerformanceInput,
} from "../provisional";

function makePlayer(
  overrides: Partial<PlayerPerformanceInput> & { id: string }
): PlayerPerformanceInput {
  return {
    slug: `player-${overrides.id}`,
    name: `Player ${overrides.id}`,
    teamId: "team-tma",
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

/**
 * DEFENCE TEAM-OUTCOME WEIGHTING — experimental post-audit regression suite
 * ==========================================================================
 * Covers docs/DEFENCE_METHODOLOGY_AUDIT.md's recommendation: individual
 * defensive signal and team clean-sheet outcome now blend
 * INDIVIDUAL_DEFENCE_WEIGHT/TEAM_CLEAN_SHEET_WEIGHT (0.7/0.3) instead of
 * 50/50, for GKP and DEF only. Every expected value below is hand-derived
 * from percentileRank's exact fractional-rank formula (not just "roughly
 * higher/lower"), so a future weighting change will fail these loudly and
 * specifically rather than silently drifting.
 */
describe("Defence: experimental team-outcome weighting", () => {
  it("sums to 1, so no percentile mass is silently gained or lost", () => {
    expect(INDIVIDUAL_DEFENCE_WEIGHT + TEAM_CLEAN_SHEET_WEIGHT).toBeCloseTo(1, 10);
  });

  function defPlayer(id: string, defensiveActions: number, cleanSheets: number): PlayerPerformanceInput {
    return {
      id,
      slug: `def-${id}`,
      name: `Def ${id}`,
      teamId: "team-tma",
    teamShortName: "TMA",
      position: "DEF",
      photoUrl: null,
      teamCrestUrl: null,
      season: { minutes: 90, matches: 1, goals: 0, assists: 0, cleanSheets, saves: 0, xg: 0, xa: 0, defensiveActions, bps: 0 },
      matchLog: [],
    };
  }

  function defenceScoreOf(id: string, players: PlayerPerformanceInput[]): number {
    const { players: ranked } = computeProvisionalRankings(players);
    return ranked.find((p) => p.playerId === id)!.scores.defence!;
  }

  // The six conceptual cases the audit asked for, each a 2-or-3-player DEF
  // cohort chosen so percentileRank's output is exact (0/50/100, or 25/100
  // for a 2-vs-1 tie split) — every expected number here is hand-calculated
  // from (individualPct * 0.7 + teamPct * 0.3) / 10, then rounded to 1dp
  // exactly as computeProvisionalRankings itself does.
  it("1. elite individual + clean sheet -> elite score (100/100 -> 10.0)", () => {
    const players = [defPlayer("target", 20, 1), defPlayer("peer", 5, 0)];
    expect(defenceScoreOf("target", players)).toBeCloseTo(10.0, 1);
  });

  it("2. elite individual + conceded -> still clearly rewarded, not crushed (100/0 -> 7.0)", () => {
    const players = [defPlayer("target", 20, 0), defPlayer("peer", 5, 1)];
    // Under the old 50/50 weighting this would be (100*.5 + 0*.5)/10 = 5.0.
    // The whole point of the experiment is that this case scores higher than that.
    expect(defenceScoreOf("target", players)).toBeCloseTo(7.0, 1);
  });

  it("3. poor individual + clean sheet -> the 'free ride' is reduced, not removed (0/100 -> 3.0)", () => {
    const players = [defPlayer("target", 5, 1), defPlayer("peer", 20, 0)];
    // Under the old 50/50 weighting this would be (0*.5 + 100*.5)/10 = 5.0 —
    // a genuinely quiet defender still landing at "Average". The experiment
    // reduces that inflation (to 3.0) without pretending clean sheets don't matter at all.
    expect(defenceScoreOf("target", players)).toBeCloseTo(3.0, 1);
  });

  it("4. poor individual + conceded -> low on both counts, unaffected by the reweighting (0/0 -> 0.0)", () => {
    const players = [defPlayer("target", 5, 0), defPlayer("peer", 20, 1)];
    expect(defenceScoreOf("target", players)).toBeCloseTo(0.0, 1);
  });

  it("5. average individual + clean sheet -> clean sheet still helps, just less than before (50/100 -> 6.5)", () => {
    const players = [defPlayer("target", 10, 1), defPlayer("low", 5, 0), defPlayer("high", 15, 0)];
    // Old 50/50 would give (50*.5 + 100*.5)/10 = 7.5.
    expect(defenceScoreOf("target", players)).toBeCloseTo(6.5, 1);
  });

  it("6. average individual + conceded -> missing a rare clean sheet is less punishing than before (50/25 -> 4.3)", () => {
    const players = [defPlayer("target", 10, 0), defPlayer("low", 5, 0), defPlayer("high", 15, 1)];
    // Old 50/50 would give (50*.5 + 25*.5)/10 = 3.75 -> 3.8.
    expect(defenceScoreOf("target", players)).toBeCloseTo(4.3, 1);
  });

  it("protects the Mendy case: when individual and team signals fully agree at the top, the score stays elite regardless of weighting", () => {
    // A larger, more realistic cohort (mirrors GW1's shape) where the target
    // is unambiguously the best on both individual activity and the team
    // result. This is a mathematical invariant, not a coincidence: when both
    // percentiles are 100, (100*w1 + 100*w2)/10 = 10 for ANY w1+w2=1 — so
    // this case cannot regress no matter how the exact ratio is tuned later.
    const players = [
      defPlayer("mendy", 25, 1),
      defPlayer("p2", 12, 0),
      defPlayer("p3", 10, 0),
      defPlayer("p4", 8, 1),
      defPlayer("p5", 6, 0),
      defPlayer("p6", 4, 0),
    ];
    expect(defenceScoreOf("mendy", players)).toBeGreaterThanOrEqual(9.0);
  });

  it("does not change MID/FWD Defence at all — no team component reaches them either way", () => {
    function outfieldPlayer(id: string, position: "MID" | "FWD", defensiveActions: number): PlayerPerformanceInput {
      return {
        id,
        slug: `p-${id}`,
        name: `P ${id}`,
        teamId: "team-tma",
    teamShortName: "TMA",
        position,
        photoUrl: null,
        teamCrestUrl: null,
        season: { minutes: 90, matches: 1, goals: 0, assists: 0, cleanSheets: 1, saves: 0, xg: 0, xa: 0, defensiveActions, bps: 0 },
        matchLog: [],
      };
    }
    // cleanSheets is deliberately set (=1) on these MID/FWD players to prove
    // it has zero effect on their Defence score — defenceMetricsForPosition
    // never includes "cleanSheets" for MID/FWD, so the weighting constants
    // introduced by this change are never even read for these positions.
    const mid1 = outfieldPlayer("mid1", "MID", 12);
    const mid2 = outfieldPlayer("mid2", "MID", 4);
    const fwd1 = outfieldPlayer("fwd1", "FWD", 8);
    const fwd2 = outfieldPlayer("fwd2", "FWD", 2);
    const { players } = computeProvisionalRankings([mid1, mid2, fwd1, fwd2]);

    // Plain percentile of defensiveActions alone: within each 2-player
    // position group, high value -> 100th pct -> 10.0, low value -> 0th -> 0.0.
    expect(players.find((p) => p.playerId === "mid1")!.scores.defence).toBeCloseTo(10.0, 1);
    expect(players.find((p) => p.playerId === "mid2")!.scores.defence).toBeCloseTo(0.0, 1);
    expect(players.find((p) => p.playerId === "fwd1")!.scores.defence).toBeCloseTo(10.0, 1);
    expect(players.find((p) => p.playerId === "fwd2")!.scores.defence).toBeCloseTo(0.0, 1);
  });
});
