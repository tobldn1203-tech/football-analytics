import { describe, expect, it } from "vitest";
import {
  classifySampleConfidence,
  evidenceReliability,
  RELIABILITY_K,
} from "../types";
import {
  computeProvisionalRankings,
  type PlayerPerformanceInput,
} from "../provisional";
import { computeMatchRatings, type MatchRatingInput } from "../matchRating";

/**
 * Regression suite for the minutes-aware reliability design — see
 * docs/PLAYER_INTELLIGENCE_MINUTES_DESIGN.md (Model D) and
 * docs/MINUTES_SAMPLE_RELIABILITY_AUDIT.md for the full design and its
 * real-data validation. This file covers the pure primitives
 * (`evidenceReliability`, minutes-based `classifySampleConfidence`) and
 * their integration into `computeProvisionalRankings`; Defence's 70/30
 * weighting and Overall's category weighting have their own existing
 * regression coverage in provisional.test.ts (now explicitly isolated
 * from this feature via `{ applyReliability: false }` — see that file).
 */

describe("evidenceReliability", () => {
  it("is 0 at 0 minutes — no evidence, fully trust the prior", () => {
    expect(evidenceReliability(0)).toBe(0);
  });

  it("is exactly 0.5 at K minutes (K=90, one full match)", () => {
    expect(RELIABILITY_K).toBe(90);
    expect(evidenceReliability(90)).toBeCloseTo(0.5, 10);
  });

  it("is exactly 2/3 at 180 minutes (2×K)", () => {
    expect(evidenceReliability(180)).toBeCloseTo(2 / 3, 10);
  });

  it("is exactly 0.75 at 270 minutes (3×K)", () => {
    expect(evidenceReliability(270)).toBeCloseTo(0.75, 10);
  });

  it("is exactly 0.8 at 360 minutes (4×K)", () => {
    expect(evidenceReliability(360)).toBeCloseTo(0.8, 10);
  });

  it("is exactly 0.75 at 270 minutes and approaches, never reaches, 1 as minutes grow", () => {
    expect(evidenceReliability(10_000)).toBeLessThan(1);
    expect(evidenceReliability(10_000)).toBeGreaterThan(0.99);
    expect(evidenceReliability(100_000)).toBeLessThan(1);
  });

  it("has no cliff — every additional minute produces a smoothly smaller reliability step than the last (concave, continuous)", () => {
    const step = (a: number, b: number) => evidenceReliability(b) - evidenceReliability(a);
    const earlyStep = step(45, 90); // +45 minutes near the origin
    const lateStep = step(900, 945); // same +45 minutes, much further along the curve
    expect(earlyStep).toBeGreaterThan(lateStep);
    expect(lateStep).toBeGreaterThan(0); // still strictly increasing, just by less
  });

  it("is monotonic: increasing minutes never increases shrinkage (never decreases reliability)", () => {
    const points = [0, 1, 10, 45, 90, 180, 270, 360, 500, 720, 1000, 3000, 10_000];
    for (let i = 1; i < points.length; i++) {
      expect(evidenceReliability(points[i])).toBeGreaterThan(evidenceReliability(points[i - 1]));
    }
  });
});

describe("classifySampleConfidence (minutes-based)", () => {
  it("269 minutes -> low, 270 minutes -> moderate (the low/moderate boundary)", () => {
    expect(classifySampleConfidence(269)).toBe("low");
    expect(classifySampleConfidence(270)).toBe("moderate");
  });

  it("719 minutes -> moderate, 720 minutes -> established (the moderate/established boundary)", () => {
    expect(classifySampleConfidence(719)).toBe("moderate");
    expect(classifySampleConfidence(720)).toBe("established");
  });

  it("0 minutes -> low", () => {
    expect(classifySampleConfidence(0)).toBe("low");
  });

  it("a player who plays full 90-minute matches crosses these boundaries at the same match count as the old matches-based rule (3 and 8 matches)", () => {
    expect(classifySampleConfidence(2 * 90)).toBe("low");
    expect(classifySampleConfidence(3 * 90)).toBe("moderate");
    expect(classifySampleConfidence(7 * 90)).toBe("moderate");
    expect(classifySampleConfidence(8 * 90)).toBe("established");
  });
});

// ---- Integration: computeProvisionalRankings ----

function fwd(overrides: Partial<PlayerPerformanceInput> & { id: string }): PlayerPerformanceInput {
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

describe("computeProvisionalRankings — minutes-aware reliability", () => {
  it("does not change the 45-minute eligibility floor — still binary, still unaffected by reliability", () => {
    const inputs = [
      fwd({ id: "below", season: { minutes: 44, matches: 1, goals: 5, assists: 0, cleanSheets: 0, saves: 0, xg: 5, xa: 0, defensiveActions: 0, bps: 0 } }),
      fwd({ id: "at", season: { minutes: 45, matches: 1, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    expect(players.map((p) => p.playerId)).toEqual(["at"]);
  });

  it("a genuinely elite thin-sample performer: score is tempered but not erased — stays well above the prior and above a full-minutes player with a merely average rate", () => {
    // A 95-minute cameo scorer (Isidor's real shape) among a realistic pool.
    const inputs = [
      fwd({ id: "cameo-elite", season: { minutes: 95, matches: 4, goals: 2, assists: 1, cleanSheets: 0, saves: 0, xg: 1.8, xa: 0.4, defensiveActions: 0, bps: 60 } }),
      fwd({ id: "full-average", season: { minutes: 360, matches: 4, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.9, xa: 0.1, defensiveActions: 0, bps: 100 } }),
      fwd({ id: "full-poor", season: { minutes: 360, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.1, xa: 0, defensiveActions: 0, bps: 20 } }),
      fwd({ id: "full-poor-2", season: { minutes: 350, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.2, xa: 0, defensiveActions: 0, bps: 30 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const cameo = players.find((p) => p.playerId === "cameo-elite")!;
    const prior =
      players.reduce((sum, p) => sum + (p.scores.overall ?? 0), 0) / players.length;

    // Tempered: shrinking toward the prior must move the score DOWN from
    // its (very high, dominant per-90 rate) raw value.
    const rawEquivalent = computeProvisionalRankings(inputs, { applyReliability: false }).players.find(
      (p) => p.playerId === "cameo-elite"
    )!;
    expect(cameo.scores.overall!).toBeLessThan(rawEquivalent.scores.overall!);
    // Not erased: still clearly above the pool average.
    expect(cameo.scores.overall!).toBeGreaterThan(prior);
    // The genuine attacking contribution isn't wiped out — still the top scorer.
    const maxOthers = Math.max(
      ...players.filter((p) => p.playerId !== "cameo-elite").map((p) => p.scores.overall ?? 0)
    );
    expect(cameo.scores.overall!).toBeGreaterThan(maxOthers);
  });

  it("a poor thin-sample performer: shrinkage pulls the score UP toward the mean, not further down, and it does not become inflated", () => {
    const inputs = [
      fwd({ id: "cameo-poor", season: { minutes: 51, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.05, xa: 0, defensiveActions: 0, bps: 4 } }),
      fwd({ id: "full-good", season: { minutes: 360, matches: 4, goals: 3, assists: 2, cleanSheets: 0, saves: 0, xg: 2.5, xa: 1.5, defensiveActions: 0, bps: 200 } }),
      fwd({ id: "full-average", season: { minutes: 350, matches: 4, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.9, xa: 0.2, defensiveActions: 0, bps: 100 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const cameoPoor = players.find((p) => p.playerId === "cameo-poor")!;
    const rawEquivalent = computeProvisionalRankings(inputs, { applyReliability: false }).players.find(
      (p) => p.playerId === "cameo-poor"
    )!;

    // Pulled toward the mean means UP, since a near-zero contribution's raw
    // score is below the pool average.
    expect(cameoPoor.scores.overall!).toBeGreaterThanOrEqual(rawEquivalent.scores.overall!);
    // Still clearly the worst of the three — not artificially inflated past
    // players with genuinely strong, well-evidenced contributions.
    const best = Math.max(...players.filter((p) => p.playerId !== "cameo-poor").map((p) => p.scores.overall ?? 0));
    expect(cameoPoor.scores.overall!).toBeLessThan(best);
  });

  it("same underlying rate, different total minutes -> less total shrinkage as minutes increase (monotonic, not just at the reliability-function level)", () => {
    // Three players with an IDENTICAL per-90 xG rate (so an identical raw
    // score before any shrinkage), differing only in total minutes.
    const inputs = [
      fwd({ id: "m45", season: { minutes: 45, matches: 2, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.5, xa: 0, defensiveActions: 0, bps: 0 } }), // rate 1.0/90
      fwd({ id: "m180", season: { minutes: 180, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 2.0, xa: 0, defensiveActions: 0, bps: 0 } }), // rate 1.0/90
      fwd({ id: "m900", season: { minutes: 900, matches: 10, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 10.0, xa: 0, defensiveActions: 0, bps: 0 } }), // rate 1.0/90
      fwd({ id: "zero", season: { minutes: 450, matches: 5, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }), // creates percentile spread
    ];
    const raw = computeProvisionalRankings(inputs, { applyReliability: false }).players;
    const shrunk = computeProvisionalRankings(inputs).players;

    const rawAttack = (id: string) => raw.find((p) => p.playerId === id)!.scores.attack!;
    const shrunkAttack = (id: string) => shrunk.find((p) => p.playerId === id)!.scores.attack!;
    // All three have the same raw attack score (tied top percentile).
    expect(rawAttack("m45")).toBe(rawAttack("m180"));
    expect(rawAttack("m180")).toBe(rawAttack("m900"));

    const shrinkage45 = rawAttack("m45") - shrunkAttack("m45");
    const shrinkage180 = rawAttack("m180") - shrunkAttack("m180");
    const shrinkage900 = rawAttack("m900") - shrunkAttack("m900");
    expect(shrinkage45).toBeGreaterThan(shrinkage180);
    expect(shrinkage180).toBeGreaterThan(shrinkage900);
    expect(shrinkage900).toBeGreaterThanOrEqual(0);
  });

  it("an established, full-minutes player is only mildly affected — reliability is high, not a near-total pull toward the prior", () => {
    const inputs = [
      fwd({ id: "star", season: { minutes: 360, matches: 4, goals: 8, assists: 3, cleanSheets: 0, saves: 0, xg: 6, xa: 2, defensiveActions: 0, bps: 250 } }),
      fwd({ id: "mid1", season: { minutes: 340, matches: 4, goals: 2, assists: 1, cleanSheets: 0, saves: 0, xg: 1.8, xa: 0.8, defensiveActions: 0, bps: 120 } }),
      fwd({ id: "mid2", season: { minutes: 330, matches: 4, goals: 1, assists: 1, cleanSheets: 0, saves: 0, xg: 1.0, xa: 0.5, defensiveActions: 0, bps: 90 } }),
      fwd({ id: "weak", season: { minutes: 300, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0.2, xa: 0.1, defensiveActions: 0, bps: 30 } }),
    ];
    const raw = computeProvisionalRankings(inputs, { applyReliability: false }).players.find((p) => p.playerId === "star")!;
    const shrunk = computeProvisionalRankings(inputs).players.find((p) => p.playerId === "star")!;
    const delta = raw.scores.overall! - shrunk.scores.overall!;
    // Reliability at 360 minutes is 0.8 — the shift should be real but modest.
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1.5);
  });

  it("Overall is still the same position-weighted blend of category scores — only the category inputs changed, not the blending formula", () => {
    const inputs = [
      fwd({ id: "a", season: { minutes: 95, matches: 4, goals: 2, assists: 1, cleanSheets: 0, saves: 0, xg: 1.8, xa: 0.4, defensiveActions: 5, bps: 60 } }),
      fwd({ id: "b", season: { minutes: 360, matches: 4, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.9, xa: 0.1, defensiveActions: 10, bps: 100 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    const p = players.find((x) => x.playerId === "a")!;
    // FWD weights: attack 0.45, creation 0.2, defence 0.05, impact 0.3 (unchanged).
    const expectedOverall =
      p.scores.attack! * 0.45 + p.scores.creation! * 0.2 + p.scores.defence! * 0.05 + p.scores.impact! * 0.3;
    expect(p.scores.overall!).toBeCloseTo(expectedOverall, 1);
  });

  it("is idempotent / does not double-apply shrinkage across repeated calls with the same input", () => {
    const inputs = [
      fwd({ id: "a", season: { minutes: 95, matches: 4, goals: 2, assists: 1, cleanSheets: 0, saves: 0, xg: 1.8, xa: 0.4, defensiveActions: 0, bps: 60 } }),
      fwd({ id: "b", season: { minutes: 360, matches: 4, goals: 1, assists: 0, cleanSheets: 0, saves: 0, xg: 0.9, xa: 0.1, defensiveActions: 0, bps: 100 } }),
    ];
    const first = computeProvisionalRankings(inputs).players.find((p) => p.playerId === "a")!;
    const second = computeProvisionalRankings(inputs).players.find((p) => p.playerId === "a")!;
    expect(second.scores.overall).toBe(first.scores.overall);
    expect(second.scores.attack).toBe(first.scores.attack);

    // Feeding the ALREADY-SHRUNK result back through a second round-trip
    // is not a supported operation (the function takes raw
    // PlayerPerformanceInput, not RankedPlayer), so this specifically
    // checks the function is pure/stateless: calling it twice on the exact
    // same raw input yields bit-identical output, not a compounding drift.
  });

  it("classifies confidence from minutes, not matches — a padded-appearance player and a genuinely thin one both read 'low'", () => {
    const inputs = [
      fwd({ id: "padded", season: { minutes: 51, matches: 4, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }), // 4 tiny cameos
      fwd({ id: "onematch", season: { minutes: 51, matches: 1, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
      fwd({ id: "established", season: { minutes: 900, matches: 10, goals: 0, assists: 0, cleanSheets: 0, saves: 0, xg: 0, xa: 0, defensiveActions: 0, bps: 0 } }),
    ];
    const { players } = computeProvisionalRankings(inputs);
    expect(players.find((p) => p.playerId === "padded")!.sample.confidence).toBe("low");
    expect(players.find((p) => p.playerId === "onematch")!.sample.confidence).toBe("low");
    expect(players.find((p) => p.playerId === "established")!.sample.confidence).toBe("established");
  });
});

// ---- Match Rating must be completely unaffected ----

describe("computeMatchRatings — Match Rating is unaffected by season-level reliability shrinkage", () => {
  function matchPlayer(overrides: Partial<MatchRatingInput> & { playerId: string }): MatchRatingInput {
    return {
      slug: `p-${overrides.playerId}`,
      name: `Player ${overrides.playerId}`,
      teamId: "team-a",
      teamShortName: "TMA",
      position: "FWD",
      photoUrl: null,
      teamCrestUrl: null,
      minutes: 90,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      saves: 0,
      xg: 0,
      xa: 0,
      defensiveActions: 0,
      bps: 0,
      ...overrides,
    };
  }

  it("a short, exceptional cameo still produces a high Match Rating — not shrunk toward the gameweek average", () => {
    // 45 minutes is the module's existing MIN_MINUTES eligibility floor
    // (unchanged by this feature — see provisional.test.ts's own floor
    // test) — a short cameo AT that floor, not a sub-floor appearance.
    const rows = [
      matchPlayer({ playerId: "cameo", minutes: 45, goals: 1, xg: 0.9, bps: 30 }),
      matchPlayer({ playerId: "peer1", minutes: 90, goals: 0, xg: 0.2, bps: 20 }),
      matchPlayer({ playerId: "peer2", minutes: 90, goals: 0, xg: 0.1, bps: 15 }),
      matchPlayer({ playerId: "peer3", minutes: 90, goals: 0, xg: 0.1, bps: 10 }),
    ];
    const ratings = computeMatchRatings(rows);
    const cameo = ratings.find((r) => r.playerId === "cameo")!;
    // A short, goalscoring cameo should still be able to top the gameweek.
    const best = Math.max(...ratings.filter((r) => r.playerId !== "cameo").map((r) => r.scores.overall ?? 0));
    expect(cameo.scores.overall!).toBeGreaterThan(best);
    expect(cameo.lowMinutes).toBe(true); // still correctly flagged low-minutes in the UI
  });

  it("produces byte-identical output to computeProvisionalRankings called directly with { applyReliability: false } on the same single-gameweek shape — confirming the opt-out is wired correctly, not just present", () => {
    const rows: MatchRatingInput[] = [
      matchPlayer({ playerId: "cameo", minutes: 45, goals: 1, xg: 0.9, bps: 30 }),
      matchPlayer({ playerId: "peer1", minutes: 90, goals: 0, xg: 0.2, bps: 20 }),
    ];
    const viaMatchRatings = computeMatchRatings(rows).find((r) => r.playerId === "cameo")!;

    const inputs: PlayerPerformanceInput[] = rows.map((r) => ({
      id: r.playerId,
      slug: r.slug,
      name: r.name,
      teamId: r.teamId,
      teamShortName: r.teamShortName,
      position: r.position,
      photoUrl: r.photoUrl,
      teamCrestUrl: r.teamCrestUrl,
      season: {
        minutes: r.minutes,
        matches: 1,
        goals: r.goals,
        assists: r.assists,
        cleanSheets: r.cleanSheets,
        saves: r.saves,
        xg: r.xg,
        xa: r.xa,
        defensiveActions: r.defensiveActions,
        bps: r.bps,
      },
      matchLog: [{ minutes: r.minutes, bps: r.bps }],
    }));
    const viaDirect = computeProvisionalRankings(inputs, { applyReliability: false }).players.find(
      (p) => p.playerId === "cameo"
    )!;

    expect(viaMatchRatings.scores.overall).toBe(viaDirect.scores.overall);
    expect(viaMatchRatings.scores.attack).toBe(viaDirect.scores.attack);
  });

  it("every Match Rating still classifies as 'low' confidence — matches: 1 is always < 270 minutes-equivalent for any realistic single match", () => {
    const rows = [matchPlayer({ playerId: "solo", minutes: 90, goals: 1, xg: 1, bps: 40 })];
    const ratings = computeMatchRatings(rows);
    expect(ratings[0].sample.confidence).toBe("low");
  });
});
