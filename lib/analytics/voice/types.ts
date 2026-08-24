/**
 * FOOTBALL VOICE — shared types
 * ================================
 * See docs/FOOTBALL_VOICE_REDESIGN.md for the mechanism this implements.
 * A reusable narrative-language layer, intentionally kept separate from
 * any one page. Match Centre is the first consumer
 * (lib/analytics/story/matchStory.ts); Season Stories, Discover, Top
 * Performers and future pages can import from here directly without
 * duplicating detection or phrasing logic.
 */

/**
 * LEVEL 1 — Football Intelligence: plain factual language.
 * LEVEL 2 — Football Personality: natural football language with character,
 *           no joke attempted.
 * LEVEL 3 — Internet Football Humour: a dry, observational line, only used
 *           when a real mechanism in mechanisms.ts actually fired.
 * The level is a CONSEQUENCE of what the data supports, never a target —
 * most subjects land on 1 or 2, and that's the system working correctly,
 * not underperforming.
 */
export type VoiceLevel = 1 | 2 | 3;

/**
 * Only meaningful when level is 3 — how far the observation leans in.
 * NONE for levels 1–2. Roughly: LIGHT = a small aside, DRY = the normal
 * register for this app, STRONG = reserved for a genuinely unusual/absurd
 * data pattern (e.g. a defender's median stat, statistically, is defending
 * least well on the pitch).
 */
export type HumourIntensity = "NONE" | "LIGHT" | "DRY" | "STRONG";

export interface VoiceLine {
  level: VoiceLevel;
  humour: HumourIntensity;
  /** The level-appropriate line — factual (L1), natural (L2), or a dry observation (L3). Never appears without `evidence` alongside it wherever this is rendered. */
  observation: string;
  /** Always the flat, factual, fully-traceable sentence. Always rendered, regardless of `level` — humour is optional, evidence is not. */
  evidence: string;
  /** Which mechanism produced this, for debugging/testing — never shown to users. */
  mechanism: string;
}
