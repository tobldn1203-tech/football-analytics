import { prisma } from "@/lib/db/client";
import { percentileRank } from "@/lib/analytics/scoring/percentile";
import {
  MIN_MINUTES,
  INDIVIDUAL_DEFENCE_WEIGHT as CURRENT_INDIVIDUAL_WEIGHT,
  TEAM_CLEAN_SHEET_WEIGHT as CURRENT_TEAM_WEIGHT,
} from "@/lib/analytics/scoring/provisional";
import { getGameweekRatings } from "@/lib/analytics/scoring/matchRepository";
import { classifyArchetype } from "@/lib/analytics/archetypes/archetypes";
import type { PositionCode } from "@/lib/competitions/premier-league";

/**
 * DEFENCE METHODOLOGY AUDIT — reusable analysis script
 * ==========================================================================
 * Companion to docs/DEFENCE_METHODOLOGY_AUDIT.md. Read-only: queries the
 * database and the real, unmodified scoring functions (percentileRank,
 * MIN_MINUTES), never writes anything and never touches production scoring
 * code. Safe and intended to be re-run as more gameweeks accumulate — the
 * whole point of extracting this into a proper script rather than a
 * throwaway one-off is that the audit's conclusions should be revisited
 * once the sample is no longer "one gameweek across the whole league".
 *
 * Run with: npx tsx scripts/audit-defence-methodology.ts
 *
 * §6 (added when the experimental weighting was implemented) imports the
 * REAL, currently-live INDIVIDUAL_DEFENCE_WEIGHT/TEAM_CLEAN_SHEET_WEIGHT
 * constants from provisional.ts — so this comparison always reflects
 * whatever is actually in production, not a copy that can drift out of
 * date. The historical 0.5/0.5 split is hardcoded below purely as a fixed
 * reference point for "what would this have scored under the original
 * methodology" — it is not read from anywhere in the live code.
 */
const ORIGINAL_INDIVIDUAL_WEIGHT = 0.5;
const ORIGINAL_TEAM_WEIGHT = 0.5;

interface DefenceRow {
  playerId: string;
  matchId: string;
  gameweek: number | null;
  seasonId: string;
  name: string;
  position: PositionCode;
  teamShortName: string;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  tackles: number | null;
  cbi: number | null;
  recoveries: number | null;
  defensiveActions: number;
  saves: number;
  cleanSheet: number;
  goalsConceded: number;
}

async function fetchRows(): Promise<DefenceRow[]> {
  const perfs = await prisma.playerMatchPerformance.findMany({
    where: { minutes: { gte: MIN_MINUTES }, match: { status: "finished" } },
    include: { player: { include: { team: true } }, match: true },
  });
  return perfs.map((p) => ({
    playerId: p.playerId,
    matchId: p.matchId,
    gameweek: p.match.gameweek,
    seasonId: p.match.seasonId,
    name: p.player.displayName,
    position: p.player.position as PositionCode,
    teamShortName: p.player.team.shortName,
    minutes: p.minutes,
    goals: p.goals,
    assists: p.assists,
    yellowCards: p.yellowCards,
    redCards: p.redCards,
    tackles: p.tackles,
    cbi: p.clearancesBlocksInterceptions,
    recoveries: p.recoveries,
    defensiveActions: p.defensiveActions,
    saves: p.saves,
    cleanSheet: p.cleanSheets,
    goalsConceded: p.goalsConceded,
  }));
}

function per90(total: number, minutes: number): number {
  return minutes > 0 ? (total / minutes) * 90 : 0;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}

// --- Mirrors provisional.ts's (private) defence config, verified identical
// against the live file as of this audit (see docs/DEFENCE_METHODOLOGY_AUDIT.md §1).
function currentDefenceScore(
  individualPer90ByPlayer: number[],
  cleanSheetPer90ByPlayer: number[],
  hasTeamComponent: boolean
): number[] {
  const indPct = percentileRank(individualPer90ByPlayer);
  if (!hasTeamComponent) return indPct.map((v) => v / 10);
  const csPct = percentileRank(cleanSheetPer90ByPlayer);
  return indPct.map((_, i) => (indPct[i] + csPct[i]) / 2 / 10);
}

function section(title: string) {
  console.log(`\n${"=".repeat(70)}\n${title}\n${"=".repeat(70)}`);
}

async function main() {
  const rows = await fetchRows();
  const enriched = rows.filter((r) => r.tackles !== null); // rows with the new components backfilled

  section("§2 — Component distributions by position (per-90, enriched rows only)");
  for (const pos of ["GKP", "DEF", "MID", "FWD"] as PositionCode[]) {
    const posRows = enriched.filter((r) => r.position === pos);
    if (posRows.length === 0) continue;
    const tPer90 = posRows.map((r) => per90(r.tackles ?? 0, r.minutes));
    const cPer90 = posRows.map((r) => per90(r.cbi ?? 0, r.minutes));
    const rPer90 = posRows.map((r) => per90(r.recoveries ?? 0, r.minutes));
    const daPer90 = posRows.map((r) => per90(r.defensiveActions, r.minutes));
    console.log(`\n${pos} (n=${posRows.length})`);
    for (const [label, xs] of [
      ["tackles/90", tPer90],
      ["CBI/90", cPer90],
      ["recoveries/90", rPer90],
      ["defensiveActions/90 (combined)", daPer90],
    ] as const) {
      console.log(
        `  ${label.padEnd(32)} mean=${mean(xs).toFixed(2)} median=${median(xs).toFixed(2)} sd=${stdev(xs).toFixed(2)} min=${Math.min(...xs).toFixed(1)} max=${Math.max(...xs).toFixed(1)}`
      );
    }
    console.log(
      `  correlation(tackles, CBI)        = ${pearson(tPer90, cPer90).toFixed(2)}\n` +
      `  correlation(tackles, recoveries) = ${pearson(tPer90, rPer90).toFixed(2)}\n` +
      `  correlation(CBI, recoveries)     = ${pearson(cPer90, rPer90).toFixed(2)}\n` +
      `  correlation(defensiveActions, recoveries) = ${pearson(daPer90, rPer90).toFixed(2)}  <- is the combined field capturing recoveries at all?`
    );
    // Confirm the exact composition rule for this position.
    const matchesTC = posRows.filter((r) => (r.tackles ?? 0) + (r.cbi ?? 0) === r.defensiveActions).length;
    const matchesTCR = posRows.filter((r) => (r.tackles ?? 0) + (r.cbi ?? 0) + (r.recoveries ?? 0) === r.defensiveActions).length;
    console.log(`  defensiveActions == tackles+CBI for ${matchesTC}/${posRows.length} rows`);
    console.log(`  defensiveActions == tackles+CBI+recoveries for ${matchesTCR}/${posRows.length} rows`);
  }

  section("§4 — Individual vs team outcome (DEF + GKP, where clean sheet is a formula input)");
  for (const pos of ["DEF", "GKP"] as PositionCode[]) {
    const posRows = enriched.filter((r) => r.position === pos);
    const individualMetric = pos === "GKP" ? posRows.map((r) => per90(r.saves, r.minutes)) : posRows.map((r) => per90(r.defensiveActions, r.minutes));
    const csMetric = posRows.map((r) => per90(r.cleanSheet, r.minutes));
    const indPct = percentileRank(individualMetric);
    const csPct = percentileRank(csMetric);
    const blended = indPct.map((_, i) => (indPct[i] + csPct[i]) / 2);

    console.log(`\n${pos} (n=${posRows.length}) — individual percentile vs blended Defence percentile`);
    const rowsWithDelta = posRows.map((r, i) => ({
      name: r.name,
      team: r.teamShortName,
      individualPct: indPct[i],
      csPct: csPct[i],
      blendedPct: blended[i],
      delta: blended[i] - indPct[i], // negative = team outcome dragged the score down
      conceded: r.goalsConceded > 0,
    }));

    const downgraded = rowsWithDelta.filter((r) => r.individualPct >= 70 && r.delta <= -15);
    const upgraded = rowsWithDelta.filter((r) => r.individualPct <= 30 && r.delta >= 15);
    console.log(`  Strong individual signal (>=70th pct) materially dragged down by team result (delta <= -15): ${downgraded.length}/${posRows.length}`);
    for (const r of downgraded) console.log(`    ${r.name} (${r.team}): individual=${r.individualPct.toFixed(0)} -> blended=${r.blendedPct.toFixed(0)} (${r.delta.toFixed(0)})`);
    console.log(`  Weak individual signal (<=30th pct) materially boosted by team result (delta >= +15): ${upgraded.length}/${posRows.length}`);
    for (const r of upgraded) console.log(`    ${r.name} (${r.team}): individual=${r.individualPct.toFixed(0)} -> blended=${r.blendedPct.toFixed(0)} (+${r.delta.toFixed(0)})`);
  }

  section("§3/§5 — Lacroix case + candidate formula comparison (DEF cohort)");
  const defRows = enriched.filter((r) => r.position === "DEF");
  const tPer90 = defRows.map((r) => per90(r.tackles ?? 0, r.minutes));
  const cPer90 = defRows.map((r) => per90(r.cbi ?? 0, r.minutes));
  const rPer90 = defRows.map((r) => per90(r.recoveries ?? 0, r.minutes));
  const daPer90 = defRows.map((r) => per90(r.defensiveActions, r.minutes));
  const csPer90 = defRows.map((r) => per90(r.cleanSheet, r.minutes));

  const tPct = percentileRank(tPer90);
  const cPct = percentileRank(cPer90);
  const rPct = percentileRank(rPer90);
  const daPct = percentileRank(daPer90);
  const csPct = percentileRank(csPer90);

  // Candidate A: current methodology (defensiveActions + cleanSheet, 50/50).
  const candidateA = daPct.map((_, i) => (daPct[i] + csPct[i]) / 2 / 10);
  // Candidate B: three separate components + clean sheet, all four equally weighted.
  const candidateB = daPct.map((_, i) => (tPct[i] + cPct[i] + rPct[i] + csPct[i]) / 4 / 10);
  // Candidate C: current individual metric, but team outcome reduced to 30% weight.
  const candidateC = daPct.map((_, i) => (daPct[i] * 0.7 + csPct[i] * 0.3) / 10);
  // Candidate D: richer individual signal (3 components averaged), clean sheet as a
  // smaller additive adjustment (+/-0.5 max) rather than a peer input.
  const richerIndividual = tPct.map((_, i) => (tPct[i] + cPct[i] + rPct[i]) / 3 / 10);
  const candidateD = richerIndividual.map((v, i) => v + ((csPct[i] - 50) / 50) * 0.5);

  const names = ["Lacroix", "Mendy", "Egan", "Acheampong", "Guéhi", "Castagne", "Virgil", "Maguire", "Shaw"];
  console.log("\nname".padEnd(13), "A(current)", "B(3-comp)", "C(70/30)", "D(hybrid)");
  defRows.forEach((r, i) => {
    if (!names.includes(r.name)) return;
    console.log(
      r.name.padEnd(13),
      candidateA[i].toFixed(2).padEnd(11),
      candidateB[i].toFixed(2).padEnd(10),
      candidateC[i].toFixed(2).padEnd(9),
      candidateD[i].toFixed(2)
    );
  });

  // Check for counterintuitive rankings: does any candidate rank a 0-defensive-action
  // clean-sheet player above a high-activity non-clean-sheet player by a wide margin?
  section("§5 — Counterintuitive-ranking check");
  const withZeroActivity = defRows
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => daPer90[i] < 3 && csPer90[i] > 0); // very low activity, but clean sheet
  for (const { r, i } of withZeroActivity.slice(0, 5)) {
    console.log(
      `${r.name} (${r.teamShortName}): da/90=${daPer90[i].toFixed(1)} (very low), clean sheet=yes -> A=${candidateA[i].toFixed(2)} B=${candidateB[i].toFixed(2)} C=${candidateC[i].toFixed(2)} D=${candidateD[i].toFixed(2)}`
    );
  }

  section("§6 — OLD (50/50) vs EXPERIMENTAL (live weighting) — implemented candidate");
  console.log(
    `Live weighting currently in provisional.ts: INDIVIDUAL_DEFENCE_WEIGHT=${CURRENT_INDIVIDUAL_WEIGHT}, TEAM_CLEAN_SHEET_WEIGHT=${CURRENT_TEAM_WEIGHT}\n` +
      `(Historical reference point, not read from any live code: ${ORIGINAL_INDIVIDUAL_WEIGHT}/${ORIGINAL_TEAM_WEIGHT})`
  );
  compareWeighting(defRows, daPer90, csPer90, "DEF");

  const gkpRows = enriched.filter((r) => r.position === "GKP");
  const savesPer90Gkp = gkpRows.map((r) => per90(r.saves, r.minutes));
  const csPer90Gkp = gkpRows.map((r) => per90(r.cleanSheet, r.minutes));
  compareWeighting(gkpRows, savesPer90Gkp, csPer90Gkp, "GKP");

  // --- §7+ (PLAYER INTELLIGENCE ACCURACY 2.0) ---------------------------
  // Uses the REAL, live getGameweekRatings() — the exact function Match
  // Centre and the player pages call — not a percentile reconstruction, so
  // every score below is provably what the app actually shows right now
  // (i.e. under the already-implemented 70/30 weighting).
  const byGameweek = new Map<number, DefenceRow[]>();
  for (const r of enriched) {
    if (r.gameweek == null) continue;
    if (!byGameweek.has(r.gameweek)) byGameweek.set(r.gameweek, []);
    byGameweek.get(r.gameweek)!.push(r);
  }

  interface FullRow extends DefenceRow {
    daPct: number; // individual-signal percentile within position, this gameweek
    attack: number;
    creation: number;
    defence: number;
    impact: number;
    overall: number;
  }
  const fullRows: FullRow[] = [];
  for (const [gw, gwRows] of byGameweek) {
    const seasonId = gwRows[0].seasonId;
    const ratings = await getGameweekRatings(seasonId, gw);
    // Individual-signal percentile, position-relative, matching provisional.ts exactly.
    const byPos = new Map<PositionCode, DefenceRow[]>();
    for (const r of gwRows) {
      if (!byPos.has(r.position)) byPos.set(r.position, []);
      byPos.get(r.position)!.push(r);
    }
    const daPctByPlayer = new Map<string, number>();
    for (const [pos, posRows] of byPos) {
      const metric = pos === "GKP" ? posRows.map((r) => per90(r.saves, r.minutes)) : posRows.map((r) => per90(r.defensiveActions, r.minutes));
      const pct = percentileRank(metric);
      posRows.forEach((r, i) => daPctByPlayer.set(r.playerId, pct[i]));
    }
    for (const r of gwRows) {
      const rating = ratings.get(r.playerId);
      if (!rating) continue;
      fullRows.push({
        ...r,
        daPct: daPctByPlayer.get(r.playerId) ?? 0,
        attack: rating.scores.attack ?? 0,
        creation: rating.scores.creation ?? 0,
        defence: rating.scores.defence ?? 0,
        impact: rating.scores.impact ?? 0,
        overall: rating.scores.overall ?? 0,
      });
    }
  }
  const outfield = fullRows.filter((r) => r.position !== "GKP" && r.position !== "FWD" && r.position !== "MID");
  const defOnly = fullRows.filter((r) => r.position === "DEF");

  function printCases(title: string, rows: FullRow[], limit = 6) {
    console.log(`\n${title} (${rows.length} found)`);
    for (const r of rows.slice(0, limit)) {
      console.log(
        `  ${r.name.padEnd(14)} (${r.teamShortName}) da/90pct=${r.daPct.toFixed(0)} cs=${r.cleanSheet} gc=${r.goalsConceded} g=${r.goals} a=${r.assists} yc=${r.yellowCards} rc=${r.redCards}` +
          ` | Def=${r.defence.toFixed(1)} Cre=${r.creation.toFixed(1)} Imp=${r.impact.toFixed(1)} Ovr=${r.overall.toFixed(1)}`
      );
    }
  }

  section("§7 — Twelve real-data anomaly categories (DEF cohort unless noted)");
  printCases("1. HIGH defensive activity + team CONCEDED", defOnly.filter((r) => r.daPct >= 80 && r.goalsConceded > 0).sort((a, b) => b.daPct - a.daPct));
  printCases("2. LOW defensive activity + CLEAN SHEET", defOnly.filter((r) => r.daPct <= 20 && r.cleanSheet === 1).sort((a, b) => a.daPct - b.daPct));
  printCases("3. HIGH defensive activity + CLEAN SHEET (aligned case)", defOnly.filter((r) => r.daPct >= 80 && r.cleanSheet === 1).sort((a, b) => b.daPct - a.daPct));
  printCases("4. LOW defensive activity + CONCEDED (aligned case, other direction)", defOnly.filter((r) => r.daPct <= 20 && r.goalsConceded > 0).sort((a, b) => a.daPct - b.daPct));
  printCases("5. HIGH defensive activity + ASSIST", defOnly.filter((r) => r.daPct >= 70 && r.assists >= 1).sort((a, b) => b.daPct - a.daPct));
  printCases("6. HIGH defensive activity + GOAL", defOnly.filter((r) => r.daPct >= 70 && r.goals >= 1).sort((a, b) => b.daPct - a.daPct));
  printCases("7. HIGH defensive activity + CARD", defOnly.filter((r) => r.daPct >= 70 && (r.yellowCards > 0 || r.redCards > 0)).sort((a, b) => b.daPct - a.daPct));
  printCases("8. VERY LOW defensive activity + HIGH overall Match Rating", outfield.filter((r) => r.daPct <= 20 && r.overall >= 7.5).sort((a, b) => b.overall - a.overall));
  printCases("9. VERY HIGH defensive activity + LOW overall Match Rating", outfield.filter((r) => r.daPct >= 80 && r.overall <= 4.5).sort((a, b) => a.overall - b.overall));
  printCases("10. DEF: Creation high but Defence unexpectedly low", defOnly.filter((r) => r.creation >= 7 && r.defence <= 4).sort((a, b) => b.creation - a.creation));
  printCases(
    "11. DEF/GKP: Defence score high despite very low individual activity (does 70/30 still allow this?)",
    fullRows.filter((r) => (r.position === "DEF" || r.position === "GKP") && r.defence >= 7 && r.daPct <= 25).sort((a, b) => b.defence - a.defence)
  );

  section("§7.12 — DEF/GKP within 0.3 of an archetype threshold (LOW=4.0, ELEVATED=5.5) — one gameweek from flipping");
  const nearThreshold = fullRows.filter(
    (r) =>
      (r.position === "DEF" || r.position === "GKP") &&
      (Math.abs(r.defence - 4.0) <= 0.3 || Math.abs(r.defence - 5.5) <= 0.3)
  );
  for (const r of nearThreshold) {
    console.log(`  ${r.name.padEnd(14)} (${r.teamShortName}) Defence=${r.defence.toFixed(2)} — within 0.3 of a threshold`);
  }

  section("§8 — Candidate E: recoveries as a third individual component for DEF only (avoids double-counting per the audit's own finding — recoveries is NOT part of defensiveActions for DEF)");
  {
    const t = defRows.map((r) => per90(r.tackles ?? 0, r.minutes));
    const c = defRows.map((r) => per90(r.cbi ?? 0, r.minutes));
    const rec = defRows.map((r) => per90(r.recoveries ?? 0, r.minutes));
    const cs = defRows.map((r) => per90(r.cleanSheet, r.minutes));
    const daP = percentileRank(defRows.map((r) => per90(r.defensiveActions, r.minutes)));
    const tP = percentileRank(t);
    const cP = percentileRank(c);
    const recP = percentileRank(rec);
    const csP = percentileRank(cs);
    // Individual signal = defensiveActions (tackles+CBI, unchanged) PLUS recoveries as
    // a genuinely new, previously-uncounted third input — NOT replacing defensiveActions,
    // additively broadening what "individual signal" means, at 3-way equal standing,
    // then blended with clean sheet at the current live 70/30 ratio.
    const richerIndividual = daP.map((_, i) => (daP[i] * 2 + recP[i]) / 3); // defensiveActions counted double vs recoveries alone, since it's itself 2 real actions (tackles+CBI) vs recoveries' 1
    const candidateE = richerIndividual.map((v, i) => (v * CURRENT_INDIVIDUAL_WEIGHT + csP[i] * CURRENT_TEAM_WEIGHT) / 10);
    const liveDefenceByName = new Map(defOnly.map((r) => [r.name, r.defence]));
    console.log("\nname".padEnd(13), "live(70/30, DA-only)", "E(+recoveries)");
    defRows.forEach((r, i) => {
      if (!names.includes(r.name)) return;
      console.log(r.name.padEnd(13), (liveDefenceByName.get(r.name) ?? 0).toFixed(2).padEnd(21), candidateE[i].toFixed(2));
    });
  }

  process.exit(0);
}

/**
 * Prints OLD (historical 50/50) vs EXPERIMENTAL (live, imported from
 * provisional.ts) Defence scores and rankings for a full position cohort —
 * the regression comparison requested when the experimental weighting was
 * implemented. Re-run this whole script once more gameweeks exist to see
 * whether the same players/patterns still show up.
 */
function compareWeighting(rows: DefenceRow[], individualPer90: number[], teamPer90: number[], label: string) {
  const individualPct = percentileRank(individualPer90);
  const teamPct = percentileRank(teamPer90);
  const oldScore = individualPct.map((_, i) => (individualPct[i] * ORIGINAL_INDIVIDUAL_WEIGHT + teamPct[i] * ORIGINAL_TEAM_WEIGHT) / 10);
  const newScore = individualPct.map((_, i) => (individualPct[i] * CURRENT_INDIVIDUAL_WEIGHT + teamPct[i] * CURRENT_TEAM_WEIGHT) / 10);

  function ranksOf(scores: number[]): number[] {
    const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const rank = new Array(scores.length);
    order.forEach((o, pos) => (rank[o.i] = pos + 1));
    return rank;
  }
  const oldRanks = ranksOf(oldScore);
  const newRanks = ranksOf(newScore);

  console.log(`\n${label} (n=${rows.length})`);
  console.log(
    "name".padEnd(14), "indPct".padEnd(7), "teamPct".padEnd(8), "old".padEnd(6), "new".padEnd(6), "delta".padEnd(7), "oldRank".padEnd(8), "newRank".padEnd(8), "rankChg"
  );
  rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => newScore[a.i] - oldScore[a.i] === newScore[b.i] - oldScore[b.i] ? 0 : (newScore[b.i] - oldScore[b.i]) - (newScore[a.i] - oldScore[a.i]))
    .forEach(({ r, i }) => {
      const delta = newScore[i] - oldScore[i];
      const rankChg = oldRanks[i] - newRanks[i]; // positive = moved up (better rank)
      console.log(
        r.name.padEnd(14),
        individualPct[i].toFixed(0).padEnd(7),
        teamPct[i].toFixed(0).padEnd(8),
        oldScore[i].toFixed(2).padEnd(6),
        newScore[i].toFixed(2).padEnd(6),
        (delta >= 0 ? "+" : "") + delta.toFixed(2).padEnd(6),
        String(oldRanks[i]).padEnd(8),
        String(newRanks[i]).padEnd(8),
        (rankChg > 0 ? "+" : "") + String(rankChg)
      );
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
