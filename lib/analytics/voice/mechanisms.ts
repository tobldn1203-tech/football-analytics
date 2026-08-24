import type { Category } from "@/lib/analytics/scoring/types";
import type { PositionCode } from "@/lib/competitions/premier-league";
import type { VoiceLine } from "./types";
import type { ResultCategory } from "./situation";
import type { ConceptContext } from "./context";
import { pickOne } from "./pick";

/**
 * LEVEL 3 — Internet Football Humour: signal detectors.
 * ========================================================
 * See docs/FOOTBALL_VOICE_REDESIGN.md for the mechanism these implement:
 * real data → an ironic/absurd angle actually latent in it → stated as
 * flatly as possible. Every detector below either finds a *specific,
 * checkable* contrast/mismatch/absurdity, or returns `null`. `null` is the
 * common, correct outcome — see orchestrator.ts for what happens then.
 *
 * Nothing here invents a fact. Every `evidence` string is a direct
 * restatement of a number already computed elsewhere in the app.
 */

const MATCH_STRENGTH_MIN = 5.5;

export interface PlayerVoiceInput {
  playerId: string;
  name: string;
  teamShortName: string;
  position: PositionCode;
  minutes: number;
  started: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: { score: number; label: string } | null;
  categoryScores: Partial<Record<Category, number>>;
  /** Other rated players on the same side — needed for the substitute-outrated-the-starters mechanism. */
  teammates: Array<{ rating: { score: number } | null; started: boolean }>;
  /** Contextual signals beyond this one match — see context.ts. Optional; a detector needing a field that's absent must return null, never guess. */
  context?: ConceptContext;
}

/** A strong-to-excellent performance that still picked up a card — the "nobody's perfect" contrast. */
export function cardDespiteGoodPerformance(p: PlayerVoiceInput): VoiceLine | null {
  if (!p.rating || p.rating.score < 7.0) return null;
  if (p.yellowCards === 0 && p.redCards === 0) return null;

  const seed = p.playerId;
  const observation = p.redCards > 0
    ? pickOne(["A strong performance, ended early by a red card.", "Was one of the better players on the pitch. Then walked."], seed)
    : pickOne(
        [
          "A composed performance, capped off with a booking.",
          "Did most things right, then found time for a yellow card as well.",
          "One of the better performers on the pitch — also the one with a card next to his name.",
        ],
        seed
      );
  const evidence = `${p.rating.label} performance (${p.rating.score.toFixed(1)}) that still included ${p.redCards > 0 ? "a red card" : "a booking"}.`;
  return { level: 3, humour: "LIGHT", observation, evidence, mechanism: "cardDespiteGoodPerformance" };
}

/** An attacking player (MID/FWD) whose standout category this match was defence — a role mismatch the reader can register without it being explained. */
export function categoryMismatch(p: PlayerVoiceInput): VoiceLine | null {
  if (p.position !== "MID" && p.position !== "FWD") return null;

  const entries = (["attack", "creation", "defence"] as const).map((k) => ({ k, score: p.categoryScores[k] ?? 0 }));
  const top = entries.filter((e) => e.score >= MATCH_STRENGTH_MIN).sort((a, b) => b.score - a.score)[0];
  if (!top || top.k !== "defence") return null;

  const seed = p.playerId;
  const posWord = p.position === "MID" ? "midfielder" : "forward";
  const observation = pickOne(
    [
      `Finished the match as ${p.teamShortName}'s most productive defender. ${p.name} plays as a ${posWord}.`,
      `The numbers have this down as ${p.teamShortName}'s best defensive performance of the day. From a ${posWord}.`,
      `Officially the strongest defensive showing on the pitch for ${p.teamShortName} — not bad for a ${posWord}.`,
    ],
    seed
  );
  const evidence = `${p.name}'s defensive contribution (${top.score.toFixed(1)}) was the strongest part of the performance this match — ahead of attack or creation.`;
  return { level: 3, humour: "DRY", observation, evidence, mechanism: "categoryMismatch" };
}

/** A substitute with a brief cameo who out-rated every player who actually started. */
export function substituteOutperformedStarters(p: PlayerVoiceInput): VoiceLine | null {
  if (p.started || !p.rating || p.minutes > 30) return null;

  const startersRated = p.teammates.filter((t) => t.started && t.rating);
  if (startersRated.length === 0) return null;
  const maxStarterScore = Math.max(...startersRated.map((t) => t.rating!.score));
  if (p.rating.score <= maxStarterScore) return null;

  const seed = p.playerId;
  const observation = pickOne(
    [
      `${p.minutes} minutes was apparently all it took.`,
      `Came on, played ${p.minutes} minutes, finished with a better rating than anyone who started.`,
      `${p.minutes} minutes on the pitch. Outrated the entire starting XI anyway.`,
    ],
    seed
  );
  const evidence = `Rated higher (${p.rating.score.toFixed(1)}) than every player who started for ${p.teamShortName}, despite ${p.minutes} minutes on the pitch.`;
  return { level: 3, humour: "DRY", observation, evidence, mechanism: "substituteOutperformedStarters" };
}

const DIVERGENCE_THRESHOLD = 2.0;

/**
 * STOCKS_RISING / STOCKS_FALLING / AGENDA (see concepts.ts) — a match
 * rating well above or below the player's own ESTABLISHED season
 * baseline. This is the one mechanism that genuinely looks beyond the
 * single match — the "context" the brief asked for, using real season
 * data this app already computes (the same Performance score shown on
 * the player's own page), not a live narrative feed. Requires 8+ matches
 * of season sample specifically because a thin baseline can't support a
 * "this is unusual for them" claim — see context.ts's SeasonBaseline
 * comment. On a young season this correctly never fires, for everyone.
 */
export function baselineDivergence(p: PlayerVoiceInput): VoiceLine | null {
  const baseline = p.context?.seasonBaseline;
  if (!baseline || baseline.confidence !== "established" || !p.rating) return null;

  const delta = p.rating.score - baseline.score;
  if (Math.abs(delta) < DIVERGENCE_THRESHOLD) return null;

  const seed = p.playerId;
  if (delta > 0) {
    const observation = pickOne(
      [
        "A long way above where his season's been sitting.",
        "Stocks are up after that one.",
        "That's a clear step above his level across the rest of the season.",
      ],
      seed
    );
    const evidence = `Rated ${p.rating.score.toFixed(1)} today against a season average of ${baseline.score.toFixed(1)}.`;
    return { level: 3, humour: "DRY", observation, evidence, mechanism: "baselineDivergence" };
  }

  const observation = pickOne(
    ["A fair way below where his season's been sitting.", "Stocks took a hit today.", "Some way off the level he's shown across the season so far."],
    seed
  );
  const evidence = `Rated ${p.rating.score.toFixed(1)} today against a season average of ${baseline.score.toFixed(1)}.`;
  return { level: 3, humour: "LIGHT", observation, evidence, mechanism: "baselineDivergence" };
}

export interface MatchVoiceInput {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  category: ResultCategory;
  totalCards: number;
  homeCards: number;
  awayCards: number;
  redCardCount: number;
  /** Team Performance ratings (matchRepository.ts's computeTeamPerformance) — needed for plotArmour. Null when nobody on that side cleared the ranking floor. */
  homeTeamRating: number | null;
  awayTeamRating: number | null;
}

/** A big win with almost nothing else going on — the match had no story beyond the scoreline. */
export function routineRout(m: MatchVoiceInput): VoiceLine | null {
  if (m.category !== "rout") return null;
  if (m.totalCards > 2 || m.redCardCount > 0) return null;

  const winner = m.homeScore > m.awayScore ? m.homeTeam : m.awayTeam;
  const margin = Math.abs(m.homeScore - m.awayScore);
  const seed = `${m.homeTeam}-${m.awayTeam}-${m.homeScore}-${m.awayScore}`;
  const observation = pickOne(
    [`Won by ${margin}. Not much else to report.`, `A ${margin}-goal win, and almost nothing else happened.`, `${winner} won comfortably, and that was more or less the whole story.`],
    seed
  );
  const evidence = `${winner} won by ${margin} goals, with only ${m.totalCards} card${m.totalCards === 1 ? "" : "s"} shown in the whole match.`;
  return { level: 3, humour: "LIGHT", observation, evidence, mechanism: "routineRout" };
}

/** A low-scoring or drawn match that still needed a pile of cards to get through. */
export function chaoticLowScoring(m: MatchVoiceInput): VoiceLine | null {
  if (m.category !== "draw" && m.category !== "goalless_draw" && m.category !== "narrow") return null;
  if (m.totalCards < 5) return null;

  const seed = `${m.homeTeam}-${m.awayTeam}-${m.homeScore}-${m.awayScore}`;
  const observation = pickOne(
    ["Not much happened on the scoreboard. Plenty happened in the referee's notebook.", "A quiet afternoon by the score, a busy one for the referee.", `${m.totalCards} cards for a match that didn't produce much else.`],
    seed
  );
  const evidence = `${m.totalCards} cards were shown in a match that finished ${m.homeScore}–${m.awayScore}.`;
  return { level: 3, humour: "DRY", observation, evidence, mechanism: "chaoticLowScoring" };
}

/** A clean sheet earned the hard way — the same side racked up several cards of its own. */
export function cleanSheetDespiteCards(m: MatchVoiceInput): VoiceLine | null {
  const cleanSheetTeam = m.awayScore === 0 && m.homeScore > 0 ? m.homeTeam : m.homeScore === 0 && m.awayScore > 0 ? m.awayTeam : null;
  if (!cleanSheetTeam) return null;
  const teamCards = cleanSheetTeam === m.homeTeam ? m.homeCards : m.awayCards;
  if (teamCards < 3) return null;

  const seed = `${m.homeTeam}-${m.awayTeam}-${m.homeScore}-${m.awayScore}`;
  const observation = pickOne([`Kept a clean sheet. Took ${teamCards} cards to do it.`, "A shutout at the back, achieved the hard way."], seed);
  const evidence = `${cleanSheetTeam} kept a clean sheet while picking up ${teamCards} cards of their own.`;
  return { level: 3, humour: "LIGHT", observation, evidence, mechanism: "cleanSheetDespiteCards" };
}

const PLOT_ARMOUR_GAP = 1.0;

/**
 * PLOT_ARMOUR (see concepts.ts) — the winning side had the LOWER Team
 * Performance rating of the two. By this app's own numbers they were the
 * side outplayed, and still won — a genuine, checkable "shouldn't have
 * won that" signal, not an opinion about the football.
 */
export function plotArmour(m: MatchVoiceInput): VoiceLine | null {
  if (m.homeScore === m.awayScore) return null;
  if (m.homeTeamRating === null || m.awayTeamRating === null) return null;

  const winner = m.homeScore > m.awayScore ? m.homeTeam : m.awayTeam;
  const winnerRating = m.homeScore > m.awayScore ? m.homeTeamRating : m.awayTeamRating;
  const loserRating = m.homeScore > m.awayScore ? m.awayTeamRating : m.homeTeamRating;
  if (winnerRating >= loserRating) return null;
  if (loserRating - winnerRating < PLOT_ARMOUR_GAP) return null;

  const seed = `${m.homeTeam}-${m.awayTeam}-${m.homeScore}-${m.awayScore}`;
  const observation = pickOne(
    [`${winner} won that without really needing to play well.`, `The performance numbers didn't back up the result. ${winner} won anyway.`, "Some results just aren't going to be explained by the performance data."],
    seed
  );
  const evidence = `${winner} won despite the lower Team Performance rating (${winnerRating.toFixed(1)} v ${loserRating.toFixed(1)}).`;
  return { level: 3, humour: "DRY", observation, evidence, mechanism: "plotArmour" };
}
