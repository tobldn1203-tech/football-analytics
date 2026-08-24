/**
 * Competition configuration for the Premier League.
 *
 * This exists so nothing in `lib/analytics` or `app/` hard-codes
 * Premier-League-specific assumptions. Adding a competition later (e.g.
 * Champions League) means adding a sibling config + provider mapping here,
 * not touching the analytics engine or UI.
 */
export const PREMIER_LEAGUE = {
  id: "premier-league",
  name: "Premier League",
  shortName: "PL",
  country: "England",
} as const;

export type PositionCode = "GKP" | "DEF" | "MID" | "FWD";

/** Maps a provider's raw position identifier onto our normalized position code. */
export const FPL_ELEMENT_TYPE_TO_POSITION: Record<number, PositionCode> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export const POSITION_LABEL: Record<PositionCode, string> = {
  GKP: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};
