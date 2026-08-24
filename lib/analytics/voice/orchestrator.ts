import type { VoiceLine } from "./types";
import {
  cardDespiteGoodPerformance,
  categoryMismatch,
  substituteOutperformedStarters,
  baselineDivergence,
  chaoticLowScoring,
  cleanSheetDespiteCards,
  routineRout,
  plotArmour,
  type PlayerVoiceInput,
  type MatchVoiceInput,
} from "./mechanisms";
import { categoryPersonalityLine, genericPersonalityLine } from "./personality";

/**
 * Tries each Level-3 mechanism in order; the first real hit wins. Falls
 * through to Level 2 (natural language, no joke) or Level 1 (plain fact)
 * when nothing fires — which is the common case, by design. See
 * docs/FOOTBALL_VOICE_REDESIGN.md. `baselineDivergence` sits early because
 * it's the one genuinely context-aware mechanism (season history, not just
 * this match) — see concepts.ts (STOCKS_RISING/STOCKS_FALLING/AGENDA).
 */
const PLAYER_MECHANISMS = [substituteOutperformedStarters, baselineDivergence, categoryMismatch, cardDespiteGoodPerformance];

export function describePlayerVoice(p: PlayerVoiceInput): VoiceLine {
  for (const mechanism of PLAYER_MECHANISMS) {
    const hit = mechanism(p);
    if (hit) return hit;
  }
  return fallbackPlayerVoice(p);
}

function fallbackPlayerVoice(p: PlayerVoiceInput): VoiceLine {
  const evidence = buildPlayerEvidence(p);

  if (!p.rating) {
    return { level: 1, humour: "NONE", observation: "Limited minutes — not enough to rate.", evidence, mechanism: "factual" };
  }

  if (p.rating.score >= 6.5) {
    const entries = (["attack", "creation", "defence"] as const).map((k) => ({ k, score: p.categoryScores[k] ?? 0 }));
    const top = entries.sort((a, b) => b.score - a.score)[0];
    const observation = top && top.score >= 5.5 ? categoryPersonalityLine(top.k, p.playerId) : genericPersonalityLine("good", p.playerId);
    return { level: 2, humour: "NONE", observation, evidence, mechanism: "personality" };
  }

  const observation = genericPersonalityLine(p.rating.score < 4 ? "quiet" : "solid", p.playerId);
  return { level: 1, humour: "NONE", observation, evidence, mechanism: "factual" };
}

function buildPlayerEvidence(p: PlayerVoiceInput): string {
  if (!p.rating) return `Played ${p.minutes} minutes.`;
  const contribution = [p.goals > 0 && `${p.goals} goal${p.goals > 1 ? "s" : ""}`, p.assists > 0 && `${p.assists} assist${p.assists > 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" and ");
  return contribution
    ? `${p.rating.label} performance (${p.rating.score.toFixed(1)}), with ${contribution}.`
    : `${p.rating.label} performance (${p.rating.score.toFixed(1)}).`;
}

const MATCH_MECHANISMS = [chaoticLowScoring, cleanSheetDespiteCards, plotArmour, routineRout];

/**
 * Match-level Level 3 only — an optional addendum to the factual result
 * line matchStory.ts already builds. Returns null (no addendum) far more
 * often than not; the surrounding narrative already carries the evidence
 * (scoreline, card count), so there's no separate evidence line here.
 */
export function describeMatchVoice(m: MatchVoiceInput): VoiceLine | null {
  for (const mechanism of MATCH_MECHANISMS) {
    const hit = mechanism(m);
    if (hit) return hit;
  }
  return null;
}

export type { PlayerVoiceInput, MatchVoiceInput };
