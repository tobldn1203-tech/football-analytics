/**
 * FOOTBALL VOICE — cultural concept catalogue
 * ===============================================
 * See docs/FOOTBALL_VOICE_REDESIGN.md addendum for the research this is
 * based on. The core distinction this file exists to enforce:
 *
 *   A concept is a MEANING ("a result a disliked team's critics enjoy"),
 *   not a PHRASE ("Good day for the hate-watchers."). The engine asks
 *   "does this situation activate a recognisable concept?" first — only
 *   once a concept is genuinely activated does phrasing get chosen, and
 *   even then from a pool, never a single fixed sentence per concept.
 *
 * Every entry states, honestly, what real data would be needed to detect
 * it. `implemented: true` means a mechanism in mechanisms.ts actually
 * detects it from data this app has today (see `signal` for which). Every
 * `implemented: false` entry is left in the catalogue deliberately — the
 * architecture (ConceptContext, in context.ts) has a named slot for the
 * context each of these needs, so wiring one up later is "populate the
 * slot with a real data source", not "redesign the system". Building
 * those data sources (reputation, live narrative tracking, transfer
 * rumours, manager pressure) is explicitly out of scope for this pass.
 */

export type ConceptKey =
  | "PLOT_ARMOUR"
  | "STOCKS_RISING"
  | "STOCKS_FALLING"
  | "AGENDA"
  | "PROPAGANDA"
  | "HATE_WATCH"
  | "FOOTBALL_HERITAGE"
  | "GENERATIONAL"
  | "THE_ALLEGATIONS"
  | "FOOTBALL_GODS"
  | "LEGACY_GAME"
  | "WE_ARE_SO_BACK"
  | "ITS_SO_OVER"
  | "FOOTBALL_TERRORISM"
  | "APOLOGY_FORM"
  | "STREETS_WONT_FORGET"
  | "SCENES"
  | "THE_SCRIPT"
  | "SHAMELESS"
  | "ANOTHER_DAY_AT_THE_OFFICE";

export interface ConceptDefinition {
  key: ConceptKey;
  /** The underlying meaning — what real-world situation this concept represents. Never itself shown to a user. */
  meaning: string;
  /** What data/context this needs to detect safely — the honest answer, even when it's "data we don't have". */
  requiresContext: string[];
  implemented: boolean;
  /** Which mechanism in mechanisms.ts detects this, when implemented. */
  mechanism?: string;
}

export const CONCEPT_CATALOGUE: ConceptDefinition[] = [
  {
    key: "PLOT_ARMOUR",
    meaning: "A team wins despite being statistically outplayed — an unlikely positive outcome the numbers didn't predict.",
    requiresContext: ["This match's Team Performance for both sides (have it)", "The final result (have it)"],
    implemented: true,
    mechanism: "plotArmour",
  },
  {
    key: "STOCKS_RISING",
    meaning: "A performance well above a player's own established season baseline — their reputation just moved, based on real form data, not just one match in isolation.",
    requiresContext: ["This match's rating (have it)", "The player's established (8+ match) season Performance score (have it, via the same scoring engine already used elsewhere)"],
    implemented: true,
    mechanism: "baselineDivergence",
  },
  {
    key: "STOCKS_FALLING",
    meaning: "A performance well below a player's own established season baseline.",
    requiresContext: ["Same as STOCKS_RISING"],
    implemented: true,
    mechanism: "baselineDivergence",
  },
  {
    key: "AGENDA",
    meaning: "A result/performance that reinforces an existing football-internet narrative about a player/manager/team — e.g. a struggling player finally scoring, read as \"proof\" by their defenders or critics alike.",
    requiresContext: ["A tracked, currently-active narrative about this specific subject (don't have — no narrative-tracking data source exists yet)"],
    implemented: false,
  },
  {
    key: "PROPAGANDA",
    meaning: "A result/performance selectively usable by supporters to support an existing narrative — closely related to AGENDA, framed from the 'defending the player' side.",
    requiresContext: ["Same as AGENDA — a tracked narrative to be 'propaganda' in support of"],
    implemented: false,
  },
  {
    key: "HATE_WATCH",
    meaning: "A result that particularly entertains people who dislike the team/player involved.",
    requiresContext: ["Some measure of a team/player's public reputation or 'most disliked' status (don't have — no sentiment/reputation data source exists)"],
    implemented: false,
  },
  {
    key: "FOOTBALL_HERITAGE",
    meaning: "A moment framed as connecting to a club's history/identity/fanbase culture in a knowing, often ironic way.",
    requiresContext: ["Club identity/culture context beyond fixtures and results (don't have)"],
    implemented: false,
  },
  {
    key: "GENERATIONAL",
    meaning: "A performance framed as historically exceptional, usually ironically applied to something merely good.",
    requiresContext: ["A genuinely defensible 'historic' bar (season-record-level data across many seasons — don't have multi-season history yet)"],
    implemented: false,
  },
  {
    key: "THE_ALLEGATIONS",
    meaning: "A knowing reference to an unresolved off-pitch storyline about a player/club.",
    requiresContext: ["Off-pitch news/story tracking (don't have — this app has no news data source at all)"],
    implemented: false,
  },
  {
    key: "FOOTBALL_GODS",
    meaning: "A result framed as karmic/deserved payback for a team/player's recent conduct.",
    requiresContext: ["A tracked prior 'wrongdoing' to be paid back for (don't have)"],
    implemented: false,
  },
  {
    key: "LEGACY_GAME",
    meaning: "A single match framed as define-your-career stakes for a manager/player under pressure.",
    requiresContext: ["Manager/player pressure or job-security context (don't have)"],
    implemented: false,
  },
  {
    key: "WE_ARE_SO_BACK",
    meaning: "Premature optimism after one good result, knowingly ironic given a recent bad run.",
    requiresContext: ["A recent bad run to be recovering from — buildable later from our own Form/Momentum history once several gameweeks exist; not reliable at 1 gameweek in"],
    implemented: false,
  },
  {
    key: "ITS_SO_OVER",
    meaning: "Premature pessimism after one bad result — the negative mirror of WE_ARE_SO_BACK.",
    requiresContext: ["Same as WE_ARE_SO_BACK"],
    implemented: false,
  },
  {
    key: "FOOTBALL_TERRORISM",
    meaning: "A deliberately absurd, hyperbolic framing of a chaotic-but-low-stakes event.",
    requiresContext: ["Judgement-heavy hyperbole register — deferred pending more real output to calibrate against, not a data gap"],
    implemented: false,
  },
  {
    key: "APOLOGY_FORM",
    meaning: "A player who was heavily doubted producing a result that (jokingly) owes their doubters/defenders an apology.",
    requiresContext: ["A tracked prior doubt/criticism narrative (don't have)"],
    implemented: false,
  },
  {
    key: "STREETS_WONT_FORGET",
    meaning: "A moment framed as instantly, permanently memorable/iconic.",
    requiresContext: ["A genuinely rare-event bar to earn this — deferred, same reasoning as GENERATIONAL"],
    implemented: false,
  },
  {
    key: "SCENES",
    meaning: "Chaotic, eventful, hard-to-summarise match energy.",
    requiresContext: ["Overlaps with the existing chaoticLowScoring/routineRout signals — a generalised 'eventfulness' register worth revisiting once more match-shape mechanisms exist"],
    implemented: false,
  },
  {
    key: "THE_SCRIPT",
    meaning: "A result that feels too neat/thematically fitting to be a coincidence — often tied to a narrative (a player scoring against a former club, etc).",
    requiresContext: ["Player transfer history / former-club relationships (don't have — no transfer history data ingested)"],
    implemented: false,
  },
  {
    key: "SHAMELESS",
    meaning: "A cynical but effective approach called out approvingly rather than critically.",
    requiresContext: ["Tactical/approach context this app doesn't capture (no possession/tactical data — see docs/MATCH_CENTRE_DATA_AUDIT.md)"],
    implemented: false,
  },
  {
    key: "ANOTHER_DAY_AT_THE_OFFICE",
    meaning: "Routine excellence from a player/team good enough that it's stopped being remarkable.",
    requiresContext: ["A track record of repeated excellence — buildable later from multi-gameweek season history; not meaningful at 1 gameweek in, same reasoning as STOCKS"],
    implemented: false,
  },
];
