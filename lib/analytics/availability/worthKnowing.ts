import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { QUALITY_BANDS } from "@/lib/analytics/scoring/types";
import type { PositionCode } from "@/lib/competitions/premier-league";
import type { PlayerAvailability } from "./types";
import { describeAvailabilityDetail, formatAvailabilityContext } from "./describe";
import { describeWorthKnowingVoice } from "@/lib/analytics/voice/insightVoice";
import type { VoiceLine } from "@/lib/analytics/voice/types";

/**
 * "WORTH KNOWING" — availability × performance insight
 * ==========================================================================
 * See docs/NEWS_CONTEXT_PRODUCT_DESIGN.md §3/§6 for the product reasoning
 * this implements: raw availability data is mostly noise (most currently
 * unavailable players never cleared the ranking engine's minutes floor) —
 * it becomes genuine intelligence only when cross-referenced against a
 * player's EXISTING, already-computed Performance score. This module does
 * that cross-reference and nothing else: no new scoring, no new
 * ingestion, no DB access (see repository.ts callers for that) — just
 * composition over two things the app already has.
 *
 * Deliberately pure and framework-free so it's fully unit-testable and so
 * both My Football and Team Intelligence can call the exact same function
 * rather than each inventing their own version of "is this noteworthy".
 */

/**
 * The same "this stands out" bar used everywhere else in the app for a
 * single-match/season score (Match Centre's MATCH_STRENGTH_MIN, Team
 * Intelligence's own STRENGTH_MIN) — reused via QUALITY_BANDS' own
 * "Good" threshold rather than a third private copy of the number 5.5.
 */
const STRONG_PERFORMER_THRESHOLD = QUALITY_BANDS.find((b) => b.label === "Good")!.min;

export type WorthKnowingTier =
  | "top_performer_multiple" // the club's highest-rated player affected, alongside at least one other strong performer
  | "top_performer_single" // the club's highest-rated player affected, alone
  | "multiple_strong" // two or more strong performers affected, not including an unambiguous #1
  | "one_strong" // exactly one strong (but not the outright top) performer affected
  | "meaningful_player"; // no strong performer affected, but a player who has genuinely featured is

export interface WorthKnowingPlayer {
  playerId: string;
  slug: string;
  name: string;
  position: PositionCode;
  photoUrl: string | null;
  nationality?: string | null;
  nationalityCode?: string | null;
  score: number;
  qualityLabel: string;
  availability: PlayerAvailability;
}

export interface WorthKnowingInsight {
  tier: WorthKnowingTier;
  /** Always factual, always present, never dependent on the voice line. */
  headline: string;
  /**
   * SIGNAL → CONTEXT (see docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md
   * Part 1): a compact second sentence naming up to the 2 most important
   * affected players' actual reason/timeframe, e.g. "Hinshelwood is a
   * doubt — thigh injury · 75% chance of playing next match." Null
   * whenever none of the affected players have fresh, extractable detail
   * — the graceful fallback to the headline alone.
   */
  context: string | null;
  /** Every player this insight is actually about — sorted by score, descending. */
  players: WorthKnowingPlayer[];
  /** Only ever populated for the strongest tier, and only sometimes even then — see insightVoice.ts. Never replaces `headline`. */
  voice: VoiceLine | null;
}

/** Named players a context sentence will ever mention — see docs Part 1: "prioritise the most important players rather than dumping the entire squad." */
const MAX_NAMED_IN_CONTEXT = 2;

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** One player's compact clause for the context sentence — always built from `formatAvailabilityContext`, never a separate phrasing. */
function contextClauseFor(name: string, availability: PlayerAvailability): string {
  if (availability.category === "suspension" || availability.category === "transfer") {
    return `${name} is ${lowerFirst(formatAvailabilityContext(availability))}`;
  }
  const lead = availability.state === "doubtful" ? "a doubt" : "out";
  return `${name} is ${lead} — ${lowerFirst(formatAvailabilityContext(availability))}`;
}

/**
 * SIGNAL → CONTEXT: builds the optional second sentence naming up to
 * MAX_NAMED_IN_CONTEXT players' real reason/timeframe. Returns null when
 * none of the group has any extractable detail — falling back to the
 * headline alone is exactly the "no meaningful contextual information"
 * behaviour the brief asked for, not a bug.
 */
function buildContextLine(subject: Array<{ player: RankedPlayer; availability: PlayerAvailability }>): string | null {
  const withDetail = subject.filter((x) => {
    const { reason, timeframe } = describeAvailabilityDetail(x.availability);
    return reason !== null || timeframe !== null || x.availability.detail !== null;
  });
  if (withDetail.length === 0) return null;

  const named = [...withDetail].sort((a, b) => (b.player.scores.overall ?? 0) - (a.player.scores.overall ?? 0)).slice(0, MAX_NAMED_IN_CONTEXT);
  return named.map((x) => contextClauseFor(x.player.name, x.availability)).join("; ") + ".";
}

function countWord(n: number): string {
  if (n === 1) return "One";
  if (n === 2) return "Two";
  if (n === 3) return "Three";
  return "Several";
}

/**
 * A factual predicate for one or more players sharing the SAME
 * availability category — e.g. "is currently doubtful" / "are currently
 * injured". Returns null when the group's categories aren't uniform,
 * since a single verb can't honestly describe a mixed group (see the
 * caller, which falls back to a neutral phrase in that case rather than
 * guessing a shared status that isn't actually shared).
 */
function sharedPredicate(group: PlayerAvailability[], plural: boolean): string | null {
  const categories = new Set(group.map((a) => a.category));
  if (categories.size !== 1) return null;
  const be = plural ? "are" : "is";
  switch (group[0].category) {
    case "injury":
      return `${be} currently injured`;
    case "suspension":
      return `${be} currently suspended`;
    case "transfer":
      return `${be} no longer at the club`;
    case "availability":
    default:
      return `${be} currently doubtful`;
  }
}

function toWorthKnowingPlayer(p: RankedPlayer, availability: PlayerAvailability): WorthKnowingPlayer {
  return {
    playerId: p.playerId,
    slug: p.slug,
    name: p.name,
    position: p.position,
    photoUrl: p.photoUrl,
    nationality: p.nationality,
    nationalityCode: p.nationalityCode,
    score: p.scores.overall ?? 0,
    qualityLabel: p.qualityLabel,
    availability,
  };
}

/**
 * The one reusable rule for "is this club's availability situation
 * genuinely worth surfacing" — see docs' insight hierarchy. Returns null
 * whenever the evidence doesn't clear the bar; a null result is exactly
 * as important as a populated one (see
 * lib/analytics/availability/__tests__/worthKnowing.test.ts).
 */
export function buildWorthKnowingInsight(
  teamName: string,
  players: RankedPlayer[],
  availabilityByPlayerId: Map<string, PlayerAvailability>
): WorthKnowingInsight | null {
  if (players.length === 0) return null;

  // Every player considered here already cleared the ranking engine's own
  // minimum-minutes floor to exist in `players` at all — that's the
  // entire "only 6 of 119" filter from the research doc, already applied
  // upstream by whichever repository call produced this array. Nothing
  // here re-derives or loosens that.
  const ranked = [...players].sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0) || a.name.localeCompare(b.name));
  const top = ranked[0];
  const second = ranked[1];
  // A superlative claim ("their highest-rated player") requires the top
  // spot to be unambiguous (no tie) AND backed by more than a single
  // early-season match — see docs Part 9. Below "moderate" (3+ matches),
  // the gap between #1 and #2 is not something this app is willing to
  // assert confidently, no matter how large the numeric gap looks.
  const topIsUnambiguous =
    top.sample.confidence !== "low" && (second === undefined || (top.scores.overall ?? 0) > (second.scores.overall ?? 0));

  const affected = ranked
    .map((p) => ({ player: p, availability: availabilityByPlayerId.get(p.playerId) }))
    .filter((x): x is { player: RankedPlayer; availability: PlayerAvailability } => x.availability !== undefined);

  if (affected.length === 0) return null;

  const strong = affected.filter((x) => (x.player.scores.overall ?? 0) >= STRONG_PERFORMER_THRESHOLD);
  // Deliberately derived from `strong`, not `affected`: the club's #1
  // player only earns the "highest-rated" framing if they actually clear
  // the strong-performer bar themselves — a squad with nobody above it
  // should never describe its (still mediocre) top scorer as a standout.
  const topAffected = topIsUnambiguous ? strong.find((x) => x.player.playerId === top.playerId) : undefined;

  let tier: WorthKnowingTier;
  let subject: typeof affected;
  let headline: string;

  if (topAffected && strong.length >= 2) {
    tier = "top_performer_multiple";
    subject = strong;
    const predicate = sharedPredicate(
      strong.map((x) => x.availability),
      true
    );
    headline = predicate
      ? `${countWord(strong.length)} of ${teamName}'s best performers this season — including ${top.name}, their highest-rated player — ${predicate}.`
      : `${countWord(strong.length)} of ${teamName}'s best performers this season, including their highest-rated player ${top.name}, have fitness or availability concerns right now.`;
  } else if (topAffected) {
    tier = "top_performer_single";
    subject = [topAffected];
    const predicate = sharedPredicate([topAffected.availability], false) ?? "has a fitness or availability concern right now";
    headline = `${teamName}'s highest-rated performer this season, ${top.name}, ${predicate}.`;
  } else if (strong.length >= 2) {
    tier = "multiple_strong";
    subject = strong;
    const predicate = sharedPredicate(
      strong.map((x) => x.availability),
      true
    );
    headline = predicate
      ? `${countWord(strong.length)} of ${teamName}'s strongest performers this season ${predicate}.`
      : `${countWord(strong.length)} of ${teamName}'s strongest performers this season have fitness or availability concerns right now.`;
  } else if (strong.length === 1) {
    tier = "one_strong";
    subject = strong;
    const predicate = sharedPredicate([strong[0].availability], false) ?? "has a fitness or availability concern right now";
    headline = `One of ${teamName}'s stronger performers this season, ${strong[0].player.name}, ${predicate}.`;
  } else {
    // No one clears the "strong" bar — only surface the single most
    // notable remaining player, and only when their own sample is at
    // least "moderate": a player who has featured for one match at a
    // below-Good score isn't yet established enough to call "meaningful"
    // (see docs Part 9 — softer language or no surfacing, not a strong claim).
    const meaningful = affected.find((x) => x.player.sample.confidence !== "low");
    if (!meaningful) return null;
    tier = "meaningful_player";
    subject = [meaningful];
    const predicate = sharedPredicate([meaningful.availability], false) ?? "has a fitness or availability concern right now";
    headline = `${meaningful.player.name}, who has featured for ${teamName} this season, ${predicate}.`;
  }

  const voice = describeWorthKnowingVoice({
    tier,
    teamName,
    players: subject.map((x) => ({ name: x.player.name, category: x.availability.category })),
  });

  return {
    tier,
    headline,
    context: buildContextLine(subject),
    players: subject.map((x) => toWorthKnowingPlayer(x.player, x.availability)),
    voice,
  };
}
