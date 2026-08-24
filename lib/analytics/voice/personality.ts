import type { Category } from "@/lib/analytics/scoring/types";
import { pickOne } from "./pick";

/**
 * LEVEL 2 — Football Personality. Natural football language with some
 * character, but no joke attempted — this is the fallback whenever a
 * subject is genuinely good (or bad) but nothing in mechanisms.ts found an
 * actual irony/contrast/absurdity to point at. Most performances live
 * here or at Level 1, not Level 3 — see docs/FOOTBALL_VOICE_REDESIGN.md.
 */

const CATEGORY_PERSONALITY: Record<Exclude<Category, "overall" | "form" | "progression">, readonly string[]> = {
  attack: ["A constant threat in behind.", "Always looked likely to score.", "Gave the opposition back line a torrid afternoon."],
  creation: ["Kept finding team-mates in dangerous areas.", "The main source of the team's good moments going forward."],
  defence: ["Won pretty much every battle that mattered.", "Nothing much got past him.", "A calm, controlled presence at the back."],
  impact: ["Involved in everything that mattered.", "The kind of performance that doesn't always show up in the goals column."],
};

export function categoryPersonalityLine(category: Exclude<Category, "overall" | "form" | "progression">, seed: string): string {
  return pickOne(CATEGORY_PERSONALITY[category], seed);
}

const GENERIC_GOOD = ["Had a very good game.", "One of the more reliable performers on the pitch.", "Did the important things well."];
const GENERIC_SOLID = ["A solid, unspectacular performance.", "Did what was asked, nothing more, nothing less."];
const GENERIC_QUIET = ["A quiet afternoon.", "Never really got into the game."];

export function genericPersonalityLine(tier: "good" | "solid" | "quiet", seed: string): string {
  const bank = tier === "good" ? GENERIC_GOOD : tier === "solid" ? GENERIC_SOLID : GENERIC_QUIET;
  return pickOne(bank, seed);
}
