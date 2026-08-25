import type { NewsCategory } from "@/lib/ingestion/fpl/ingestPlayerNews";

/**
 * PLAYER AVAILABILITY INTELLIGENCE
 * ==========================================================================
 * See docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md for the full investigation
 * and rationale. This is a deliberately small, separate layer — it answers
 * one question ("is this player currently expected to be available?") and
 * is never blended into Performance/Form/Momentum/Consistency/Match Rating/
 * Archetypes. Nothing in lib/analytics/scoring or lib/analytics/intelligence
 * reads from this module, and nothing here reads from those beyond the
 * read-only "does this player have a meaningful Performance score" check
 * used for future relevance filtering (see repository.ts).
 *
 * Only two states are ever surfaced. There is no "available"/"likely
 * available" state to render — see docs §5 "Visibility rule": absence of a
 * concern is communicated by rendering nothing, never by asserting fitness
 * we cannot back with data.
 */
export type AvailabilityState = "unavailable" | "doubtful";

export interface PlayerAvailability {
  state: AvailabilityState;
  /** Reuses the News Layer's own category — never a separate taxonomy. */
  category: NewsCategory;
  /** Short, factual, e.g. "Injured", "Suspended", "No longer at the club", "Doubtful". */
  label: string;
  /**
   * FPL's own explanatory text, verbatim — only present when a linked news
   * item exists AND is fresh enough to trust (see docs §7 "Freshness").
   * Null does not mean "no issue" — the bare label/state already established
   * that; it means we have nothing safe/current to add beyond the label.
   */
  detail: string | null;
  /**
   * FPL's structured percentage — only ever meaningful (25/50/75) when
   * state is "doubtful"; always null otherwise, since it is always exactly
   * 0 for every other visible state (verified in docs §1) and would add
   * nothing but clutter.
   */
  chanceOfPlayingNextRound: number | null;
  /** When the underlying note was last set by FPL — null if unknown/stale-filtered. */
  updatedAt: Date | null;
  sourceName: string;
}
