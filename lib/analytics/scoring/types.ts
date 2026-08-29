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
 * Sensible, un-fancy thresholds — no statistical shrinkage yet, just an
 * honest label so small samples aren't presented with false confidence.
 */
export function classifySampleConfidence(matches: number): SampleConfidence {
  if (matches < 3) return "low";
  if (matches < 8) return "moderate";
  return "established";
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
