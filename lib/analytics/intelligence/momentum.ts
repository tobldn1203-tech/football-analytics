import type { MatchLogEntry } from "@/lib/analytics/scoring/provisional";
import type { MomentumMetric, MomentumDirection } from "./types";

/**
 * Momentum — "is this player's performance improving or declining?"
 *
 * Compares a short recent window against the player's own season-long
 * baseline (not the league's) — "is Player doing better than *they*
 * normally do right now," not "better than everyone else." Simple by
 * design (§19 of the brief this was built against explicitly asks for a
 * robust first version, not a predictive model): recent-3-match average
 * per-90 `bps` vs season-long average per-90 `bps`.
 *
 * Needs a real "before" to compare the "now" against — with fewer than
 * MIN_QUALIFYING_MATCHES matches, momentum is marked unavailable rather
 * than reporting a direction computed from the same 1–2 matches twice.
 */

const MIN_MATCH_MINUTES = 20;
const RECENT_WINDOW = 3;
const MIN_QUALIFYING_MATCHES = 4;

function per90(bps: number, minutes: number): number {
  return minutes > 0 ? (bps / minutes) * 90 : 0;
}

export function computeMomentum(matchLog: MatchLogEntry[]): MomentumMetric {
  const qualifying = matchLog.filter((m) => m.minutes >= MIN_MATCH_MINUTES);

  if (qualifying.length < MIN_QUALIFYING_MATCHES) {
    return {
      available: false,
      direction: "STABLE",
      magnitude: 0,
      label: "Not enough matches yet",
      explanation: "Too few matches so far to judge a trend.",
    };
  }

  const recent = qualifying.slice(0, RECENT_WINDOW);
  const recentMinutes = recent.reduce((sum, m) => sum + m.minutes, 0);
  const recentBps = recent.reduce((sum, m) => sum + m.bps, 0);
  const recentRate = per90(recentBps, recentMinutes);

  const seasonMinutes = qualifying.reduce((sum, m) => sum + m.minutes, 0);
  const seasonBps = qualifying.reduce((sum, m) => sum + m.bps, 0);
  const baselineRate = per90(seasonBps, seasonMinutes);

  const magnitude = Math.round((recentRate - baselineRate) * 10) / 10;
  const threshold = Math.max(3, baselineRate * 0.25);

  let direction: MomentumDirection = "STABLE";
  if (magnitude > threshold) direction = "RISING";
  else if (magnitude < -threshold) direction = "FALLING";

  const explanation =
    direction === "RISING"
      ? `Recent performances are above this player's season level.`
      : direction === "FALLING"
        ? `Recent performances have dropped below this player's season level.`
        : `Recent performances are in line with this player's season level.`;

  const label = direction === "RISING" ? "Rising" : direction === "FALLING" ? "Falling" : "Stable";

  return { available: true, direction, magnitude, label, explanation };
}
