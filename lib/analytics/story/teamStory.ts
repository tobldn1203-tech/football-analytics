import type { Category } from "@/lib/analytics/scoring/types";
import { qualityLabelFor, type SampleConfidence } from "@/lib/analytics/scoring/types";
import type { StrengthArea } from "@/lib/analytics/intelligence/types";
import type { MomentumMetric, MomentumDirection } from "@/lib/analytics/intelligence/types";

/**
 * TEAM STORY — deterministic, data-grounded football language for a club
 * ==========================================================================
 * Same discipline as lib/analytics/story/seasonStory.ts (player) — a
 * templated paragraph over numbers the scoring/intelligence layers already
 * produced, confidence-gated into the same Limited/Developing/Established
 * tiers, never a new confidence model. Deliberately not run through
 * lib/analytics/voice/ (Level 3 humour) this pass — a team-season
 * narrative needs its own concept detectors (a team's record vs its
 * underlying rating, its home/away split, etc.) which is real future work,
 * not this pass's scope; see the Team Intelligence build notes.
 */

const CATEGORY_LABEL: Record<Exclude<Category, "overall" | "form" | "progression">, string> = {
  attack: "attacking output",
  creation: "chance creation",
  defence: "defensive performances",
  impact: "overall match impact",
};

const OPENING_QUALIFIER: Record<string, string> = {
  Excellent: "an excellent",
  "Very good": "a very good",
  Good: "a good",
  Average: "a fairly average",
  "Below average": "a difficult",
};

export interface TeamStoryInput {
  name: string;
  overallScore: number;
  matchesPlayed: number;
  confidence: SampleConfidence;
  strengths: StrengthArea[];
  developmentAreas: StrengthArea[];
  momentum: MomentumMetric;
}

export function buildTeamStory(input: TeamStoryInput): string {
  const { name, overallScore, matchesPlayed, confidence, strengths, momentum } = input;
  const matchWord = `${matchesPlayed} match${matchesPlayed === 1 ? "" : "es"}`;
  const overallLabel = qualityLabelFor(overallScore).toLowerCase();
  const topStrength = strengths[0]?.label.toLowerCase();
  const secondStrength = strengths[1]?.label.toLowerCase();

  if (confidence === "low") {
    const sentences = [
      `Early days for ${name} this season — just ${matchWord} so far, and the early signs are ${overallLabel}.`,
      `Too early to say what kind of team ${name} are shaping up to be — that picture will get clearer over the coming weeks.`,
    ];
    return sentences.join(" ");
  }

  if (confidence === "moderate") {
    const sentences: string[] = [];
    const strengthClause = topStrength ? `, with performances so far leaning most on ${topStrength}` : "";
    sentences.push(`${name} are showing a ${overallLabel} level across their opening ${matchWord} this season${strengthClause}.`);
    if (momentum.available) {
      if (momentum.direction === "RISING") sentences.push("Recent performances have been on an upward curve.");
      else if (momentum.direction === "FALLING") sentences.push("The last few matches have dipped below that level.");
    }
    sentences.push("Still an emerging picture, worth watching as more matches are played.");
    return sentences.join(" ");
  }

  // established
  const qualifier = OPENING_QUALIFIER[qualityLabelFor(overallScore)] ?? "a";
  const sentences: string[] = [`${name} have shown ${qualifier} level of performance across the season so far.`];
  if (topStrength && secondStrength) {
    sentences.push(`Their performances have been driven more by ${topStrength} than ${secondStrength}.`);
  } else if (topStrength) {
    sentences.push(`${name}'s clearest strength this season has been ${topStrength}.`);
  }
  if (momentum.available) {
    if (momentum.direction === "RISING") sentences.push("Form has been trending upward in recent matches.");
    else if (momentum.direction === "FALLING") sentences.push("Recent form has cooled from that season level.");
  }
  return sentences.join(" ");
}

const MIN_QUALIFYING_MATCHES = 4;
const RECENT_WINDOW = 3;

/**
 * Team-level Momentum — same principle as
 * lib/analytics/intelligence/momentum.ts (recent form vs the team's OWN
 * season baseline, never the league's), adapted to the input shape a team
 * actually has: one Team Performance rating per match (see
 * matchRepository.ts's computeTeamPerformance), not per-90 bps. Requires a
 * real "before" to compare "now" against, same as the player version —
 * with fewer than MIN_QUALIFYING_MATCHES rated matches this correctly
 * reports unavailable rather than a trend computed off 1–2 data points.
 */
export function computeTeamMomentum(ratingsMostRecentFirst: number[]): MomentumMetric {
  if (ratingsMostRecentFirst.length < MIN_QUALIFYING_MATCHES) {
    return {
      available: false,
      direction: "STABLE",
      magnitude: 0,
      label: "Not enough matches yet",
      explanation: "Too few matches so far to judge a trend.",
    };
  }

  const recent = ratingsMostRecentFirst.slice(0, RECENT_WINDOW);
  const recentAvg = recent.reduce((sum, r) => sum + r, 0) / recent.length;
  const seasonAvg = ratingsMostRecentFirst.reduce((sum, r) => sum + r, 0) / ratingsMostRecentFirst.length;
  const magnitude = Math.round((recentAvg - seasonAvg) * 10) / 10;
  // A 0–10 scale, not per-90 bps — a different, documented judgement call
  // from the player version's threshold, same reasoning (a fixed floor
  // plus a relative component so this doesn't over-trigger for a team
  // whose season average is already low).
  const threshold = Math.max(0.4, seasonAvg * 0.1);

  let direction: MomentumDirection = "STABLE";
  if (magnitude > threshold) direction = "RISING";
  else if (magnitude < -threshold) direction = "FALLING";

  const explanation =
    direction === "RISING"
      ? "Recent performances are above this team's season level."
      : direction === "FALLING"
        ? "Recent performances have dropped below this team's season level."
        : "Recent performances are in line with this team's season level.";

  const label = direction === "RISING" ? "Rising" : direction === "FALLING" ? "Falling" : "Stable";

  return { available: true, direction, magnitude, label, explanation };
}
