import {
  fetchFplBootstrap,
  fetchFplFixtures,
} from "@/lib/providers/fpl/client";
import { prisma } from "@/lib/db/client";
import { ensureCompetitionAndSeason, logIngestion, PROVIDER } from "./context";
import { ingestTeams } from "./ingestTeams";
import { ingestPlayers } from "./ingestPlayers";
import { ingestFixtures } from "./ingestFixtures";
import { ingestGameweekStats } from "./ingestGameweekStats";

/**
 * Runs the full FPL ingestion pipeline in dependency order. Every step
 * upserts by (provider, externalId), so running this repeatedly — on a
 * schedule, or by hand — never creates duplicates.
 */
export async function runFplIngestion() {
  const bootstrap = await fetchFplBootstrap();
  await prisma.rawIngestionPayload.create({
    data: {
      provider: PROVIDER,
      endpoint: "bootstrap-static",
      payload: JSON.stringify({
        teamCount: bootstrap.teams.length,
        elementCount: bootstrap.elements.length,
      }),
    },
  });

  const { competition, season } = await ensureCompetitionAndSeason(bootstrap);

  const teamsWritten = await logIngestion("teams", async () => {
    const n = await ingestTeams(bootstrap.teams, competition.id);
    return { recordsWritten: n, result: n };
  });

  const playersWritten = await logIngestion("players", async () => {
    const n = await ingestPlayers(bootstrap.elements, competition.id);
    return { recordsWritten: n, result: n };
  });

  const fixtures = await fetchFplFixtures();
  const fixtureResult = await logIngestion("fixtures", async () => {
    const r = await ingestFixtures(fixtures, competition.id, season.id);
    return { recordsWritten: r.matchesWritten + r.performancesWritten, result: r };
  });

  const finishedGameweeks = [
    ...new Set(
      fixtures
        .filter((f) => f.finished_provisional && f.event !== null)
        .map((f) => f.event!)
    ),
  ];
  const gwStatsWritten = await logIngestion("gameweek-stats", async () => {
    const n = await ingestGameweekStats(finishedGameweeks, season.id);
    return { recordsWritten: n, result: n };
  });

  return {
    season: season.label,
    teamsWritten,
    playersWritten,
    matchesWritten: fixtureResult.matchesWritten,
    eventAttributionsWritten: fixtureResult.performancesWritten,
    gameweekStatsWritten: gwStatsWritten,
  };
}
