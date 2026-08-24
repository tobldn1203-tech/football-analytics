import type { SquadMember, MatchEventEntry, CardEntry } from "@/lib/analytics/scoring/matchRepository";
import type { VoiceLine } from "@/lib/analytics/voice/types";
import type { ConceptContext } from "@/lib/analytics/voice/context";
import { describePlayerVoice, describeMatchVoice, type PlayerVoiceInput, type MatchVoiceInput } from "@/lib/analytics/voice/orchestrator";
import { classifyResult } from "@/lib/analytics/voice/situation";

/**
 * MATCH STORY — deterministic, data-grounded football language
 * ================================================================
 * Everything here is a template over numbers the Match Rating / scoring
 * engine already produced — never an LLM, never an invented fact. See
 * lib/analytics/story/seasonStory.ts for the same discipline applied at
 * season level, and lib/analytics/voice/ (docs/FOOTBALL_VOICE_REDESIGN.md)
 * for the shared, reusable football-language layer this module is the
 * first real consumer of.
 *
 * DELIBERATELY NOT CLAIMED, because the data doesn't support it (see
 * docs/MATCH_CENTRE_DATA_AUDIT.md §2–3): "late equaliser" or any other
 * minute-relative claim (no event timestamps), "comeback" (no half-time
 * score), penalty/own-goal detail (not ingested), momentum, tactical
 * dominance, shot quality, possession, or anything about "how the match
 * unfolded" over time. Result-shape language (narrow/comfortable/rout)
 * describes only the final margin, never the run of play.
 */

/**
 * The Match Standout's narrative — see lib/analytics/voice/orchestrator.ts
 * for the level selection (Level 3 humour only when a real mechanism
 * fires; Level 1/2 otherwise). `evidence` is always rendered wherever this
 * is shown; `observation` is the level-appropriate line above it.
 */
export function describeStandout(
  member: Pick<SquadMember, "playerId" | "name" | "position" | "minutes" | "started" | "goals" | "assists" | "yellowCards" | "redCards">,
  teamShortName: string,
  score: number,
  label: string,
  categoryScores: PlayerVoiceInput["categoryScores"],
  teammates: PlayerVoiceInput["teammates"],
  context?: ConceptContext
): VoiceLine {
  return describePlayerVoice({
    playerId: member.playerId,
    name: member.name,
    teamShortName,
    position: member.position,
    minutes: member.minutes,
    started: member.started,
    goals: member.goals,
    assists: member.assists,
    yellowCards: member.yellowCards,
    redCards: member.redCards,
    rating: { score, label },
    categoryScores,
    teammates,
    context,
  });
}

export interface MatchNarrativeArgs {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scorers: MatchEventEntry[];
  cards: CardEntry[];
  /** Team Performance ratings — needed for the PLOT_ARMOUR concept (see concepts.ts). Optional; omit or pass null to skip that mechanism. */
  homeTeamRating?: number | null;
  awayTeamRating?: number | null;
}

/**
 * The "what happened?" narrative. The result line is plain fact by
 * default — a Level-3 addendum is appended ONLY when a real match-level
 * mechanism fires (a routine rout, a card-heavy low-scoring game, a clean
 * sheet earned the hard way); most matches correctly get none. The
 * standout player is deliberately NOT repeated here — they get their own
 * dedicated section immediately below.
 */
export function buildMatchNarrative(args: MatchNarrativeArgs): string {
  const { homeTeam, awayTeam, homeScore, awayScore, status, scorers, cards, homeTeamRating = null, awayTeamRating = null } = args;

  if (status !== "finished" || homeScore === null || awayScore === null) {
    return `${homeTeam} vs ${awayTeam} — not yet played.`;
  }

  const category = classifyResult(homeScore, awayScore);
  const higher = Math.max(homeScore, awayScore);
  const lower = Math.min(homeScore, awayScore);
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const loser = homeScore > awayScore ? awayTeam : awayScore > homeScore ? homeTeam : null;

  let resultLine: string;
  switch (category) {
    case "goalless_draw":
      resultLine = `${homeTeam} and ${awayTeam} played out a goalless draw.`;
      break;
    case "draw":
      resultLine = `${homeTeam} and ${awayTeam} drew ${homeScore}–${awayScore}.`;
      break;
    case "narrow":
      resultLine = `${winner} edged past ${loser} ${higher}–${lower}.`;
      break;
    default:
      resultLine = `${winner} beat ${loser} ${higher}–${lower}.`;
  }

  const scorerParts = scorers.map((s) => (s.count > 1 ? `${s.name} (${s.count})` : s.name));
  const scorerLine = scorers.length > 0 ? `Scorers: ${scorerParts.join(", ")}.` : "Neither side found the net.";

  const homeCards = cards.filter((c) => c.teamSide === "home").length;
  const awayCards = cards.filter((c) => c.teamSide === "away").length;
  const redCardCount = cards.filter((c) => c.red).length;

  const matchVoice = describeMatchVoice({
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    category,
    totalCards: cards.length,
    homeCards,
    awayCards,
    redCardCount,
    homeTeamRating,
    awayTeamRating,
  } satisfies MatchVoiceInput);

  const cleanSheetTeam = homeScore + awayScore > 0 ? (awayScore === 0 ? homeTeam : homeScore === 0 ? awayTeam : null) : null;
  const usedByCleanSheetMechanism = matchVoice?.mechanism === "cleanSheetDespiteCards";
  const cleanSheetLine = cleanSheetTeam
    ? usedByCleanSheetMechanism
      ? matchVoice!.observation
      : `${cleanSheetTeam} kept a clean sheet.`
    : "";

  const sentOff = cards.filter((c) => c.red);
  const cardLine = sentOff.length > 0 ? `${sentOff.map((c) => c.name).join(", ")} ${sentOff.length > 1 ? "were" : "was"} sent off.` : "";

  const addendum = matchVoice && !usedByCleanSheetMechanism ? matchVoice.observation : "";

  return [resultLine, scorerLine, cleanSheetLine, cardLine, addendum].filter(Boolean).join(" ");
}
