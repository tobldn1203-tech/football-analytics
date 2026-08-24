/**
 * Diagnostic tool for sense-checking the Performance Intelligence layer —
 * not a build script, not run in CI. Prints a readable report; a human
 * reads it and judges whether it sounds like football. Produced the
 * findings in docs/PERFORMANCE_INTELLIGENCE_AUDIT.md. Re-run this after
 * ingesting more gameweeks to see whether earlier findings still hold.
 *
 * Two parts:
 *   1. Real data — a representative sample of currently-ranked players
 *      per position (top 4, bottom 2, and any single-match players).
 *   2. Synthetic — Consistency/Momentum validated against the brief's own
 *      worked examples, since real data doesn't yet have enough matches
 *      per player to exercise those two concepts directly.
 */
import { getCurrentSeasonPerformanceInputs } from "@/lib/analytics/scoring/repository";
import { computeProvisionalRankings } from "@/lib/analytics/scoring/provisional";
import { buildPlayerIntelligence } from "@/lib/analytics/intelligence/summary";
import { computeConsistency } from "@/lib/analytics/intelligence/consistency";
import { computeMomentum } from "@/lib/analytics/intelligence/momentum";

async function auditRealData() {
  const inputs = await getCurrentSeasonPerformanceInputs();
  const { players, sampleNote } = computeProvisionalRankings(inputs);
  const inputById = new Map(inputs.map((p) => [p.id, p]));

  console.log(`Sample note: ${sampleNote}`);
  console.log(`Eligible players: ${players.length}\n`);

  const byPosition = new Map<string, typeof players>();
  for (const p of players) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }

  for (const [position, group] of byPosition) {
    console.log(`\n=== ${position} (${group.length} eligible) ===`);
    const sorted = [...group].sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0));
    const sample = new Map<string, (typeof players)[number]>();
    for (const p of sorted.slice(0, 4)) sample.set(p.playerId, p);
    for (const p of sorted.slice(-2)) sample.set(p.playerId, p);
    for (const p of sorted.filter((p) => p.sample.matches <= 1).slice(0, 2)) sample.set(p.playerId, p);

    for (const p of sample.values()) {
      const input = inputById.get(p.playerId)!;
      const intel = buildPlayerIntelligence(p, input.matchLog, undefined);
      console.log(`\n  ${p.name} (${p.teamShortName}) — ${p.sample.matches}m/${p.sample.minutes}min, confidence=${intel.confidence}`);
      console.log(
        `    Performance ${intel.performance.score.toFixed(1)} (${intel.performance.label})  Form ${intel.form.score.toFixed(1)} (${intel.form.label}, Δ${intel.form.deltaFromPerformance >= 0 ? "+" : ""}${intel.form.deltaFromPerformance})  Impact ${intel.impact.score.toFixed(1)} (${intel.impact.label})`
      );
      console.log(
        `    Consistency: ${intel.consistency.available ? `${intel.consistency.score!.toFixed(1)} (${intel.consistency.label})` : "unavailable"} — ${intel.consistency.explanation}`
      );
      console.log(
        `    Momentum: ${intel.momentum.available ? `${intel.momentum.direction} (${intel.momentum.magnitude})` : "unavailable"} — ${intel.momentum.explanation}`
      );
      console.log(`    Strengths: ${intel.primaryStrengths.map((s) => `${s.label} (${s.score})`).join(", ") || "none"}`);
      console.log(`    Development areas: ${intel.developmentAreas.map((a) => `${a.label} (${a.score})`).join(", ") || "none"}`);
      console.log(`    Raw category scores: attack=${p.scores.attack} creation=${p.scores.creation} defence=${p.scores.defence} impact=${p.scores.impact}`);
      console.log(`    Summary: "${intel.summary}"`);
    }
  }

  console.log("\n\n=== Lowest-minute eligible players (season minutes >= 45 floor) ===");
  const byMinutes = [...players].sort((a, b) => a.sample.minutes - b.sample.minutes).slice(0, 8);
  for (const p of byMinutes) {
    const input = inputById.get(p.playerId)!;
    const intel = buildPlayerIntelligence(p, input.matchLog, undefined);
    console.log(`  ${p.name} (${p.teamShortName}, ${p.position}) — ${p.sample.minutes}min: Performance ${intel.performance.score.toFixed(1)}, Strengths: ${intel.primaryStrengths.map((s) => s.label).join(", ") || "none"}`);
  }

  console.log("\n=== Defenders with Attack score >= 8 (single-match goal/assist spike check) ===");
  for (const p of players.filter((p) => p.position === "DEF" && (p.scores.attack ?? 0) >= 8)) {
    const input = inputById.get(p.playerId)!;
    console.log(`  ${p.name} (${p.teamShortName}) — attack=${p.scores.attack}, goals=${input.season.goals}, assists=${input.season.assists}, xg=${input.season.xg.toFixed(2)}`);
  }
}

function auditSynthetic() {
  const log = (values: number[]) => values.map((v) => ({ minutes: 90, bps: v }));

  console.log("\n\n=== SYNTHETIC: Consistency, brief's worked examples (section 6) ===");
  console.log("Player A (steady, strong):", computeConsistency(log([8.5, 8.6, 8.7, 8.4, 8.6])));
  console.log("Player B (spiky highs/lows):", computeConsistency(log([10.0, 9.8, 6.0, 5.9, 8.5])));
  console.log("Player C (steady, mediocre):", computeConsistency(log([6.5, 6.6, 6.5, 6.7, 6.6])));

  console.log("\n=== SYNTHETIC: Momentum — 'one great match' should not equal Rising ===");
  console.log(
    "One great recent match + 4 quiet:",
    computeMomentum([{ minutes: 90, bps: 45 }, { minutes: 90, bps: 12 }, { minutes: 90, bps: 11 }, { minutes: 90, bps: 13 }, { minutes: 90, bps: 12 }])
  );
  console.log(
    "Genuine 3-match rise vs baseline:",
    computeMomentum([{ minutes: 90, bps: 28 }, { minutes: 90, bps: 30 }, { minutes: 90, bps: 26 }, { minutes: 90, bps: 10 }, { minutes: 90, bps: 9 }])
  );
  console.log(
    "Falling:",
    computeMomentum([{ minutes: 90, bps: 8 }, { minutes: 90, bps: 9 }, { minutes: 90, bps: 7 }, { minutes: 90, bps: 30 }, { minutes: 90, bps: 32 }])
  );
  console.log(
    "Genuinely stable:",
    computeMomentum([{ minutes: 90, bps: 20 }, { minutes: 90, bps: 22 }, { minutes: 90, bps: 19 }, { minutes: 90, bps: 21 }, { minutes: 90, bps: 20 }])
  );
}

async function main() {
  await auditRealData();
  auditSynthetic();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
