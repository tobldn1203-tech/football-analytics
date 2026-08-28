import type { VoiceLine } from "./types";
import type { NewsCategory } from "@/lib/ingestion/fpl/ingestPlayerNews";
import { pickOne } from "./pick";

/**
 * "WORTH KNOWING" VOICE — a narrow, additive extension of the Football
 * Voice architecture (see docs/FOOTBALL_VOICE_REDESIGN.md, mechanisms.ts)
 * for the availability × performance insight in
 * lib/analytics/availability/worthKnowing.ts.
 *
 * Deliberately its OWN file rather than an addition to mechanisms.ts:
 * that file backs Match Centre's narrative and is out of scope for this
 * feature. This reuses the exact same VoiceLine contract and the same
 * `pickOne` deterministic-phrasing helper, so it behaves identically to
 * every other mechanism in the app (signal first, phrasing chosen from a
 * small pool only once a real signal fires) without touching the shared
 * detector file at all.
 *
 * Scope is deliberately tight: this fires ONLY for the single strongest
 * insight tier (multiple strong performers affected, including the
 * club's own top performer) — the one genuinely surprising, "good
 * timing" kind of coincidence worth a dry aside. Every weaker tier stays
 * factual, per the brief's own instruction not to force humour onto
 * routine availability updates.
 */

export interface WorthKnowingVoiceInput {
  tier: string;
  teamName: string;
  players: Array<{ name: string; category: NewsCategory }>;
}

const OBSERVATION_POOL = [
  "Good timing.",
  "Not the ideal week for that.",
  "The timing on that is unfortunate.",
  "That's a lot to lose in one go.",
] as const;

/**
 * Suspensions are a disciplinary matter, not a misfortune — a "good
 * timing" aside would read as making light of a player's own conduct
 * rather than an unlucky coincidence, so this never fires when a
 * suspension is part of the group. Injury, doubtful, and transfer
 * situations are fair game — genuine bad luck or squad change, not fault.
 */
const ELIGIBLE_CATEGORIES: ReadonlySet<NewsCategory> = new Set(["injury", "availability", "transfer"]);

/**
 * Returns a VoiceLine only for the one tier this is scoped to, and only
 * when every affected player's category is eligible (see above).
 * Otherwise null — the caller shows only the factual headline, which is
 * always present regardless of this function's result.
 */
export function describeWorthKnowingVoice(input: WorthKnowingVoiceInput): VoiceLine | null {
  if (input.tier !== "top_performer_multiple") return null;
  if (input.players.length === 0) return null;
  if (!input.players.every((p) => ELIGIBLE_CATEGORIES.has(p.category))) return null;

  const seed = `${input.teamName}-${input.players.map((p) => p.name).join("-")}`;
  const observation = pickOne(OBSERVATION_POOL, seed);
  const evidence = `${input.players.length} of ${input.teamName}'s best performers this season are unavailable or in doubt at the same time.`;

  return { level: 3, humour: "LIGHT", observation, evidence, mechanism: "worthKnowingCoincidence" };
}
