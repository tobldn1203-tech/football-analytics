import { prisma } from "@/lib/db/client";
import type { FplFixture, FplFixtureStatT } from "@/lib/providers/fpl/types";
import { PROVIDER } from "./context";

interface EventCounts {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  bonus: number;
  bps: number;
}

interface PlayerEventTotals extends EventCounts {
  teamId: string;
}

const STAT_FIELD: Partial<Record<string, keyof EventCounts>> = {
  goals_scored: "goals",
  assists: "assists",
  yellow_cards: "yellowCards",
  red_cards: "redCards",
  saves: "saves",
  bonus: "bonus",
  bps: "bps",
};

function emptyTotals(teamId: string): PlayerEventTotals {
  return { teamId, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 0, bonus: 0, bps: 0 };
}

function accumulateFixtureStats(
  stats: FplFixtureStatT[],
  homeTeamId: string,
  awayTeamId: string
): Map<number, PlayerEventTotals> {
  const totals = new Map<number, PlayerEventTotals>();
  const apply = (side: "h" | "a", teamId: string) => {
    for (const stat of stats) {
      const field = STAT_FIELD[stat.identifier];
      if (!field) continue;
      for (const entry of stat[side]) {
        const current = totals.get(entry.element) ?? emptyTotals(teamId);
        current[field] += entry.value;
        totals.set(entry.element, current);
      }
    }
  };
  apply("h", homeTeamId);
  apply("a", awayTeamId);
  return totals;
}

/**
 * Upserts every fixture as a Match, derives each team's W/D/L result, and
 * builds the goals/assists/cards/saves/bonus/bps half of each finished
 * match's PlayerMatchPerformance rows (the other half — minutes, xG/xA,
 * defensive actions, clean sheets — comes from ingestGameweekStats).
 * Safe to run repeatedly.
 */
export async function ingestFixtures(
  fixtures: FplFixture[],
  competitionId: string,
  seasonId: string
) {
  const teams = await prisma.team.findMany({ where: { provider: PROVIDER } });
  const teamIdByExternalId = new Map(teams.map((t) => [t.externalId, t.id]));
  const players = await prisma.player.findMany({ where: { provider: PROVIDER } });
  const playerIdByExternalId = new Map(players.map((p) => [p.externalId, p.id]));

  let matchesWritten = 0;
  let performancesWritten = 0;

  for (const fx of fixtures) {
    if (!fx.kickoff_time) continue; // unscheduled fixture, nothing usable yet

    const homeTeamId = teamIdByExternalId.get(String(fx.team_h));
    const awayTeamId = teamIdByExternalId.get(String(fx.team_a));
    if (!homeTeamId || !awayTeamId) continue;

    const match = await prisma.match.upsert({
      where: { provider_externalId: { provider: PROVIDER, externalId: String(fx.id) } },
      create: {
        provider: PROVIDER,
        externalId: String(fx.id),
        competitionId,
        seasonId,
        gameweek: fx.event,
        kickoff: new Date(fx.kickoff_time),
        status: fx.finished_provisional ? "finished" : "scheduled",
        homeTeamId,
        awayTeamId,
        homeScore: fx.team_h_score,
        awayScore: fx.team_a_score,
      },
      update: {
        gameweek: fx.event,
        kickoff: new Date(fx.kickoff_time),
        status: fx.finished_provisional ? "finished" : "scheduled",
        homeScore: fx.team_h_score,
        awayScore: fx.team_a_score,
      },
    });
    matchesWritten++;

    if (!fx.finished_provisional || fx.team_h_score === null || fx.team_a_score === null)
      continue;

    const resultFor = (goalsFor: number, goalsAgainst: number) =>
      goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";

    await prisma.teamMatchPerformance.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId: homeTeamId } },
      create: {
        matchId: match.id,
        teamId: homeTeamId,
        isHome: true,
        goalsFor: fx.team_h_score,
        goalsAgainst: fx.team_a_score,
        result: resultFor(fx.team_h_score, fx.team_a_score),
      },
      update: {
        goalsFor: fx.team_h_score,
        goalsAgainst: fx.team_a_score,
        result: resultFor(fx.team_h_score, fx.team_a_score),
      },
    });
    await prisma.teamMatchPerformance.upsert({
      where: { matchId_teamId: { matchId: match.id, teamId: awayTeamId } },
      create: {
        matchId: match.id,
        teamId: awayTeamId,
        isHome: false,
        goalsFor: fx.team_a_score,
        goalsAgainst: fx.team_h_score,
        result: resultFor(fx.team_a_score, fx.team_h_score),
      },
      update: {
        goalsFor: fx.team_a_score,
        goalsAgainst: fx.team_h_score,
        result: resultFor(fx.team_a_score, fx.team_h_score),
      },
    });

    const totalsByElement = accumulateFixtureStats(fx.stats, homeTeamId, awayTeamId);
    for (const [elementId, totals] of totalsByElement) {
      const playerId = playerIdByExternalId.get(String(elementId));
      if (!playerId) continue;

      await prisma.playerMatchPerformance.upsert({
        where: { playerId_matchId: { playerId, matchId: match.id } },
        create: {
          playerId,
          matchId: match.id,
          teamId: totals.teamId,
          goals: totals.goals,
          assists: totals.assists,
          yellowCards: totals.yellowCards,
          redCards: totals.redCards,
          saves: totals.saves,
          bonus: totals.bonus,
          bps: totals.bps,
        },
        update: {
          goals: totals.goals,
          assists: totals.assists,
          yellowCards: totals.yellowCards,
          redCards: totals.redCards,
          saves: totals.saves,
          bonus: totals.bonus,
          bps: totals.bps,
        },
      });
      performancesWritten++;
    }
  }

  return { matchesWritten, performancesWritten };
}
