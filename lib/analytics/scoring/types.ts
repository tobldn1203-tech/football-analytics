import type { PositionCode } from "@/lib/competitions/premier-league";

export const CATEGORIES = [
  "overall",
  "form",
  "attack",
  "creation",
  "progression",
  "defence",
  "impact",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface CategoryDefinition {
  key: Category;
  label: string;
  /** Plain-language explanation, no statistical jargon — this is what a Level 1 user sees. */
  description: string;
  available: boolean;
  unavailableReason?: string;
}

/** How much weight a fan should put on this player's scores right now. */
export type SampleConfidence = "low" | "moderate" | "established";

export interface SampleSize {
  matches: number;
  minutes: number;
  confidence: SampleConfidence;
}

/**
 * MINUTES-BASED, not matches-based — see docs/MINUTES_SAMPLE_RELIABILITY_AUDIT.md
 * and docs/PLAYER_INTELLIGENCE_MINUTES_DESIGN.md §9. Counting matches let a
 * player clear "low" confidence by accumulating enough short substitute
 * cameos without ever accumulating meaningful playing time (4 appearances
 * of 15 minutes each classified identically to 4 full 90-minute matches).
 *
 * The thresholds are 3 and 8 *full matches'* worth of minutes (90 × 3 = 270,
 * 90 × 8 = 720) — not new numbers invented for this change. A player who
 * starts and plays every minute crosses these boundaries at exactly the
 * same point as under the old matches-based rule; only players who
 * accumulate matches without accumulating minutes are reclassified.
 */
export function classifySampleConfidence(minutes: number): SampleConfidence {
  if (minutes < 270) return "low";
  if (minutes < 720) return "moderate";
  return "established";
}

/**
 * RELIABILITY SHRINKAGE — see docs/PLAYER_INTELLIGENCE_MINUTES_DESIGN.md §16
 * for the full derivation. Continuous, asymptotic, minutes-based weight
 * used by `computeProvisionalRankings` to blend an observed category score
 * with a neutral (position-and-category) prior: `raw * r + prior * (1 - r)`.
 *
 * r → 0 as minutes → 0 (no evidence: fully trust the prior)
 * r → 1 as minutes → ∞ (never fully "certain", but effectively so past a
 *   few hundred minutes)
 * r = 0.5 exactly at minutes = K
 *
 * K = 90 (one full match) was chosen, not an arbitrary round number, because
 * it's the largest tested value that still leaves a player who has played
 * every available minute so far (this early in a season, ~360 minutes) close
 * to fully trusted (r ≈ 0.8), while meaningfully tempering a 50-95 minute
 * sample (r ≈ 0.35-0.5) — see the design doc's §6.1 for the K sweep that
 * ruled out 180/270/360/450 (all of which shrink even a player who's never
 * missed a minute too aggressively at the current early-season minutes
 * scale). Exported so every consumer of "how much evidence is this" —
 * confidence, ranking, and any future Best XI/Player Comparison eligibility
 * logic — reads the same primitive rather than inventing its own.
 */
export const RELIABILITY_K = 90;

export function evidenceReliability(minutes: number, K: number = RELIABILITY_K): number {
  return minutes / (minutes + K);
}

/**
 * Maps sample confidence onto the semantic colour system: a genuinely
 * tiny sample gets "attention" (real uncertainty), a moderate one gets
 * the calmer "info" treatment — never negative, since a small sample
 * isn't a bad result.
 */
export function confidenceTone(confidence: SampleConfidence): "attention" | "info" {
  return confidence === "low" ? "attention" : "info";
}

export interface RankedPlayer {
  playerId: string;
  slug: string;
  name: string;
  /** Pass-through identity — the player's club, for navigation to its Team Intelligence page. Not analytics. */
  teamId: string;
  teamShortName: string;
  position: PositionCode;
  sample: SampleSize;
  /** 0–10 score for every available category, plus overall. */
  scores: Partial<Record<Category, number>>;
  qualityLabel: string;
  /** Pass-through identity imagery — see lib/assets/images.ts. Not analytics. */
  photoUrl: string | null;
  teamCrestUrl: string | null;
  /** Pass-through identity — see prisma/schema.prisma's Player.nationality
   *  comment. Optional/absent (not just null) so existing object literals
   *  built without it — tests, the synthetic "team as player" object in
   *  teamRepository.ts — don't need updating; UI treats missing the same
   *  as null (no flag shown). Not analytics. */
  nationality?: string | null;
  nationalityCode?: string | null;
}

export const QUALITY_BANDS: Array<{ min: number; label: string }> = [
  { min: 8.5, label: "Excellent" },
  { min: 7.0, label: "Very good" },
  { min: 5.5, label: "Good" },
  { min: 4.0, label: "Average" },
  { min: 0, label: "Below average" },
];

export function qualityLabelFor(score: number): string {
  return QUALITY_BANDS.find((b) => score >= b.min)?.label ?? "Below average";
}
