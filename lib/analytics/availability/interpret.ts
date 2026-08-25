import { classifyPlayerNews } from "@/lib/ingestion/fpl/ingestPlayerNews";
import type { PlayerAvailability } from "./types";

/**
 * How long a linked news item's free-text explanation stays trustworthy
 * enough to show. Chosen, not measured: verified live data (docs
 * §1/§2) shows FPL's news/status/chance fields moving together on every
 * ingestion, so no real staleness has yet been observed — this window
 * exists as a safety margin for the day one eventually does occur, sized
 * to comfortably exceed FPL's normal weekly update cadence. The
 * underlying `state`/`label`/`chanceOfPlayingNextRound` are never gated
 * by this — they come from `status`, which is refreshed on every
 * ingestion run and is authoritative for "now" by construction.
 */
export const NEWS_DETAIL_FRESHNESS_DAYS = 14;

/**
 * Only "injury" and "availability" (the doubtful/graded case) describe an
 * open-ended fitness estimate that can go out of date — that's the exact
 * risk the freshness window exists for. Discovered against real live data
 * while implementing this: applying the same window to "suspension"
 * (states a hard end date, e.g. "Suspended until 19 Sep" — still accurate
 * and useful however long ago it was written) and "transfer" (a discrete,
 * permanent, one-time fact, e.g. "Has joined Paris Saint-Germain
 * permanently") incorrectly hid a genuinely current, still-true note
 * (Digne's transfer, written 15 days earlier) — see
 * docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §"Limitations discovered".
 */
const CATEGORIES_THAT_CAN_GO_STALE = new Set(["injury", "availability"]);

const LABEL_BY_STATUS: Record<string, string> = {
  i: "Injured",
  s: "Suspended",
  // Verified against every current live 'u' example (docs §1): always a
  // permanent departure or loan-out, never an injury/suspension. "No
  // longer at the club" is the safe, literal description — not "on loan"
  // specifically, since some are permanent transfers.
  u: "No longer at the club",
  d: "Doubtful",
};

export interface LatestNewsInput {
  description: string;
  publishedAt: Date;
  sourceName: string;
}

export interface InterpretAvailabilityInput {
  /** FPL's current status code — "a" | "i" | "s" | "u" | "d" | (defensively, anything else). */
  status: string;
  /** FPL's current chance_of_playing_next_round — see docs §1 for why this is trusted as-is. */
  chanceOfPlayingNextRound: number | null;
  /** The player's most recent NewsItem, if one exists. */
  latestNews: LatestNewsInput | null;
  now?: Date;
}

/**
 * Pure interpretation of a player's current availability. Returns null
 * whenever there is nothing meaningful to surface — an available player,
 * or a status code this app doesn't recognise (never guessed at). Never
 * returns a claim of fitness: "no information" and "available" are always
 * kept distinct by simply not rendering anything for either (see
 * docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §5).
 */
export function interpretPlayerAvailability(
  input: InterpretAvailabilityInput
): PlayerAvailability | null {
  const { status, chanceOfPlayingNextRound, latestNews, now = new Date() } = input;

  // "a" (available) is deliberately not a visible state at all — see docs
  // §5. A residual chance=100 sometimes lingers on a freshly-recovered
  // player (docs §1) but is functionally identical to null for our
  // purposes, so it's never inspected here.
  if (status === "a") return null;

  const label = LABEL_BY_STATUS[status];
  if (!label) return null; // unrecognised status code — no meaningful info, never guessed

  const state = status === "d" ? "doubtful" : "unavailable";
  const category = classifyPlayerNews(status);

  const withinFreshnessWindow =
    latestNews != null &&
    now.getTime() - latestNews.publishedAt.getTime() <= NEWS_DETAIL_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
  const isFresh =
    latestNews != null &&
    (!CATEGORIES_THAT_CAN_GO_STALE.has(category) || withinFreshnessWindow);

  return {
    state,
    category,
    label,
    detail: isFresh ? latestNews!.description : null,
    // Only ever meaningful for "doubtful" — verified always exactly 0 for
    // every other visible state (docs §1), so showing it there would only
    // be noise, not information.
    chanceOfPlayingNextRound: state === "doubtful" ? chanceOfPlayingNextRound : null,
    updatedAt: isFresh ? latestNews!.publishedAt : null,
    sourceName: isFresh ? latestNews!.sourceName : "Fantasy Premier League",
  };
}
