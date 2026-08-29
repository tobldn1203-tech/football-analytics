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
  /** Pass-through identity — see RankedPlayer.teamId. Not analytics. */
  teamId: string;
  teamShortName: string;
  position: PositionCode;
  /** Pass-through identity imagery — see lib/assets/images.ts. Not analytics. */
  photoUrl: string | null;
  teamCrestUrl: string | null;
  nationality?: string | null;
  nationalityCode?: string | null;
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

/**
 * DEFENCE TEAM-OUTCOME WEIGHTING — experimental, post-audit
 * ==========================================================================
 * See docs/DEFENCE_METHODOLOGY_AUDIT.md. GKP and DEF Defence blends an
 * individual signal (saves / defensiveActions) with a team-level clean-sheet
 * signal — the original methodology weighted these 50/50, which the audit
 * found systematically suppresses strong individual performances when the
 * team concedes (e.g. Lacroix, and more severely O'Shea/Senesi/Richards in
 * GW1 — 19/87 defenders lost 15+ percentile points this way) and inflates
 * weak individual performances when the team keeps a clean sheet (e.g.
 * Dunk — 12/87 defenders gained 15+ points this way).
 *
 * These two constants are the audit's single most promising experiment —
 * NOT a validated final formula. They were tested against exactly one
 * completed gameweek (see the audit's §5 candidate comparison and §10
 * recommendation). Revisit once GW2+ arrives: rerun
 * scripts/audit-defence-methodology.ts's --compare-weighting mode and
 * confirm this ratio (or a better one) still behaves well across a larger
 * sample before treating it as settled.
 *
 * To restore the original methodology, set these back to 0.5 / 0.5 — no
 * other part of the formula needs to change either way. They must sum to 1.
 */
const INDIVIDUAL_DEFENCE_WEIGHT = 0.7;
const TEAM_CLEAN_SHEET_WEIGHT = 0.3;

/**
 * Weighted variant of averagePercentilesTo10, used ONLY for the GKP/DEF
 * Defence blend above — every other category (Attack, Creation, Impact,
 * Form, and MID/FWD Defence, which has no team component at all and never
 * reaches this function) continues through the plain, unweighted
 * averagePercentilesTo10 exactly as before.
 */
function weightedAveragePercentilesTo10(
  individualPercentiles: number[],
  teamPercentiles: number[],
  individualWeight: number,
  teamWeight: number
): number[] {
  return individualPercentiles.map(
    (v, i) => (v * individualWeight + teamPercentiles[i] * teamWeight) / 10
  );
}

/** Defence metrics differ by position — this is the one category kept position-relative.
 *  Where two metrics are returned, the first is always the individual signal and the
 *  second always the team clean-sheet signal — see weightedAveragePercentilesTo10 above. */
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
    const percentileArrays = metrics.map((metric) =>
      percentileRank(players.map((p) => per90ByPlayer.get(p.id)![metric]))
    );
    // Two metrics only ever means [individual, team clean sheet] — see
    // defenceMetricsForPosition's comment — so this is exactly where the
    // experimental weighting applies. MID/FWD (one metric, no team signal
    // at all) fall through to the unweighted average, unchanged.
    const defenceForGroup =
      percentileArrays.length === 2
        ? weightedAveragePercentilesTo10(
            percentileArrays[0],
            percentileArrays[1],
            INDIVIDUAL_DEFENCE_WEIGHT,
            TEAM_CLEAN_SHEET_WEIGHT
          )
        : averagePercentilesTo10(percentileArrays);
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
      teamId: p.teamId,
      teamShortName: p.teamShortName,
      photoUrl: p.photoUrl,
      teamCrestUrl: p.teamCrestUrl,
      nationality: p.nationality,
      nationalityCode: p.nationalityCode,
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

export { MIN_MINUTES, INDIVIDUAL_DEFENCE_WEIGHT, TEAM_CLEAN_SHEET_WEIGHT };
export type { Category };
