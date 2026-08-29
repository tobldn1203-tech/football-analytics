import { prisma } from "@/lib/db/client";
import type { PositionCode } from "@/lib/competitions/premier-league";
import { getPlayerPhotoUrl, getTeamCrestUrl } from "@/lib/assets/images";
import {
  computeProvisionalRankings,
  type MatchLogEntry,
  type ProvisionalRankingResult,
} from "./provisional";
import type { RankedPlayer, Category } from "./types";
import { computeConsistency } from "@/lib/analytics/intelligence/consistency";
import { computeMomentum } from "@/lib/analytics/intelligence/momentum";
import { buildPlayerIntelligence } from "@/lib/analytics/intelligence/summary";
import type { PlayerIntelligence } from "@/lib/analytics/intelligence/types";
import { getPlayerMatchRatings } from "./matchRepository";
import type { MatchRating } from "./matchRating";
import { getCurrentSeasonPerformanceInputs } from "./seasonInputs";

// Re-exported for backward compatibility — moved to seasonInputs.ts so
// matchRepository.ts can use it too without a circular import (repository.ts
// already imports getPlayerMatchRatings FROM matchRepository.ts). See that
// file's module comment.
export { getCurrentSeasonPerformanceInputs };

export async function getTopPerformers(): Promise<ProvisionalRankingResult> {
  const inputs = await getCurrentSeasonPerformanceInputs();
  return computeProvisionalRankings(inputs);
}

export interface PlayerMatchRow {
  matchId: string;
  gameweek: number | null;
  kickoff: string;
  opponentTeamId: string;
  opponentShortName: string;
  opponentCrestUrl: string | null;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  cleanSheet: boolean;
  /** FPL's match-contribution score — used as a per-match "how involved were they" signal. */
  bps: number;
  /** Null when this match didn't clear the ranking engine's minutes floor. See matchRating.ts. */
  matchRating: { score: number; label: string; lowMinutes: boolean } | null;
}

export interface PlayerProfileData {
  player: {
    id: string;
    slug: string;
    name: string;
    teamId: string;
    teamShortName: string;
    teamName: string;
    position: PositionCode;
    photoUrl: string | null;
    teamCrestUrl: string | null;
    nationality: string | null;
    nationalityCode: string | null;
  };
  /** Null if the player hasn't yet met the minimum-minutes threshold for ranking. */
  ranking: RankedPlayer | null;
  /** Most recent match first. */
  matches: PlayerMatchRow[];
}

export async function getPlayerProfile(slug: string): Promise<PlayerProfileData | null> {
  const player = await prisma.player.findUnique({
    where: { slug },
    include: { team: true },
  });
  if (!player) return null;

  const performances = await prisma.playerMatchPerformance.findMany({
    where: { playerId: player.id, match: { status: "finished" } },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { match: { kickoff: "desc" } },
  });

  const gameweeks = performances.map((p) => p.match.gameweek).filter((gw): gw is number => gw != null);
  const ratingsByGameweek: Map<number, MatchRating> =
    performances[0] && gameweeks.length > 0
      ? await getPlayerMatchRatings(performances[0].match.seasonId, player.id, gameweeks)
      : new Map();

  const matches: PlayerMatchRow[] = performances.map((p) => {
    const isHome = p.match.homeTeamId === player.teamId;
    const opponent = isHome ? p.match.awayTeam : p.match.homeTeam;
    const rating = p.match.gameweek != null ? ratingsByGameweek.get(p.match.gameweek) : undefined;
    return {
      matchId: p.matchId,
      gameweek: p.match.gameweek,
      kickoff: p.match.kickoff.toISOString(),
      opponentTeamId: isHome ? p.match.awayTeamId : p.match.homeTeamId,
      opponentShortName: opponent.shortName,
      opponentCrestUrl: getTeamCrestUrl(opponent.crestCode),
      isHome,
      teamScore: isHome ? p.match.homeScore : p.match.awayScore,
      opponentScore: isHome ? p.match.awayScore : p.match.homeScore,
      minutes: p.minutes,
      goals: p.goals,
      assists: p.assists,
      yellowCards: p.yellowCards,
      redCards: p.redCards,
      cleanSheet: p.cleanSheets > 0,
      bps: p.bps,
      matchRating: rating
        ? { score: rating.scores.overall ?? 0, label: rating.qualityLabel, lowMinutes: rating.lowMinutes }
        : null,
    };
  });

  // Recomputed from the same pipeline the homepage uses, so a player's
  // score never differs depending on which page you view it from.
  const inputs = await getCurrentSeasonPerformanceInputs();
  const { players } = computeProvisionalRankings(inputs);
  const ranking = players.find((r) => r.playerId === player.id) ?? null;

  return {
    player: {
      id: player.id,
      slug: player.slug,
      name: player.displayName,
      teamId: player.teamId,
      teamShortName: player.team.shortName,
      teamName: player.team.name,
      position: player.position as PositionCode,
      photoUrl: getPlayerPhotoUrl(player.photoCode),
      teamCrestUrl: getTeamCrestUrl(player.team.crestCode),
      nationality: player.nationality,
      nationalityCode: player.nationalityCode,
    },
    ranking,
    matches,
  };
}

/**
 * Composes the full Performance Intelligence object from an
 * already-fetched profile — use this when the caller already has one (e.g.
 * the player page), to avoid a second round-trip. Returns null when the
 * player hasn't met the ranking minutes floor yet.
 */
export function intelligenceFromProfile(profile: PlayerProfileData): PlayerIntelligence | null {
  if (!profile.ranking) return null;
  const matchLog: MatchLogEntry[] = profile.matches
    .filter((m) => m.minutes > 0)
    .map((m) => ({ minutes: m.minutes, bps: m.bps }));
  return buildPlayerIntelligence(profile.ranking, matchLog, profile.player.teamName);
}

/**
 * Composes the full Performance Intelligence object for one player — see
 * lib/analytics/intelligence. Returns null both when the player doesn't
 * exist and when they haven't met the ranking minutes floor yet (same
 * "not yet ranked" case getPlayerProfile already handles).
 */
export async function getPlayerIntelligence(slug: string): Promise<PlayerIntelligence | null> {
  const profile = await getPlayerProfile(slug);
  if (!profile) return null;
  return intelligenceFromProfile(profile);
}

/**
 * Picks the player's standout matches to feature — "Best Performances",
 * ranked by the real Match Rating (lib/analytics/scoring/matchRating.ts)
 * wherever one exists, since that's the same methodology already shown on
 * every Match Centre page. Falls back to a simple event-based heuristic
 * only for the rare match with no rating (below the ranking engine's
 * minutes floor) — never shown to the user as a score itself, just used to
 * order real, verified match facts when no rating is available to sort by.
 */
export function pickBestPerformances(
  matches: PlayerMatchRow[],
  count: number
): PlayerMatchRow[] {
  const heuristicValue = (m: PlayerMatchRow) =>
    m.goals * 3 + m.assists * 2 + (m.cleanSheet ? 2 : 0) + m.bps * 0.05;
  const rankValue = (m: PlayerMatchRow) =>
    m.matchRating ? 100 + m.matchRating.score : heuristicValue(m);

  return [...matches]
    .filter((m) => m.minutes > 0)
    .sort((a, b) => rankValue(b) - rankValue(a))
    .slice(0, count);
}

// --- Homepage Discover sections ---
// Every section below is derived entirely from scores/data already computed
// above — no new statistics, no invented metrics. Just different ways of
// sorting and reading the same numbers.

export interface DiscoverEntry {
  player: RankedPlayer;
  indicator: string;
}

export interface HomepageDiscover {
  inForm: DiscoverEntry[];
  rising: DiscoverEntry[];
  mostConsistent: DiscoverEntry[];
  underTheRadar: DiscoverEntry[];
  recentStandouts: DiscoverEntry[];
}

const DISCOVER_COUNT = 4;

/**
 * @param count How many entries per section — 4 for the compact homepage
 * teaser (default, unchanged behaviour), more (e.g. 12) for the dedicated
 * /discover page. Same underlying data and sort either way.
 */
export async function getHomepageDiscover(count: number = DISCOVER_COUNT): Promise<HomepageDiscover> {
  const inputs = await getCurrentSeasonPerformanceInputs();
  const { players } = computeProvisionalRankings(inputs);
  const inputById = new Map(inputs.map((p) => [p.id, p]));

  const inForm = [...players]
    .sort((a, b) => (b.scores.form ?? 0) - (a.scores.form ?? 0))
    .slice(0, count)
    .map((player) => ({ player, indicator: `Form ${(player.scores.form ?? 0).toFixed(1)}` }));

  // "Rising": strongest positive Momentum (lib/analytics/intelligence) —
  // recent per-90 match contribution meaningfully above the player's own
  // season baseline. Deterministic, not AI-selected.
  const momentumByPlayer = new Map(
    players.map((p) => [p.playerId, computeMomentum(inputById.get(p.playerId)?.matchLog ?? [])])
  );
  const rising = [...players]
    .filter((p) => momentumByPlayer.get(p.playerId)?.direction === "RISING")
    .sort(
      (a, b) => (momentumByPlayer.get(b.playerId)?.magnitude ?? 0) - (momentumByPlayer.get(a.playerId)?.magnitude ?? 0)
    )
    .slice(0, count)
    .map((player) => ({ player, indicator: `Trending up` }));

  // "Most Consistent": strong Performance AND high Consistency — both
  // genuinely required, so this never surfaces a merely-steady mediocre
  // player.
  const consistencyByPlayer = new Map(
    players.map((p) => [p.playerId, computeConsistency(inputById.get(p.playerId)?.matchLog ?? [])])
  );
  const mostConsistent = [...players]
    .filter((p) => {
      const c = consistencyByPlayer.get(p.playerId);
      return (p.scores.overall ?? 0) >= 6.5 && c?.available && (c.score ?? 0) >= 7;
    })
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
    .slice(0, count)
    .map((player) => ({ player, indicator: consistencyByPlayer.get(player.playerId)!.label }));

  // "Under the radar": performing well already, before a big sample size
  // has built a reputation — a real distinction (score vs. matches played),
  // not a new metric.
  const underTheRadar = [...players]
    .filter((p) => (p.scores.overall ?? 0) >= 6.5 && p.sample.confidence !== "established")
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
    .slice(0, count)
    .map((player) => ({
      player,
      indicator: `${player.sample.matches} match${player.sample.matches === 1 ? "" : "es"} so far`,
    }));

  const recentStandouts = await getRecentGameweekStandouts(players, count);

  return { inForm, rising, mostConsistent, underTheRadar, recentStandouts };
}

async function getRecentGameweekStandouts(
  players: RankedPlayer[],
  count: number
): Promise<DiscoverEntry[]> {
  const latestMatch = await prisma.match.findFirst({
    where: { status: "finished" },
    orderBy: { kickoff: "desc" },
  });
  if (!latestMatch) return [];

  const latestGameweekPerfs = await prisma.playerMatchPerformance.findMany({
    where: { match: { gameweek: latestMatch.gameweek, status: "finished" } },
  });

  const playerById = new Map(players.map((p) => [p.playerId, p]));
  const standoutValue = (p: (typeof latestGameweekPerfs)[number]) =>
    p.goals * 3 + p.assists * 2 + p.bonus;

  return latestGameweekPerfs
    .filter((p) => p.minutes > 0 && standoutValue(p) > 0)
    .sort((a, b) => standoutValue(b) - standoutValue(a))
    .slice(0, count)
    .map((p) => {
      const player = playerById.get(p.playerId);
      const parts = [
        p.goals > 0 && `${p.goals} goal${p.goals > 1 ? "s" : ""}`,
        p.assists > 0 && `${p.assists} assist${p.assists > 1 ? "s" : ""}`,
      ].filter(Boolean);
      return player
        ? { player, indicator: parts.join(", ") || "Standout display" }
        : null;
    })
    .filter((e): e is DiscoverEntry => e !== null);
}

/**
 * Top players by a single existing category score (Creation, Defence, …) —
 * the exact same league-wide/position-relative percentile the homepage's
 * category tabs already show (`provisional.ts`), just packaged as a
 * Discover entry. No new statistic: this is the same number, sorted.
 */
export function topByCategory(
  players: RankedPlayer[],
  category: Exclude<Category, "overall" | "form" | "progression">,
  count: number
): DiscoverEntry[] {
  return [...players]
    .filter((p) => (p.scores[category] ?? 0) > 0)
    .sort((a, b) => (b.scores[category] ?? 0) - (a.scores[category] ?? 0))
    .slice(0, count)
    .map((player) => ({ player, indicator: `${category === "defence" ? "Defence" : "Creation"} ${(player.scores[category] ?? 0).toFixed(1)}` }));
}
