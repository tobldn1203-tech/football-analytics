/**
 * Form gets its own, richer categorical vocabulary — distinct from
 * Performance's existing bands (see qualityLabelFor in lib/analytics/scoring/types.ts) —
 * because "how has this player done recently" reads more naturally with a
 * wider spread of intuitive tiers than the season-long headline score.
 * Sensible, round thresholds; not derived from a statistical fit.
 */
const FORM_BANDS: Array<{ min: number; label: string }> = [
  { min: 9.0, label: "Elite" },
  { min: 7.5, label: "Excellent" },
  { min: 6.0, label: "Strong" },
  { min: 4.5, label: "Solid" },
  { min: 2.5, label: "Below Average" },
  { min: 0, label: "Poor" },
];

export function formLabelFor(score: number): string {
  return FORM_BANDS.find((b) => score >= b.min)?.label ?? "Poor";
}
