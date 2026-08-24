import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import type { StrengthArea, StrengthAreaKey } from "./types";

/**
 * Strength / development-area detection.
 *
 * Reads only the category scores the scoring engine already produced —
 * Attack, Creation, Defence, Impact (Progression excluded: not available,
 * see docs/DATA_SOURCES.md; Form/Overall excluded: they aren't "areas of
 * the game", they're time-window and composite concepts respectively).
 *
 * PRIMARY STRENGTHS: categories at "Good" (≥5.5, matching qualityLabelFor's
 * own band) or better, top 2 by score — but ONLY reported once sample
 * confidence clears "Limited" (3+ matches). See
 * docs/PERFORMANCE_INTELLIGENCE_AUDIT.md §3.1: a percentile computed from
 * one 77-minute match can legitimately hit "Elite" purely from noise (one
 * goal, thin cohort), and labelling that a player's headline strength
 * implies an established characteristic the evidence doesn't support yet.
 * The underlying category score is unchanged either way — this only gates
 * whether it's confident enough to report as a strength. At Limited
 * confidence this returns no primary strengths at all (unlike
 * `explainPlayer` in lib/analytics/scoring/explain.ts, which softens its
 * prose instead of suppressing — `StrengthArea` is a terse internal tag,
 * not a sentence, so there's no natural "early signal" wording to give it;
 * suppressing here is the honest option). A player can also have zero
 * strengths simply because nothing stands out — a legitimate, honestly
 * reported outcome, not something to force a wording around.
 *
 * DEVELOPMENT AREAS: categories at "Below average" (<4.0) or worse — also
 * ONLY when sample confidence is "moderate" or "established". A single bad
 * match from a player with 45 minutes on the season should never produce a
 * "development area" callout; that's not evidence, it's noise. Framed as
 * "development area", never "weakness" — see the brief's explicit language
 * guidance.
 */

const LABEL: Record<StrengthAreaKey, string> = {
  attack: "Attacking output",
  creation: "Creative output",
  defence: "Defensive contribution",
  impact: "Match impact",
};

const STRENGTH_MIN = 5.5;
const DEVELOPMENT_MAX = 4.0;
const MAX_STRENGTHS = 2;
const MAX_DEVELOPMENT_AREAS = 2;

export interface StrengthDetection {
  primaryStrengths: StrengthArea[];
  developmentAreas: StrengthArea[];
}

export function detectStrengths(
  player: RankedPlayer,
  opts: { allowDevelopmentAreas: boolean }
): StrengthDetection {
  const keys: StrengthAreaKey[] = ["attack", "creation", "defence", "impact"];
  const scored = keys
    .map((key) => ({ key, label: LABEL[key], score: player.scores[key] ?? 0 }))
    .filter((c) => Number.isFinite(c.score));

  const primaryStrengths =
    player.sample.confidence === "low"
      ? []
      : scored
          .filter((c) => c.score >= STRENGTH_MIN)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_STRENGTHS);

  const developmentAreas = opts.allowDevelopmentAreas
    ? scored
        .filter((c) => c.score < DEVELOPMENT_MAX)
        .sort((a, b) => a.score - b.score)
        .slice(0, MAX_DEVELOPMENT_AREAS)
    : [];

  return { primaryStrengths, developmentAreas };
}

export { LABEL as STRENGTH_AREA_LABEL };
