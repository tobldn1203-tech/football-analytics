import type { MatchLogEntry } from "@/lib/analytics/scoring/provisional";
import type { ConsistencyMetric, ConsistencyLabel } from "./types";

/**
 * Consistency — "how reliably does this player produce performances around
 * their own normal level?"
 *
 * Deliberately SELF-referential, not compared against the league: it
 * measures variation in a player's own per-90 match-contribution (`bps`)
 * across their own recent matches, not against anyone else's numbers. That
 * is what makes it orthogonal to Performance — a modest player who
 * performs at the same modest level every week gets HIGH consistency and
 * LOW performance; a brilliant-then-anonymous player gets high performance
 * on their best day but LOW consistency. Both numbers are reported
 * together, deliberately never blended into one.
 *
 * Method: coefficient of variation (population stdev ÷ mean) of per-90
 * `bps` across qualifying matches, mapped onto 0–10 via a fixed, simple,
 * documented transform (CV 0 → 10, CV ≥ 1 → 0). No comparison to other
 * players, no z-scores — the simplest thing that captures "how spread out
 * are this player's own performances."
 *
 * A match only "qualifies" with at least MIN_MATCH_MINUTES — a 5-minute
 * cameo's per-90 extrapolation is mostly noise and would distort the
 * variation measurement far more than it would inform it.
 */

const MIN_MATCH_MINUTES = 20;
const MIN_QUALIFYING_MATCHES = 3;

function per90(bps: number, minutes: number): number {
  return minutes > 0 ? (bps / minutes) * 90 : 0;
}

function labelFor(score: number): ConsistencyLabel {
  if (score >= 8) return "High consistency";
  if (score >= 6) return "Consistent";
  if (score >= 4) return "Variable";
  return "Highly variable";
}

export function computeConsistency(matchLog: MatchLogEntry[]): ConsistencyMetric {
  const qualifying = matchLog.filter((m) => m.minutes >= MIN_MATCH_MINUTES);

  if (qualifying.length < MIN_QUALIFYING_MATCHES) {
    return {
      available: false,
      score: null,
      label: "Not enough data yet",
      matchesConsidered: qualifying.length,
      explanation: `Only ${qualifying.length} qualifying match${qualifying.length === 1 ? "" : "es"} so far — too few to judge consistency.`,
    };
  }

  const rates = qualifying.map((m) => per90(m.bps, m.minutes));
  const mean = rates.reduce((sum, v) => sum + v, 0) / rates.length;

  if (mean <= 0) {
    return {
      available: true,
      score: 0,
      label: "Highly variable",
      matchesConsidered: qualifying.length,
      explanation: "No meaningful contribution recorded across recent matches.",
    };
  }

  const variance = rates.reduce((sum, v) => sum + (v - mean) ** 2, 0) / rates.length;
  const stdev = Math.sqrt(variance);
  const coefficientOfVariation = stdev / mean;
  const score = Math.max(0, Math.min(10, 10 - coefficientOfVariation * 10));
  const rounded = Math.round(score * 10) / 10;
  const label = labelFor(rounded);

  const explanation =
    label === "High consistency" || label === "Consistent"
      ? `Performances have stayed close to this player's own level across the last ${qualifying.length} matches.`
      : `Performances have varied noticeably across the last ${qualifying.length} matches — spectacular displays mixed with quieter ones.`;

  return { available: true, score: rounded, label, matchesConsidered: qualifying.length, explanation };
}
