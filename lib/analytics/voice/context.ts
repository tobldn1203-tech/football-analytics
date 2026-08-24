/**
 * FOOTBALL VOICE — concept context
 * ====================================
 * The explicit "room to grow into" the brief asked for: a typed contract
 * for the contextual signals a concept detector (mechanisms.ts) can
 * consume, so that wiring up a new context source later means populating
 * a new field here, not redesigning the detector plumbing.
 *
 * Every field is OPTIONAL, and `undefined` must always be treated by a
 * detector as "this context isn't available — don't guess", never as a
 * neutral/false value. Only `seasonBaseline` is populated with real data
 * today (see lib/analytics/scoring/matchRepository.ts) — the rest are
 * named, typed, and unused, which is the correct state for a signal this
 * app has no honest source for yet.
 */

export interface SeasonBaseline {
  /** The player's own season-to-date Performance score (same number shown on their player page) — not this match's score. */
  score: number;
  /** Only "established" (8+ matches) should ever be compared against — see baselineDivergence in mechanisms.ts for why a thin sample can't support this comparison. */
  confidence: "low" | "moderate" | "established";
}

/**
 * A tracked public narrative about a specific subject (player, manager, or
 * team) — e.g. "under pressure", "recently criticised", "transfer
 * speculation". No implementation exists yet; this exists purely as the
 * named slot AGENDA/PROPAGANDA/APOLOGY_FORM/THE_ALLEGATIONS/LEGACY_GAME
 * would read from once a real narrative-tracking source is built.
 */
export interface NarrativeTag {
  subject: string;
  tag: "under_pressure" | "recently_criticised" | "transfer_speculation" | "off_pitch_story";
}

/**
 * A subject's broad public reputation — the slot HATE_WATCH would read
 * from once a real sentiment/reputation data source exists. Not populated
 * by anything today; this app has no such source (see
 * docs/FOOTBALL_VOICE_REDESIGN.md — deliberately not built this pass).
 */
export type Reputation = "widely_disliked" | "widely_loved" | "neutral";

export interface ConceptContext {
  seasonBaseline?: SeasonBaseline;
  narrativeTags?: NarrativeTag[];
  reputation?: Reputation;
}
