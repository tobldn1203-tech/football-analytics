import type { PositionCode } from "@/lib/competitions/premier-league";
import { percentileRank } from "./percentile";
import {
  classifySampleConfidence,
  qualityLabelFor,
  type Category,
  type RankedPlayer,
} from "./types";

/**
 * PROVISIONAL SCORING MODEL — v0
 * ================================
 * This is deliberately not the final analytics engine (see
 * docs/PROJECT_PROPOSAL.md §7). It exists to make the product honest and
 * alive using real data while the full multi-season engine is built.
 *
 * This module knows nothing about FPL, Prisma, or any other provider or
 * storage detail — it consumes `PlayerPerformanceInput`, a plain shape any
 * data source could in principle populate. `lib/analytics/scoring/repository.ts`
 * is the only place that translates normalized database rows into this
 * shape, which is what keeps the provider an implementation detail rather
 * than something the UI (or this engine) depends on directly.
 *
 * Method: every metric is converted to a percentile (0–100), then scaled to
 * 0–10. Two different comparison pools are used, deliberately:
 *
 * - Attack, Creation, Impact and Form are ranked LEAGUE-WIDE. These metrics
 *   mean the same thing for every player (a goal is a goal), and a
 *   standalone "who has the best goal threat right now" leaderboard should
 *   behave the way a fan expects: forwards and wingers at the top, not a
 *   centre-back who scored a rare goal topping the chart purely because
 *   other centre-backs scored none.
 * - Defence is ranked POSITION-RELATIVE, because what "good defensively"
 *   means differs by role (a goalkeeper's saves vs. a centre-back's tackles
 *   vs. a winger's work-rate aren't the same metric).
 * - Overall ("Performance" — see lib/analytics/intelligence) blends
 *   league-wide Attack/Creation/Impact with position-relative Defence,
 *   using position-specific weights.
 *
 * Every weight below is a stated hypothesis, not a validated coefficient.
 *
 * Impact/Form currently read `bps` (FPL's own match-contribution score) as
 * their input, not `ict_index` — verified against live data that `ict_index`
 * is reported as 0 for every player until FPL finalizes a gameweek (the
 * same kind of ingestion-time lag as `finished_provisional`, see
 * docs/DATA_SOURCES.md), which silently made every player's Impact/Form
 * identical early in the season. `bps` updates immediately.
 *
 * Form is a recency-weighted league-wide percentile of per-90 `bps` over a
 * player's most recent appearances (see RECENCY_WEIGHTS) — deliberately a
 * different window and weighting than the season-long Impact score, so the
 * two can diverge (a player can be "8.2 Performance, 9.1 Form" or the
 * reverse). See lib/analytics/intelligence for the higher-level Form/
 * Consistency/Momentum concepts built on top of this engine's output.
 */

const MIN_MINUTES = 45; // early-season floor: at least half a match played

/** One appearance's minutes and match-contribution score, most-recent-first. */
export interface MatchLogEntry {
  minutes: number;
  bps: number;
}

/** Most recent match weighted 1.0, decaying for each match further back. */
export const RECENCY_WEIGHTS = [1, 0.8, 0.6, 0.4, 0.2];

export interface PlayerPerformanceInput {
  id: string;
  slug: string;
  name: string;
  teamShortName: string;
  position: PositionCode;
  /** Pass-through identity imagery — see lib/assets/images.ts. Not analytics. */
  photoUrl: string | null;
  teamCrestUrl: string | null;
  /** Season-to-date totals (not per-90 — this module derives rates itself). */
  season: {
    minutes: number;
    matches: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    saves: number;
    xg: number;
    xa: number;
    defensiveActions: number;
    bps: number;
  };
  /**
   * Most recent appearances first (minutes > 0 only). Powers recency-weighted
   * Form here, and Consistency/Momentum in lib/analytics/intelligence — both
   * read the same log so "recent" means the same thing everywhere.
   */
  matchLog: MatchLogEntry[];
}

interface Per90Metrics {
  goals: number;
  xg: number;
  assists: number;
  xa: number;
  defensiveActions: number;
  cleanSheets: number;
  saves: number;
  bps: number;
  recentBps: number;
}

function per90(total: number, minutes: number): number {
  return minutes > 0 ? (total / minutes) * 90 : 0;
}

/** Recency-weighted per-90 rate over a match log (most recent first). */
export function weightedRecentPer90(
  matchLog: MatchLogEntry[],
  weights: number[] = RECENCY_WEIGHTS
): number {
  let weightedTotal = 0;
  let weightedMinutes = 0;
  for (let i = 0; i < Math.min(matchLog.length, weights.length); i++) {
    const w = weights[i];
    weightedTotal += matchLog[i].bps * w;
    weightedMinutes += matchLog[i].minutes * w;
  }
  return weightedMinutes > 0 ? (weightedTotal / weightedMinutes) * 90 : 0;
}

function computePer90(p: PlayerPerformanceInput): Per90Metrics {
  const { season } = p;
  return {
    goals: per90(season.goals, season.minutes),
    xg: per90(season.xg, season.minutes),
    assists: per90(season.assists, season.minutes),
    xa: per90(season.xa, season.minutes),
    defensiveActions: per90(season.defensiveActions, season.minutes),
    cleanSheets: per90(season.cleanSheets, season.minutes),
    saves: per90(season.saves, season.minutes),
    bps: per90(season.bps, season.minutes),
    recentBps: weightedRecentPer90(p.matchLog),
  };
}

/** Averages several percentile arrays (each 0–100) into a single 0–10 score per index. */
function averagePercentilesTo10(percentileArrays: number[][]): number[] {
  const n = percentileArrays[0]?.length ?? 0;
  return Array.from({ length: n }, (_, i) => {
    const avg =
      percentileArrays.reduce((sum, arr) => sum + arr[i], 0) /
      percentileArrays.length;
    return avg / 10;
  });
}

/** Defence metrics differ by position — this is the one category kept position-relative. */
function defenceMetricsForPosition(position: PositionCode): Array<keyof Per90Metrics> {
  if (position === "GKP") return ["saves", "cleanSheets"];
  if (position === "DEF") return ["defensiveActions", "cleanSheets"];
  return ["defensiveActions"];
}

/** Position-specific overall weights. A stated hypothesis, not a finding. */
const OVERALL_WEIGHTS: Record<
  PositionCode,
  Record<"attack" | "creation" | "defence" | "impact", number>
> = {
  GKP: { attack: 0, creation: 0, defence: 0.6, impact: 0.4 },
  DEF: { attack: 0.15, creation: 0.15, defence: 0.45, impact: 0.25 },
  MID: { attack: 0.3, creation: 0.3, defence: 0.15, impact: 0.25 },
  FWD: { attack: 0.45, creation: 0.2, defence: 0.05, impact: 0.3 },
};

export interface ProvisionalRankingResult {
  players: RankedPlayer[];
  sampleNote: string;
}

export function computeProvisionalRankings(
  inputs: PlayerPerformanceInput[]
): ProvisionalRankingResult {
  const eligible = inputs.filter((p) => p.season.minutes >= MIN_MINUTES);
  const per90ByPlayer = new Map(eligible.map((p) => [p.id, computePer90(p)]));

  // --- League-wide categories: same metric definition for every player ---
  const attackScores = averagePercentilesTo10([
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.goals)),
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.xg)),
  ]);
  const creationScores = averagePercentilesTo10([
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.assists)),
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.xa)),
  ]);
  const impactScores = averagePercentilesTo10([
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.bps)),
  ]);
  const formScores = averagePercentilesTo10([
    percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.recentBps)),
  ]);

  // --- Position-relative category: Defence, grouped by position ---
  const defenceScoreByPlayerId = new Map<string, number>();
  const byPosition = new Map<PositionCode, PlayerPerformanceInput[]>();
  for (const p of eligible) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }
  for (const [position, players] of byPosition) {
    const metrics = defenceMetricsForPosition(position);
    const defenceForGroup = averagePercentilesTo10(
      metrics.map((metric) =>
        percentileRank(players.map((p) => per90ByPlayer.get(p.id)![metric]))
      )
    );
    players.forEach((p, i) => defenceScoreByPlayerId.set(p.id, defenceForGroup[i]));
  }

  const players: RankedPlayer[] = eligible.map((p, i) => {
    const weights = OVERALL_WEIGHTS[p.position];
    const defence = defenceScoreByPlayerId.get(p.id) ?? 0;
    const overall =
      attackScores[i] * weights.attack +
      creationScores[i] * weights.creation +
      defence * weights.defence +
      impactScores[i] * weights.impact;

    const scores: RankedPlayer["scores"] = {
      attack: round1(attackScores[i]),
      creation: round1(creationScores[i]),
      defence: round1(defence),
      impact: round1(impactScores[i]),
      form: round1(formScores[i]),
      overall: round1(overall),
    };

    return {
      playerId: p.id,
      slug: p.slug,
      name: p.name,
      teamShortName: p.teamShortName,
      photoUrl: p.photoUrl,
      teamCrestUrl: p.teamCrestUrl,
      position: p.position,
      sample: {
        matches: p.season.matches,
        minutes: p.season.minutes,
        confidence: classifySampleConfidence(p.season.matches),
      },
      scores,
      qualityLabel: qualityLabelFor(scores.overall ?? 0),
    };
  });

  const maxMinutes = Math.max(0, ...eligible.map((p) => p.season.minutes));
  const gwEstimate = Math.max(1, Math.round(maxMinutes / 90));

  return {
    players,
    sampleNote:
      gwEstimate <= 3
        ? `Early season sample — based on ${gwEstimate} gameweek${gwEstimate > 1 ? "s" : ""} so far`
        : `Based on ${gwEstimate} gameweeks played this season`,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export { MIN_MINUTES };
export type { Category };
