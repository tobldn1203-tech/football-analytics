/**
 * DEFAULT GAMEWEEK SELECTION
 * ==========================================================================
 * Picks which gameweek `/matches` should open on when the user hasn't
 * explicitly chosen one, using only real fixture kickoff dates already in
 * the database — never the highest-numbered or most-recently-ingested
 * gameweek, and never FPL's own `is_current` flag (parsed but never
 * persisted anywhere in this app). Explicit `/matches/[gameweek]`
 * navigation never calls this — it takes its gameweek straight from the
 * URL, unaffected by anything here.
 *
 * Deliberately status-agnostic: a gameweek's window is its fixtures'
 * earliest/latest kickoff, full stop — whether those fixtures are
 * finished, scheduled, or postponed never enters into it. That's what
 * keeps a stale postponed fixture in an old gameweek from ever competing
 * with a genuinely current one: an old gameweek's dates stay in the past
 * regardless of whether every one of its matches has finished.
 */

export interface GameweekWindow {
  gameweek: number;
  /** Earliest fixture kickoff in this gameweek. */
  earliestKickoff: Date;
  /** Latest fixture kickoff in this gameweek. */
  latestKickoff: Date;
}

/**
 * How long after a gameweek's LAST kickoff it's still treated as "in
 * progress". Kickoff is the only per-fixture timestamp this app stores —
 * there's no final-whistle time — so this covers a realistic match length
 * (90 minutes + half-time + stoppage) plus a safety margin, rather than
 * treating a gameweek as "over" the instant its last match starts.
 */
const IN_PROGRESS_ALLOWANCE_MS = 3 * 60 * 60 * 1000;

/**
 * Returns the gameweek number `/matches` should default to, or null if
 * there are no gameweeks to choose from. Pure and synchronous — all the
 * date math a test needs to exercise directly, no database involved.
 */
export function pickDefaultGameweek(windows: GameweekWindow[], now: Date = new Date()): number | null {
  if (windows.length === 0) return null;
  const sorted = [...windows].sort((a, b) => a.gameweek - b.gameweek);
  const nowMs = now.getTime();

  // 1. A gameweek currently in progress always wins outright — no distance
  // comparison needed. If two windows somehow overlap (not expected with
  // real fixture data), the earliest-numbered one is kept, since `sorted`
  // is ascending and this is the first match found.
  const inProgress = sorted.find(
    (w) => nowMs >= w.earliestKickoff.getTime() && nowMs <= w.latestKickoff.getTime() + IN_PROGRESS_ALLOWANCE_MS
  );
  if (inProgress) return inProgress.gameweek;

  // 2. Otherwise, the gameweek whose window is closest to now — measured
  // from whichever edge is nearer (its first kickoff if it's still ahead,
  // its last kickoff if it's already passed). On an exact tie, prefer the
  // upcoming gameweek over the completed one — a forward-looking default
  // reads better than sending someone back to a gameweek that just ended.
  let best: { gameweek: number; distanceMs: number; isUpcoming: boolean } | null = null;
  for (const w of sorted) {
    const startMs = w.earliestKickoff.getTime();
    const endMs = w.latestKickoff.getTime();
    const isUpcoming = nowMs < startMs;
    const distanceMs = isUpcoming ? startMs - nowMs : nowMs - endMs;
    const isBetter =
      !best ||
      distanceMs < best.distanceMs ||
      (distanceMs === best.distanceMs && isUpcoming && !best.isUpcoming);
    if (isBetter) best = { gameweek: w.gameweek, distanceMs, isUpcoming };
  }
  return best!.gameweek;
}
