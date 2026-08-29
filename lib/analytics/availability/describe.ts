import type { PlayerAvailability } from "./types";

/**
 * AVAILABILITY WATCH 2.0 — reason/timeframe extraction
 * ==========================================================================
 * See docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md Part 1. FPL's own
 * `news` text for injury/doubtful statuses is a consistently templated
 * string, verified against live 2026/27 data — always either:
 *   "<Reason> injury - Unknown return date"
 *   "<Reason> injury - Expected back <D Mon>"
 *   "<Reason> - <N>% chance of playing"
 * Splitting on " - " is reading a second field FPL already encodes inside
 * one string, not inferring anything — every entry checked (100+) fit this
 * shape exactly. Suspension ("Suspended until 19 Sep") and transfer
 * ("Has joined X permanently") text never contains this separator — it's
 * already one complete, safe clause, and is never split further.
 */

export interface AvailabilityDetail {
  /** e.g. "Thigh injury", "Knock" — only for injury/doubtful categories where FPL's text cleanly separates reason from timeframe. Null otherwise; never guessed. */
  reason: string | null;
  /** FPL's own timeframe/probability text, lightly restated for grammar only — never a different number or an invented date. Null when nothing exists. */
  timeframe: string | null;
}

function splitOnce(s: string, sep: string): [string, string | null] {
  const i = s.indexOf(sep);
  return i === -1 ? [s, null] : [s.slice(0, i), s.slice(i + sep.length)];
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Splits FPL's verbatim injury/doubtful note into a reason and a
 * timeframe. Returns nulls for suspension/transfer/general (their text is
 * already one coherent clause — see formatAvailabilityContext) and for
 * any detail that doesn't match the expected shape (shown verbatim
 * instead of guessed at — see the caller).
 */
export function describeAvailabilityDetail(availability: PlayerAvailability): AvailabilityDetail {
  const { detail, category } = availability;
  if (!detail) return { reason: null, timeframe: null };
  if (category !== "injury" && category !== "availability") return { reason: null, timeframe: null };

  const [reason, timeframeRaw] = splitOnce(detail, " - ");
  if (timeframeRaw === null) return { reason: detail, timeframe: null };

  const timeframe =
    timeframeRaw === "Unknown return date"
      ? "return date unknown"
      : /^Expected back /.test(timeframeRaw)
        ? lowerFirst(timeframeRaw)
        : /^\d+% chance of playing$/.test(timeframeRaw)
          ? `${timeframeRaw} next match` // chance_of_playing_next_round is explicitly scoped to "next round" — naming that scope restates the field, it doesn't add a claim
          : timeframeRaw; // shape didn't match a known case — show verbatim rather than guess

  return { reason, timeframe };
}

/**
 * A single compact descriptor for a player row — "Thigh injury · 75%
 * chance of playing next match", "Suspended until 19 Sep", "No longer at
 * the club — Has joined Paris Saint-Germain permanently", or the bare
 * label as a last resort when there's nothing else to show. This is the
 * one function every surface (player page, Team Intelligence rows, My
 * Football's context line) should call — never re-derive this text.
 */
export function formatAvailabilityContext(availability: PlayerAvailability): string {
  const { reason, timeframe } = describeAvailabilityDetail(availability);
  if (reason && timeframe) return `${reason} · ${timeframe}`;
  if (reason) return reason;

  if (availability.detail) {
    const repeatsLabel = availability.detail.toLowerCase().startsWith(availability.label.toLowerCase());
    return repeatsLabel ? availability.detail : `${availability.label} — ${availability.detail}`;
  }

  // The explanatory text has gone stale/absent, but `chanceOfPlayingNextRound`
  // is refreshed on every ingestion regardless of the note's age (see
  // docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §4/§7) — still current,
  // still worth showing, even with nothing else to say.
  if (availability.state === "doubtful" && availability.chanceOfPlayingNextRound != null) {
    return `${availability.label} — ${availability.chanceOfPlayingNextRound}% chance of playing next match`;
  }
  return availability.label;
}
