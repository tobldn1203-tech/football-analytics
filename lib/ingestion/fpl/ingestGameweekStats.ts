import { prisma } from "@/lib/db/client";
import { fetchFplEventLive } from "@/lib/providers/fpl/client";
import type { FplEventLiveElement } from "@/lib/providers/fpl/types";
import { PROVIDER } from "./context";

const CLEAN_SHEET_MIN_MINUTES = 60; // matches the convention FPL itself uses

/**
 * Pulls the defensive-action component breakdown out of one player's raw
 * gameweek stats — see docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md §9. A
 * pure, isolated mapping (no DB, no Prisma) specifically so it's easy to
 * test the parsing on its own — see __tests__/ingestGameweekStats.test.ts.
 * `defensiveActions` (the existing combined field) is included unchanged
 * alongside the three new components, so every call site building a
 * PlayerMatchPerformance row can spread one object rather than repeating
 * all four fields.
 */
export function mapDefensiveFields(stats: FplEventLiveElement["stats"]) {
  return {
    defensiveActions: stats.defensive_contribution,
    tackles: stats.tackles,
    clearancesBlocksInterceptions: stats.clearances_blocks_interceptions,
    recoveries: stats.recoveries,
  };
}

/**
 * For every finished gameweek, fetches the single bulk "event live" payload
 * (one request per gameweek, not per player) and fills in the half of each
 * PlayerMatchPerformance row that ingestFixtures leaves at zero: minutes,
 * xG/xA/xGC, defensive actions (combined, plus the tackles/CBI/recoveries
 * breakdown — see mapDefensiveFields below), ICT index, and clean sheets/
 * goals conceded (which need minutes to apply FPL's 60-minute clean-sheet
 * convention).
 *
 * Known simplification: a player's gameweek total is attributed to the one
 * match their team played that gameweek. Rare double-gameweeks (a team
 * playing twice in one gameweek) would need per-fixture live data this
 * endpoint doesn't provide — not worth the complexity for the MVP.
 */
export async function ingestGameweekStats(gameweekIds: number[], seasonId: string) {
  const players = await prisma.player.findMany({ where: { provider: PROVIDER } });
  const playerById = new Map(players.map((p) => [p.externalId, p]));

  let written = 0;

  for (const gameweekId of gameweekIds) {
    const matches = await prisma.match.findMany({
      where: { seasonId, gameweek: gameweekId, status: "finished" },
    });
    const matchByTeamId = new Map<string, (typeof matches)[number]>();
    for (const m of matches) {
      matchByTeamId.set(m.homeTeamId, m);
      matchByTeamId.set(m.awayTeamId, m);
    }

    const live = await fetchFplEventLive(gameweekId);

    for (const el of live.elements) {
      const player = playerById.get(String(el.id));
      if (!player) continue;
      const match = matchByTeamId.get(player.teamId);
      if (!match || el.stats.minutes === 0) continue;

      const isHome = match.homeTeamId === player.teamId;
      const goalsAgainst = isHome ? match.awayScore : match.homeScore;
      const cleanSheet =
        el.stats.minutes >= CLEAN_SHEET_MIN_MINUTES && goalsAgainst === 0 ? 1 : 0;

      await prisma.playerMatchPerformance.upsert({
        where: { playerId_matchId: { playerId: player.id, matchId: match.id } },
        create: {
          playerId: player.id,
          matchId: match.id,
          teamId: player.teamId,
          minutes: el.stats.minutes,
          started: el.stats.starts === 1,
          expectedGoals: el.stats.expected_goals,
          expectedAssists: el.stats.expected_assists,
          expectedGoalsConceded: el.stats.expected_goals_conceded,
          ...mapDefensiveFields(el.stats),
          ictIndex: el.stats.ict_index,
          cleanSheets: cleanSheet,
          goalsConceded: goalsAgainst ?? 0,
        },
        update: {
          minutes: el.stats.minutes,
          started: el.stats.starts === 1,
          expectedGoals: el.stats.expected_goals,
          expectedAssists: el.stats.expected_assists,
          expectedGoalsConceded: el.stats.expected_goals_conceded,
          ...mapDefensiveFields(el.stats),
          ictIndex: el.stats.ict_index,
          cleanSheets: cleanSheet,
          goalsConceded: goalsAgainst ?? 0,
        },
      });
      written++;
    }
  }

  return written;
}
