import type { Category, RankedPlayer, SampleConfidence } from "@/lib/analytics/scoring/types";

/**
 * The Performance Intelligence layer.
 *
 * RAW DATA → ANALYTICS (lib/analytics/scoring) → PERFORMANCE INTELLIGENCE
 * (this folder) → football language → UI.
 *
 * Everything here is deterministic — computed from the scoring engine's
 * output (`RankedPlayer`) and a player's raw match log. Nothing in this
 * folder calls an LLM or invents a number; it interprets numbers the
 * scoring engine already produced. See docs/METHODOLOGY additions and the
 * module-level comments in each file for the exact formulas.
 */

/** "Limited" / "Developing" / "Established" — the fan-facing confidence vocabulary. */
export type ConfidenceLabel = "Limited" | "Developing" | "Established";

export function confidenceLabel(confidence: SampleConfidence): ConfidenceLabel {
  switch (confidence) {
    case "low":
      return "Limited";
    case "moderate":
      return "Developing";
    case "established":
      return "Established";
  }
}

/** Performance: "how good has this player been over the relevant period?" */
export interface PerformanceMetric {
  score: number; // 0–10, same scale as RankedPlayer.scores.overall
  label: string; // qualityLabelFor(score)
  confidence: ConfidenceLabel;
}

/** Form: "how good has this player been recently?" — recency-weighted, see provisional.ts. */
export interface FormMetric {
  score: number; // 0–10
  label: string;
  /** score - season Performance score; positive means recent form is ahead of the season baseline. */
  deltaFromPerformance: number;
}

/** Impact: "how much has this player influenced matches through their on-pitch contribution?" */
export interface ImpactMetric {
  score: number; // 0–10, league-wide percentile of per-90 match-contribution (bps)
  label: string;
}

export type ConsistencyLabel =
  | "High consistency"
  | "Consistent"
  | "Variable"
  | "Highly variable"
  | "Not enough data yet";

/** Consistency: "how reliably does this player produce performances around their own normal level?" */
export interface ConsistencyMetric {
  available: boolean;
  score: number | null; // 0–10, null when unavailable
  label: ConsistencyLabel;
  matchesConsidered: number;
  explanation: string;
}

export type MomentumDirection = "RISING" | "STABLE" | "FALLING";

/** Momentum: "is this player's performance improving or declining?" */
export interface MomentumMetric {
  available: boolean;
  direction: MomentumDirection;
  /** Recent per-90 rate minus season per-90 baseline (bps). 0 when unavailable. */
  magnitude: number;
  label: string;
  explanation: string;
}

export type StrengthAreaKey = Exclude<Category, "overall" | "form" | "progression">;

export interface StrengthArea {
  key: StrengthAreaKey;
  label: string;
  score: number;
}

export interface PlayerIntelligence {
  playerId: string;
  name: string;
  teamShortName: string;
  performance: PerformanceMetric;
  form: FormMetric;
  impact: ImpactMetric;
  consistency: ConsistencyMetric;
  momentum: MomentumMetric;
  confidence: ConfidenceLabel;
  primaryStrengths: StrengthArea[];
  developmentAreas: StrengthArea[];
  /** A single deterministic, templated sentence — never LLM-generated. See summary.ts. */
  summary: string;
}

export type { RankedPlayer };
