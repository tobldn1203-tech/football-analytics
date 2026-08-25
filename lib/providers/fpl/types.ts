import { z } from "zod";

/**
 * Subset of the Fantasy Premier League API we actually consume. Narrow and
 * validated with Zod at the provider boundary — see docs/DATA_SOURCES.md
 * for how each field's meaning was confirmed.
 */
export const FplTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_name: z.string(),
  /// Used to build the official Premier League crest URL — see lib/assets.
  code: z.number(),
});
export type FplTeam = z.infer<typeof FplTeamSchema>;

export const FplElementTypeSchema = z.object({
  id: z.number(),
  singular_name_short: z.string(), // "GKP" | "DEF" | "MID" | "FWD"
});
export type FplElementType = z.infer<typeof FplElementTypeSchema>;

export const FplEventSchema = z.object({
  id: z.number(),
  finished: z.boolean(),
  is_current: z.boolean(),
  deadline_time: z.string(),
});
export type FplEvent = z.infer<typeof FplEventSchema>;

/** A decimal-as-string field, as the FPL API represents most rate stats. */
const numericString = z
  .string()
  .transform((v) => Number(v))
  .pipe(z.number());

export const FplPlayerSchema = z.object({
  id: z.number(),
  web_name: z.string(),
  first_name: z.string(),
  second_name: z.string(),
  team: z.number(),
  element_type: z.number(), // 1 GK, 2 DEF, 3 MID, 4 FWD
  status: z.string(), // "a" available, "i" injured, "s" suspended, ...
  minutes: z.number(),
  form: numericString,
  ict_index: numericString,
  /// e.g. "154561.jpg" — used to build the official player photo URL, see lib/assets.
  photo: z.string(),
  /// Used only as a disambiguating match key for nationality enrichment
  /// (see lib/ingestion/nationality) — never persisted or displayed.
  /// FPL also exposes an undocumented `region` integer with no reliable
  /// public country mapping; deliberately not modelled here at all.
  birth_date: z.string().nullable().optional(),
  /// FPL's own short editorial status note (injury/suspension/transfer),
  /// e.g. "Groin injury - Unknown return date" — see
  /// docs/NEWS_LAYER_RESEARCH.md §6 and lib/ingestion/fpl/ingestPlayerNews.ts.
  /// Empty string when there's nothing to report; never fabricated.
  news: z.string().nullable().optional(),
  /// Timestamp the `news` text was last set/changed — used both as the
  /// News Layer's publishedAt and as the dedup key (a new value here means
  /// FPL updated the note, so it's a new news item; an unchanged value
  /// means nothing changed since the last ingestion run).
  news_added: z.string().nullable().optional(),
  chance_of_playing_next_round: z.number().nullable().optional(),
});
export type FplPlayer = z.infer<typeof FplPlayerSchema>;

export const FplBootstrapSchema = z.object({
  teams: z.array(FplTeamSchema),
  element_types: z.array(FplElementTypeSchema),
  elements: z.array(FplPlayerSchema),
  events: z.array(FplEventSchema),
});
export type FplBootstrap = z.infer<typeof FplBootstrapSchema>;

// --- Fixtures (match + event-level attribution) ---

const FplFixtureStatValue = z.object({ value: z.number(), element: z.number() });
const FplFixtureStat = z.object({
  identifier: z.string(),
  a: z.array(FplFixtureStatValue),
  h: z.array(FplFixtureStatValue),
});

export const FplFixtureSchema = z.object({
  id: z.number(),
  event: z.number().nullable(),
  kickoff_time: z.string().nullable(),
  finished: z.boolean(),
  // FPL sets `finished` only once bonus points/data are fully locked in,
  // which can lag kickoff by hours or more — `finished_provisional` flips
  // true as soon as full-time stats (score, goals, cards, ...) are in, and
  // is what we actually gate ingestion on. See docs/DATA_SOURCES.md.
  finished_provisional: z.boolean(),
  team_h: z.number(),
  team_a: z.number(),
  team_h_score: z.number().nullable(),
  team_a_score: z.number().nullable(),
  stats: z.array(FplFixtureStat),
});
export type FplFixture = z.infer<typeof FplFixtureSchema>;
export type FplFixtureStatT = z.infer<typeof FplFixtureStat>;

// --- Gameweek live stats (minutes, xG/xA, defensive actions per player) ---

export const FplEventLiveElementSchema = z.object({
  id: z.number(),
  stats: z.object({
    minutes: z.number(),
    starts: z.number().optional().default(0), // 1 if they started this fixture, else 0
    expected_goals: numericString,
    expected_assists: numericString,
    expected_goals_conceded: numericString,
    defensive_contribution: z.number().optional().default(0),
    // Component breakdown of defensive_contribution — reported separately by
    // this same endpoint but previously discarded on ingestion. See
    // docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md §9. Not consumed by any
    // scoring formula yet; stored as richer raw data only. Same
    // optional/default(0) convention as defensive_contribution above, for
    // the rare case a provider payload omits one.
    tackles: z.number().optional().default(0),
    clearances_blocks_interceptions: z.number().optional().default(0),
    recoveries: z.number().optional().default(0),
    ict_index: numericString,
  }),
});
export type FplEventLiveElement = z.infer<typeof FplEventLiveElementSchema>;

export const FplEventLiveSchema = z.object({
  elements: z.array(FplEventLiveElementSchema),
});
export type FplEventLive = z.infer<typeof FplEventLiveSchema>;
