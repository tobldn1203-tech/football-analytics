/**
 * FOOTBALL VOICE — match situation classification
 * ===================================================
 * The "raw data → match situation" step of the pipeline in
 * docs/FOOTBALL_VOICE_REDESIGN.md. Purely a classification of the final
 * score / card count — never a claim about how the match unfolded (no
 * data exists for that — see matchStory.ts's module comment on what's
 * deliberately never claimed).
 */

export type ResultCategory = "goalless_draw" | "draw" | "narrow" | "comfortable" | "rout";

/** Classifies the final score into a result shape, based only on the margin. */
export function classifyResult(homeScore: number, awayScore: number): ResultCategory {
  if (homeScore === awayScore) return homeScore === 0 ? "goalless_draw" : "draw";
  const margin = Math.abs(homeScore - awayScore);
  if (margin === 1) return "narrow";
  if (margin >= 4) return "rout";
  return "comfortable";
}

/** A heavy card count for the match — purely a count-based threshold, not a claim about discipline or intent. */
export function isCardHeavy(totalCards: number): boolean {
  return totalCards >= 5;
}

/** A high-scoring match, both sides combined. */
export function isHighScoring(totalGoals: number): boolean {
  return totalGoals >= 5;
}
