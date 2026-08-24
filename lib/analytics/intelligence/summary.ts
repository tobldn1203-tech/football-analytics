import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import type { MatchLogEntry } from "@/lib/analytics/scoring/provisional";
import { qualityLabelFor } from "@/lib/analytics/scoring/types";
import { formLabelFor } from "./labels";
import { computeConsistency } from "./consistency";
import { computeMomentum } from "./momentum";
import { detectStrengths } from "./strengths";
import { confidenceLabel } from "./types";
import type { PlayerIntelligence } from "./types";

/**
 * Composes the full Player Intelligence object from a RankedPlayer (the
 * scoring engine's output) and that player's match log. Everything below
 * is deterministic — template strings over real numbers, never an LLM.
 * See docs/METHODOLOGY.md (and the methodology page) for the plain-English
 * version of every formula referenced here.
 */

const QUALIFIER: Record<string, string> = {
  Excellent: "an excellent",
  "Very good": "a very good",
  Good: "a good",
  Average: "a fairly average",
  "Below average": "a modest",
};

export function buildPlayerIntelligence(
  player: RankedPlayer,
  matchLog: MatchLogEntry[],
  teamName?: string
): PlayerIntelligence {
  const confidence = confidenceLabel(player.sample.confidence);
  const allowDevelopmentAreas = player.sample.confidence !== "low";

  const performanceScore = player.scores.overall ?? 0;
  const formScore = player.scores.form ?? 0;
  const impactScore = player.scores.impact ?? 0;

  const performance = {
    score: performanceScore,
    label: qualityLabelFor(performanceScore),
    confidence,
  };

  const form = {
    score: formScore,
    label: formLabelFor(formScore),
    deltaFromPerformance: Math.round((formScore - performanceScore) * 10) / 10,
  };

  const impact = {
    score: impactScore,
    label: qualityLabelFor(impactScore),
  };

  const consistency = computeConsistency(matchLog);
  const momentum = computeMomentum(matchLog);
  const { primaryStrengths, developmentAreas } = detectStrengths(player, {
    allowDevelopmentAreas,
  });

  const summary = buildSummary({
    name: player.name,
    team: teamName ?? player.teamShortName,
    matches: player.sample.matches,
    confidence: player.sample.confidence,
    performanceLabel: performance.label,
    primaryStrengthLabel: primaryStrengths[0]?.label,
    momentumDirection: momentum.available ? momentum.direction : null,
  });

  return {
    playerId: player.playerId,
    name: player.name,
    teamShortName: player.teamShortName,
    performance,
    form,
    impact,
    consistency,
    momentum,
    confidence,
    primaryStrengths,
    developmentAreas,
    summary,
  };
}

function buildSummary(args: {
  name: string;
  team: string;
  matches: number;
  confidence: "low" | "moderate" | "established";
  performanceLabel: string;
  primaryStrengthLabel?: string;
  momentumDirection: "RISING" | "STABLE" | "FALLING" | null;
}): string {
  const { name, team, matches, confidence, performanceLabel, primaryStrengthLabel, momentumDirection } = args;

  if (confidence === "low") {
    return `It's still early days for ${name} this season — just ${matches} match${matches === 1 ? "" : "es"} so far, but the early signs are ${performanceLabel.toLowerCase()}.`;
  }

  const qualifier = QUALIFIER[performanceLabel] ?? "a";
  const strengthClause = primaryStrengthLabel
    ? `, particularly in ${primaryStrengthLabel.toLowerCase()}`
    : "";
  const momentumClause =
    momentumDirection === "RISING"
      ? ", with performances improving in recent matches"
      : momentumDirection === "FALLING"
        ? ", though recent form has dipped"
        : "";

  return `${name} has been ${qualifier} performer for ${team} this season${strengthClause}${momentumClause}.`;
}
