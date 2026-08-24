import { prisma } from "@/lib/db/client";
import type { PositionCode } from "@/lib/competitions/premier-league";
import { getPlayerPhotoUrl, getTeamCrestUrl } from "@/lib/assets/images";
import type { PlayerPerformanceInput } from "./provisional";

/**
 * How many recent appearances to carry per player. Form only reads the
 * first 5 (see RECENCY_WEIGHTS in provisional.ts); Consistency/Momentum
 * (lib/analytics/intelligence) use the full log. Capped rather than
 * unbounded — a pragmatic v1 choice, revisit once a full season exists.
 */
const MATCH_LOG_SIZE = 12;

/**
 * The only place in the application that translates normalized database
 * rows into the analytics engine's input shape. Nothing above this layer
 * (pages, components) queries Prisma directly for performance data, and
 * nothing below it (the scoring engine) knows a database exists.
 *
 * Deliberately its own file, separate from repository.ts: matchRepository.ts
 * needs this too (to compute a player's season baseline for the
 * baselineDivergence voice mechanism — see lib/analytics/voice/) and
 * repository.ts already imports FROM matchRepository.ts
 * (getPlayerMatchRatings), so matchRepository.ts importing this function
 * back from repository.ts would be a circular import. Both files import it
 * from here instead; repository.ts re-exports it unchanged so nothing
 * else in the app needs to know this moved.
 */
export async function getCurrentSeasonPerformanceInputs(): Promise<
  PlayerPerformanceInput[]
> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return [];

  const [players, performances] = await Promise.all([
    prisma.player.findMany({
      where: { competitionId: season.competitionId },
      include: { team: true },
    }),
    prisma.playerMatchPerformance.findMany({
      where: { match: { seasonId: season.id, status: "finished" } },
      orderBy: { match: { kickoff: "desc" } },
    }),
  ]);

  const performancesByPlayer = new Map<string, typeof performances>();
  for (const perf of performances) {
    const list = performancesByPlayer.get(perf.playerId) ?? [];
    list.push(perf);
    performancesByPlayer.set(perf.playerId, list);
  }

  return players.map((player) => {
    // Already ordered by kickoff desc (most recent first).
    const perfs = performancesByPlayer.get(player.id) ?? [];
    const appearances = perfs.filter((p) => p.minutes > 0);
    const sum = (fn: (p: (typeof perfs)[number]) => number) =>
      perfs.reduce((total, p) => total + fn(p), 0);

    return {
      id: player.id,
      slug: player.slug,
      name: player.displayName,
      teamShortName: player.team.shortName,
      position: player.position as PositionCode,
      photoUrl: getPlayerPhotoUrl(player.photoCode),
      teamCrestUrl: getTeamCrestUrl(player.team.crestCode),
      season: {
        minutes: sum((p) => p.minutes),
        matches: appearances.length,
        goals: sum((p) => p.goals),
        assists: sum((p) => p.assists),
        cleanSheets: sum((p) => p.cleanSheets),
        saves: sum((p) => p.saves),
        xg: sum((p) => p.expectedGoals),
        xa: sum((p) => p.expectedAssists),
        defensiveActions: sum((p) => p.defensiveActions),
        // bps (FPL's match-contribution score), not ictIndex — see the note
        // at the top of provisional.ts for why.
        bps: sum((p) => p.bps),
      },
      matchLog: appearances.slice(0, MATCH_LOG_SIZE).map((p) => ({
        minutes: p.minutes,
        bps: p.bps,
      })),
    };
  });
}
