import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { qualityLabelFor } from "@/lib/analytics/scoring/types";
import type { PlayerIntelligence } from "@/lib/analytics/intelligence/types";

/**
 * SEASON STORY — narrative paragraph
 * ====================================
 * A deterministic, templated paragraph over numbers the scoring/
 * intelligence layers already produced — never an LLM, never a new
 * statistic. Same "confidence changes the CLAIM, not the number" discipline
 * as lib/analytics/scoring/explain.ts and docs/PERFORMANCE_INTELLIGENCE_AUDIT.md
 * §3.1, extended from a one-line summary (lib/analytics/intelligence/summary.ts)
 * into a short multi-sentence paragraph written in a football-analyst voice.
 *
 * Deliberately avoids pronouns (repeats the player's name instead) — this
 * app has no gender data for any player, so guessing one would be a
 * fabrication of exactly the kind this codebase avoids everywhere else.
 */

const OPENING_QUALIFIER: Record<string, string> = {
  Excellent: "an excellent",
  "Very good": "a very good",
  Good: "a good",
  Average: "a fairly average",
  "Below average": "a modest",
};

export interface SeasonStory {
  paragraph: string;
}

export function buildSeasonStory(player: RankedPlayer, intel: PlayerIntelligence, teamName: string): SeasonStory {
  const { name } = player;
  const matches = player.sample.matches;
  const matchWord = `${matches} match${matches === 1 ? "" : "es"}`;
  const overallLabel = qualityLabelFor(player.scores.overall ?? 0).toLowerCase();
  const topStrength = intel.primaryStrengths[0]?.label.toLowerCase();

  // LIMITED — fewer than 3 matches. Never claim an established identity.
  if (player.sample.confidence === "low") {
    const sentences = [
      `Early signs for ${name} this season are ${overallLabel}, based on just ${matchWord} so far.`,
      `Too early to draw firm conclusions about ${name}'s identity as a player — that picture will get clearer over the coming weeks.`,
    ];
    return { paragraph: sentences.join(" ") };
  }

  // DEVELOPING — 3–7 matches. A shape is starting to form, still provisional.
  if (player.sample.confidence === "moderate") {
    const strengthClause = topStrength ? `, with an emerging strength in ${topStrength}` : "";
    const sentences = [
      `${name}'s performances are beginning to show ${overallLabel === "excellent" || overallLabel === "very good" ? "a strong" : "a developing"} level for ${teamName} this season${strengthClause}.`,
    ];
    if (intel.momentum.available) {
      if (intel.momentum.direction === "RISING") sentences.push("Recent matches have been on an upward curve.");
      else if (intel.momentum.direction === "FALLING") sentences.push("The last few matches have dipped below that level.");
    }
    sentences.push("An emerging picture, worth watching as more matches are played.");
    return { paragraph: sentences.join(" ") };
  }

  // ESTABLISHED — 8+ matches. Confident, specific claims are earned now.
  const qualifier = OPENING_QUALIFIER[qualityLabelFor(player.scores.overall ?? 0)] ?? "a";
  const sentences = [`${name}'s performances this season consistently show ${qualifier} level of performance for ${teamName}.`];
  if (topStrength) {
    sentences.push(`One of ${name}'s clearest strengths has been ${topStrength}.`);
  }
  if (intel.momentum.available) {
    if (intel.momentum.direction === "RISING") sentences.push("Form has been trending upward in recent matches.");
    else if (intel.momentum.direction === "FALLING") sentences.push("Recent form has cooled slightly from that season level.");
  }
  if (intel.consistency.available && intel.consistency.score !== null) {
    sentences.push(
      intel.consistency.score >= 6
        ? "Output has stayed reliably close to that level match after match."
        : "Output has varied noticeably from match to match — spectacular days mixed with quieter ones."
    );
  }
  return { paragraph: sentences.join(" ") };
}
