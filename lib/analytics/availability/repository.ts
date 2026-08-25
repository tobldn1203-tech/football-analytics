import { prisma } from "@/lib/db/client";
import { interpretPlayerAvailability } from "./interpret";
import type { PlayerAvailability } from "./types";

/**
 * The single place any surface should go to ask "what's this player's
 * current availability?" — see docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md
 * §8. Callers never read Player.status/chanceOfPlayingNextRound or
 * NewsItem directly for this purpose; that keeps the interpretation rules
 * (docs §7) centralised in one place instead of re-derived per surface.
 *
 * Deliberately does NOT accept or return anything about Performance
 * scores/minutes played. Filtering an aggregate view (a squad, a
 * supported club) down to players who are actually relevant is the
 * calling surface's job — it already has a RankedPlayer list with
 * `scores.overall` for exactly that purpose (see
 * docs/NEWS_CONTEXT_PRODUCT_DESIGN.md §3/§6). Keeping that decision out of
 * this module is what lets Team Intelligence and My Football reuse it
 * later without this module needing to know about scoring at all.
 */
export async function getPlayerAvailability(playerId: string): Promise<PlayerAvailability | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { status: true, chanceOfPlayingNextRound: true },
  });
  if (!player) return null;

  const latest = await prisma.newsItem.findFirst({
    where: { playerId },
    orderBy: { publishedAt: "desc" },
  });

  return interpretPlayerAvailability({
    status: player.status,
    chanceOfPlayingNextRound: player.chanceOfPlayingNextRound,
    latestNews: latest
      ? { description: latest.description, publishedAt: latest.publishedAt, sourceName: latest.sourceName }
      : null,
  });
}

/**
 * Bulk variant for a future squad/club view (Team Intelligence, My
 * Football — not built in this phase, see docs §8) so that surface can
 * fetch every player's availability in two queries instead of N. Not
 * currently called anywhere; included now so that future work composes
 * this primitive rather than re-deriving it.
 */
export async function getPlayerAvailabilityMap(
  playerIds: string[]
): Promise<Map<string, PlayerAvailability>> {
  if (playerIds.length === 0) return new Map();

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, status: true, chanceOfPlayingNextRound: true },
  });

  const newsItems = await prisma.newsItem.findMany({
    where: { playerId: { in: playerIds } },
    orderBy: { publishedAt: "desc" },
  });
  const latestByPlayerId = new Map<string, (typeof newsItems)[number]>();
  for (const item of newsItems) {
    if (!item.playerId || latestByPlayerId.has(item.playerId)) continue;
    latestByPlayerId.set(item.playerId, item);
  }

  const result = new Map<string, PlayerAvailability>();
  for (const player of players) {
    const latest = latestByPlayerId.get(player.id) ?? null;
    const availability = interpretPlayerAvailability({
      status: player.status,
      chanceOfPlayingNextRound: player.chanceOfPlayingNextRound,
      latestNews: latest
        ? { description: latest.description, publishedAt: latest.publishedAt, sourceName: latest.sourceName }
        : null,
    });
    if (availability) result.set(player.id, availability);
  }
  return result;
}
