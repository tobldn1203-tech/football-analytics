import type { PositionCode } from "@/lib/competitions/premier-league";
import { computeProvisionalRankings, type PlayerPerformanceInput } from "./provisional";
import type { RankedPlayer } from "./types";

/**
 * MATCH-LEVEL RATING
 * ==================
 * Deliberately reuses `computeProvisionalRankings` unchanged rather than
 * building a second scoring system — see
 * docs/MATCH_CENTRE_DATA_AUDIT.md §4. Each player's ONE gameweek's stats
 * are fed in as if they were "the season", scored against every other
 * player who played that same gameweek (not just the two teams in one
 * fixture — a single match's per-position cohort is too thin, e.g. maybe
 * 4 centre-backs across both sides; a full gameweek gives ~30-40).
 *
 * This has a genuinely useful side effect, not a workaround: constructing
 * each input with `season.matches = 1` means `classifySampleConfidence`
 * always returns "low" for every match rating — which is exactly correct
 * (a match rating IS always a one-match sample) and means the
 * confidence-gated strength language already built for the season engine
 * (`explainPlayer`, `detectStrengths`) applies here automatically, with no
 * new gating logic. `matches: 1, minutes: X` also means Form ends up
 * identical to Impact for every player here (recency window = the whole
 * "season") — Form is intentionally not surfaced anywhere in the Match
 * Centre for this reason; only `overall` (Match Performance) and the
 * category breakdown (Match Strength) are used.
 *
 * The `overall` score from this pool is "Match Performance" — visually and
 * semantically distinct from season "Performance" wherever it's shown, per
 * the audit's explicit requirement. Same 0–10 scale, same category
 * weights, same position-aware Defence split; different (much smaller,
 * single-gameweek) comparison pool, which is why it is far more volatile
 * week to week than a season score and must never be presented as
 * interchangeable with one.
 *
 * MINUTES-AWARE RELIABILITY (see docs/PLAYER_INTELLIGENCE_MINUTES_DESIGN.md
 * §13) is deliberately NOT applied here — `computeProvisionalRankings` is
 * called with `{ applyReliability: false }` below. That shrinkage exists to
 * stop a *season* score from treating a handful of cameo minutes as
 * equivalent to a full season's evidence; a Match Rating's "season" is
 * intentionally always exactly one gameweek (`matches: 1` above), so
 * shrinking it toward a prior using that same gameweek's own minutes would
 * just be a second, redundant volatility dampener on a number that's
 * supposed to stay exactly as responsive to a single match as it already
 * is. A 20-minute cameo must still be able to produce an 8-9 Match Rating.
 */

export interface MatchRatingInput {
  playerId: string;
  slug: string;
  name: string;
  teamId: string;
  teamShortName: string;
  position: PositionCode;
  photoUrl: string | null;
  teamCrestUrl: string | null;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  xg: number;
  xa: number;
  defensiveActions: number;
  bps: number;
}

/** Below this, a match rating is still computed but flagged low-minutes in the UI. */
export const LOW_MINUTES_THRESHOLD = 60;

export interface MatchRating extends RankedPlayer {
  lowMinutes: boolean;
}

/**
 * Ranks every player who appeared in a single gameweek against each other.
 * Pass in every `PlayerMatchPerformance` row for that gameweek (across all
 * fixtures) — callers then filter the returned list down to one match.
 */
export function computeMatchRatings(rows: MatchRatingInput[]): MatchRating[] {
  const inputs: PlayerPerformanceInput[] = rows
    .filter((r) => r.minutes > 0)
    .map((r) => ({
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

  const { players } = computeProvisionalRankings(inputs, { applyReliability: false });
  const minutesById = new Map(rows.map((r) => [r.playerId, r.minutes]));

  return players.map((p) => ({
    ...p,
    lowMinutes: (minutesById.get(p.playerId) ?? 0) < LOW_MINUTES_THRESHOLD,
  }));
}
