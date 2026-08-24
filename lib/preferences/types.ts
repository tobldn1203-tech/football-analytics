/**
 * PERSONALISATION FOUNDATION — preference model (v1, deliberately minimal)
 * ==========================================================================
 * The only preference this app tracks today is which Premier League club
 * the user supports — everything else considered earlier (followed
 * players, discovery interests, favourite competition) was cut back out on
 * purpose, not forgotten. Keep this file to exactly what's needed; add
 * fields only when a real feature needs them.
 *
 * Shaped so a later migration to authenticated, database-backed accounts
 * is a storage-layer swap (see lib/preferences/store.ts), not a data-model
 * rewrite.
 */

export interface UserPreferences {
  /** A `Team.id`, or null if the user hasn't picked one. */
  supportedClubId: string | null;
  /** Has the user seen and dismissed (skipped or completed) the club-picker prompt? Prevents it re-nagging on every visit once dismissed either way. */
  promptDismissed: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  supportedClubId: null,
  promptDismissed: false,
};
