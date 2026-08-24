import { prisma } from "@/lib/db/client";
import type { PositionCode } from "@/lib/competitions/premier-league";
import { getPlayerPhotoUrl, getTeamCrestUrl } from "@/lib/assets/images";
import { computeMatchRatings, type MatchRating, type MatchRatingInput } from "./matchRating";
import type { Category } from "./types";
import { buildMatchNarrative, describeStandout } from "@/lib/analytics/story/matchStory";
import type { VoiceLine } from "@/lib/analytics/voice/types";
import type { ConceptContext } from "@/lib/analytics/voice/context";
import { computeProvisionalRankings } from "./provisional";
import { getCurrentSeasonPerformanceInputs } from "./seasonInputs";

/**
 * The Match Centre's data layer. Every field here maps to a 🟢/🟡 row in
 * docs/MATCH_CENTRE_DATA_AUDIT.md §3 — nothing below invents an event
 * minute, a formation, a venue, or a qualitative "key moment". See that
 * document for exactly what is and isn't backed by real data.
 */

interface TeamIdentitySlim {
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface FixtureCard {
  matchId: string;
  gameweek: number | null;
  kickoff: string;
  status: string;
  homeTeam: TeamIdentitySlim;
  awayTeam: TeamIdentitySlim;
  homeScore: number | null;
  awayScore: number | null;
}

export interface GameweekSummary {
  gameweek: number;
  fixtureCount: number;
  finishedCount: number;
}

/** All gameweeks with at least one fixture in the current season, ascending. */
export async function getAvailableGameweeks(): Promise<GameweekSummary[]> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return [];

  const matches = await prisma.match.findMany({
    where: { seasonId: season.id, gameweek: { not: null } },
    select: { gameweek: true, status: true },
  });

  const byGameweek = new Map<number, { fixtureCount: number; finishedCount: number }>();
  for (const m of matches) {
    const gw = m.gameweek!;
    const entry = byGameweek.get(gw) ?? { fixtureCount: 0, finishedCount: 0 };
    entry.fixtureCount++;
    if (m.status === "finished") entry.finishedCount++;
    byGameweek.set(gw, entry);
  }

  return [...byGameweek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gameweek, counts]) => ({ gameweek, ...counts }));
}

export async function getGameweekFixtures(gameweek: number): Promise<FixtureCard[]> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return [];

  const matches = await prisma.match.findMany({
    where: { seasonId: season.id, gameweek },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoff: "asc" },
  });

  return matches.map((m) => ({
    matchId: m.id,
    gameweek: m.gameweek,
    kickoff: m.kickoff.toISOString(),
    status: m.status,
    homeTeam: {
      name: m.homeTeam.name,
      shortName: m.homeTeam.shortName,
      crestUrl: getTeamCrestUrl(m.homeTeam.crestCode),
    },
    awayTeam: {
      name: m.awayTeam.name,
      shortName: m.awayTeam.shortName,
      crestUrl: getTeamCrestUrl(m.awayTeam.crestCode),
    },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }));
}

export interface ClubFixtureSnapshot {
  next: FixtureCard | null;
  last: FixtureCard | null;
}

/**
 * Every club's next fixture and most recent result, in one pass — the two
 * facts the homepage's personalised "My Football" section needs
 * (Personalisation Foundation). Computed for all teams at once (one query,
 * grouped in JS — the same "no Prisma groupBy, SQLite simplicity" pattern
 * `getAvailableGameweeks` already uses above) rather than per-team, because
 * which club is "the" club is only known client-side (localStorage) —
 * there's no server-render-time id to filter a single-team query by.
 */
export async function getAllClubFixtureSnapshots(): Promise<Record<string, ClubFixtureSnapshot>> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return {};

  const matches = await prisma.match.findMany({
    where: { seasonId: season.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { kickoff: "asc" },
  });

  const toCard = (m: (typeof matches)[number]): FixtureCard => ({
    matchId: m.id,
    gameweek: m.gameweek,
    kickoff: m.kickoff.toISOString(),
    status: m.status,
    homeTeam: { name: m.homeTeam.name, shortName: m.homeTeam.shortName, crestUrl: getTeamCrestUrl(m.homeTeam.crestCode) },
    awayTeam: { name: m.awayTeam.name, shortName: m.awayTeam.shortName, crestUrl: getTeamCrestUrl(m.awayTeam.crestCode) },
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  });

  const snapshots: Record<string, ClubFixtureSnapshot> = {};
  const teamIds = new Set<string>();
  for (const m of matches) {
    teamIds.add(m.homeTeamId);
    teamIds.add(m.awayTeamId);
  }

  for (const teamId of teamIds) {
    const teamMatches = matches.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);
    const finished = teamMatches.filter((m) => m.status === "finished");
    const upcoming = teamMatches.filter((m) => m.status !== "finished");
    snapshots[teamId] = {
      last: finished.length > 0 ? toCard(finished[finished.length - 1]) : null,
      next: upcoming.length > 0 ? toCard(upcoming[0]) : null,
    };
  }

  return snapshots;
}

export interface SquadMember {
  playerId: string;
  slug: string;
  name: string;
  position: PositionCode;
  photoUrl: string | null;
  minutes: number;
  started: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  /** Null when the player didn't clear the ranking engine's minimum-minutes floor for this match. */
  rating: { score: number; label: string; lowMinutes: boolean } | null;
  /** A single standout category for this match only — see matchRepository's note on why this
   *  isn't confidence-gated the way season strengths are (it's not a durability claim). */
  matchStrength: { key: Category; label: string } | null;
}

export interface MatchEventEntry {
  playerId: string;
  slug: string;
  name: string;
  teamSide: "home" | "away";
  count: number;
}

export interface CardEntry {
  playerId: string;
  slug: string;
  name: string;
  teamSide: "home" | "away";
  yellow: boolean;
  red: boolean;
}

export interface MatchStandout extends SquadMember {
  teamSide: "home" | "away";
  /** Level-appropriate observation + always-present factual evidence — see lib/analytics/voice/. */
  narrative: VoiceLine;
}

/** A minutes-weighted read on how a whole side performed — see §4 note on getMatchCentre. */
export interface TeamPerformanceSummary {
  /** Null when nobody on the side cleared the ranking engine's minutes floor. */
  rating: number | null;
  strongCount: number;
  poorCount: number;
}

export interface PerformanceLeader {
  playerId: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  score: number;
}

export interface PerformanceLeaders {
  bestPerformer: PerformanceLeader | null;
  strongestAttack: PerformanceLeader | null;
  strongestCreation: PerformanceLeader | null;
  strongestDefence: PerformanceLeader | null;
}

export interface MatchSnapshot {
  totalGoals: number;
  totalCards: number;
  strongPerformances: number;
  poorPerformances: number;
}

export interface MatchCentreData {
  match: {
    id: string;
    gameweek: number | null;
    kickoff: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  homeTeam: TeamIdentitySlim;
  awayTeam: TeamIdentitySlim;
  homeSquad: { startingXI: SquadMember[]; substitutes: SquadMember[] };
  awaySquad: { startingXI: SquadMember[]; substitutes: SquadMember[] };
  scorers: MatchEventEntry[];
  assistProviders: MatchEventEntry[];
  cards: CardEntry[];
  standout: MatchStandout | null;
  summary: string;
  snapshot: MatchSnapshot;
  homeTeamPerformance: TeamPerformanceSummary;
  awayTeamPerformance: TeamPerformanceSummary;
  homeLeaders: PerformanceLeaders;
  awayLeaders: PerformanceLeaders;
}

const CATEGORY_LABEL: Record<string, string> = {
  attack: "Attacking threat",
  creation: "Chance creation",
  defence: "Defending",
  impact: "Match impact",
};
const MATCH_STRENGTH_MIN = 5.5;
const POSITION_ORDER: Record<PositionCode, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3 };

function pickMatchStrength(scores: Record<string, number | undefined>): { key: Category; label: string } | null {
  const candidates = (["attack", "creation", "defence", "impact"] as const)
    .map((key) => ({ key, score: scores[key] ?? 0 }))
    .filter((c) => c.score >= MATCH_STRENGTH_MIN)
    .sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return top ? { key: top.key, label: CATEGORY_LABEL[top.key] } : null;
}

const STRONG_LABELS = new Set(["Excellent", "Very good"]);
const POOR_LABEL = "Below average";

/**
 * TEAM PERFORMANCE — a minutes-weighted average of the side's own Match
 * Ratings, nothing more. Deliberately not a new formula: every input is
 * the same per-player Match Rating already shown elsewhere on this page,
 * just aggregated. Minutes-weighted so a substitute's 10 minutes doesn't
 * count the same as a starter's 90 — a simple, transparent, documented
 * choice, not a validated model (see docs/MATCH_CENTRE_DATA_AUDIT.md §4 for
 * the same caveat already applied to the individual Match Rating this
 * builds on).
 */
export function computeTeamPerformance(members: SquadMember[]): TeamPerformanceSummary {
  const rated = members.filter((m) => m.rating !== null && m.minutes > 0);
  const totalMinutes = rated.reduce((sum, m) => sum + m.minutes, 0);
  const weightedSum = rated.reduce((sum, m) => sum + m.rating!.score * m.minutes, 0);
  return {
    rating: totalMinutes > 0 ? Math.round((weightedSum / totalMinutes) * 10) / 10 : null,
    strongCount: rated.filter((m) => STRONG_LABELS.has(m.rating!.label)).length,
    poorCount: rated.filter((m) => m.rating!.label === POOR_LABEL).length,
  };
}

/**
 * PERFORMANCE LEADERS — best overall performer plus, only where the
 * category score genuinely clears the same MATCH_STRENGTH_MIN bar used for
 * `matchStrength` elsewhere in this file. A team's *highest* attack score
 * is never shown as "strongest attack" if nobody actually attacked well —
 * the brief's own instruction ("avoid unreliable conclusions") maps
 * directly onto the threshold already established for Match Strength.
 */
export function computeLeaders(members: SquadMember[], ratingByPlayerId: Map<string, MatchRating>): PerformanceLeaders {
  const rated = members.filter((m) => m.rating !== null);

  const bestPerformer = [...rated].sort((a, b) => b.rating!.score - a.rating!.score)[0] ?? null;

  const byCategory = (key: "attack" | "creation" | "defence"): PerformanceLeader | null => {
    let best: { member: SquadMember; score: number } | null = null;
    for (const m of rated) {
      const score = ratingByPlayerId.get(m.playerId)?.scores[key] ?? 0;
      if (score >= MATCH_STRENGTH_MIN && (!best || score > best.score)) best = { member: m, score };
    }
    return best ? { playerId: best.member.playerId, slug: best.member.slug, name: best.member.name, photoUrl: best.member.photoUrl, score: best.score } : null;
  };

  return {
    bestPerformer: bestPerformer
      ? { playerId: bestPerformer.playerId, slug: bestPerformer.slug, name: bestPerformer.name, photoUrl: bestPerformer.photoUrl, score: bestPerformer.rating!.score }
      : null,
    strongestAttack: byCategory("attack"),
    strongestCreation: byCategory("creation"),
    strongestDefence: byCategory("defence"),
  };
}

/**
 * The STOCKS_RISING/STOCKS_FALLING/AGENDA voice concept (see
 * lib/analytics/voice/concepts.ts) needs the player's own season-to-date
 * Performance score to compare this match against — recomputed from the
 * exact same pipeline the player's own page uses (`computeProvisionalRankings`
 * over `getCurrentSeasonPerformanceInputs()`), so the number is never a
 * second, different "season score". Same cost/pattern as
 * `getPlayerProfile()` already accepts elsewhere in this app; only run
 * once per Match Centre view, and only for the one standout player.
 */
async function getSeasonBaselineContext(playerId: string): Promise<ConceptContext | undefined> {
  const inputs = await getCurrentSeasonPerformanceInputs();
  const { players } = computeProvisionalRankings(inputs);
  const ranked = players.find((p) => p.playerId === playerId);
  if (!ranked || ranked.scores.overall === undefined) return undefined;
  return { seasonBaseline: { score: ranked.scores.overall, confidence: ranked.sample.confidence } };
}

/**
 * Ranks every player who featured in a given (season, gameweek) against
 * each other — the reusable half of Match Rating. Used both by the Match
 * Centre (one gameweek at a time) and by the player profile page (once per
 * distinct gameweek the player has appeared in, to show a rating alongside
 * each match in their season history — see `getPlayerMatchRatings`).
 */
export async function getGameweekRatings(
  seasonId: string,
  gameweek: number
): Promise<Map<string, MatchRating>> {
  const gameweekPerformances = await prisma.playerMatchPerformance.findMany({
    where: { match: { seasonId, gameweek, status: "finished" } },
    include: { player: { include: { team: true } } },
  });

  const ratingInputs: MatchRatingInput[] = gameweekPerformances.map((p) => ({
    playerId: p.playerId,
    slug: p.player.slug,
    name: p.player.displayName,
    teamShortName: p.player.team.shortName,
    position: p.player.position as PositionCode,
    photoUrl: getPlayerPhotoUrl(p.player.photoCode),
    teamCrestUrl: getTeamCrestUrl(p.player.team.crestCode),
    minutes: p.minutes,
    goals: p.goals,
    assists: p.assists,
    cleanSheets: p.cleanSheets,
    saves: p.saves,
    xg: p.expectedGoals,
    xa: p.expectedAssists,
    defensiveActions: p.defensiveActions,
    bps: p.bps,
  }));

  const ratings = computeMatchRatings(ratingInputs);
  return new Map(ratings.map((r) => [r.playerId, r]));
}

/**
 * One rating lookup per distinct gameweek in the player's own match log —
 * not one query per match, so a player who's played 20 matches across 20
 * gameweeks costs 20 queries, not more. Small at today's data volume;
 * worth revisiting if/when this needs to scale to multiple seasons.
 */
export async function getPlayerMatchRatings(
  seasonId: string,
  playerId: string,
  gameweeks: number[]
): Promise<Map<number, MatchRating>> {
  const uniqueGameweeks = [...new Set(gameweeks)];
  const results = await Promise.all(
    uniqueGameweeks.map(async (gw) => {
      const ratings = await getGameweekRatings(seasonId, gw);
      const mine = ratings.get(playerId);
      return mine ? ([gw, mine] as const) : null;
    })
  );
  return new Map(results.filter((r): r is readonly [number, MatchRating] => r !== null));
}

export async function getMatchCentre(matchId: string): Promise<MatchCentreData | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!match) return null;

  const matchPerformances = await prisma.playerMatchPerformance.findMany({
    where: { matchId: match.id },
    include: { player: true },
  });

  // The rating cohort is the whole gameweek (see matchRating.ts) — a single
  // fixture's per-position pool is too thin on its own.
  const ratingByPlayerId =
    match.gameweek != null
      ? await getGameweekRatings(match.seasonId, match.gameweek)
      : new Map<string, MatchRating>();

  const toSquadMember = (p: (typeof matchPerformances)[number]): SquadMember => {
    const rating = ratingByPlayerId.get(p.playerId) ?? null;
    return {
      playerId: p.playerId,
      slug: p.player.slug,
      name: p.player.displayName,
      position: p.player.position as PositionCode,
      photoUrl: getPlayerPhotoUrl(p.player.photoCode),
      minutes: p.minutes,
      started: p.started,
      goals: p.goals,
      assists: p.assists,
      yellowCards: p.yellowCards,
      redCards: p.redCards,
      rating: rating
        ? { score: rating.scores.overall ?? 0, label: rating.qualityLabel, lowMinutes: rating.lowMinutes }
        : null,
      matchStrength: rating ? pickMatchStrength(rating.scores) : null,
    };
  };

  const bySide = (teamId: string) =>
    matchPerformances.filter((p) => p.teamId === teamId).map(toSquadMember);

  const splitSquad = (members: SquadMember[]) => ({
    startingXI: members
      .filter((m) => m.started)
      .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || b.minutes - a.minutes),
    substitutes: members.filter((m) => !m.started).sort((a, b) => b.minutes - a.minutes),
  });

  const homeMembers = bySide(match.homeTeamId);
  const awayMembers = bySide(match.awayTeamId);
  const homeSquad = splitSquad(homeMembers);
  const awaySquad = splitSquad(awayMembers);

  const allMembers: Array<SquadMember & { teamSide: "home" | "away" }> = [
    ...homeMembers.map((m) => ({ ...m, teamSide: "home" as const })),
    ...awayMembers.map((m) => ({ ...m, teamSide: "away" as const })),
  ];

  const scorers = summariseEvents(allMembers, (m) => m.goals);
  const assistProviders = summariseEvents(allMembers, (m) => m.assists);
  const cards: CardEntry[] = allMembers
    .filter((m) => m.yellowCards > 0 || m.redCards > 0)
    .map((m) => ({
      playerId: m.playerId,
      slug: m.slug,
      name: m.name,
      teamSide: m.teamSide,
      yellow: m.yellowCards > 0,
      red: m.redCards > 0,
    }));

  const homeTeamPerformance = computeTeamPerformance(homeMembers);
  const awayTeamPerformance = computeTeamPerformance(awayMembers);
  const homeLeaders = computeLeaders(homeMembers, ratingByPlayerId);
  const awayLeaders = computeLeaders(awayMembers, ratingByPlayerId);

  const standoutMember = [...allMembers]
    .filter((m) => m.rating !== null)
    .sort((a, b) => (b.rating!.score ?? 0) - (a.rating!.score ?? 0))[0];
  const standout: MatchStandout | null = standoutMember
    ? {
        ...standoutMember,
        narrative: describeStandout(
          standoutMember,
          standoutMember.teamSide === "home" ? match.homeTeam.shortName : match.awayTeam.shortName,
          standoutMember.rating!.score,
          standoutMember.rating!.label,
          ratingByPlayerId.get(standoutMember.playerId)?.scores ?? {},
          (standoutMember.teamSide === "home" ? homeMembers : awayMembers).map((m) => ({ rating: m.rating, started: m.started })),
          await getSeasonBaselineContext(standoutMember.playerId)
        ),
      }
    : null;

  const summary = buildMatchNarrative({
    homeTeam: match.homeTeam.shortName,
    awayTeam: match.awayTeam.shortName,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    scorers,
    cards,
    homeTeamRating: homeTeamPerformance.rating,
    awayTeamRating: awayTeamPerformance.rating,
  });

  const snapshot: MatchSnapshot = {
    totalGoals: (match.homeScore ?? 0) + (match.awayScore ?? 0),
    totalCards: cards.length,
    strongPerformances: homeTeamPerformance.strongCount + awayTeamPerformance.strongCount,
    poorPerformances: homeTeamPerformance.poorCount + awayTeamPerformance.poorCount,
  };

  return {
    match: {
      id: match.id,
      gameweek: match.gameweek,
      kickoff: match.kickoff.toISOString(),
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    },
    homeTeam: {
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      crestUrl: getTeamCrestUrl(match.homeTeam.crestCode),
    },
    awayTeam: {
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      crestUrl: getTeamCrestUrl(match.awayTeam.crestCode),
    },
    homeSquad,
    awaySquad,
    scorers,
    assistProviders,
    cards,
    standout,
    summary,
    snapshot,
    homeTeamPerformance,
    awayTeamPerformance,
    homeLeaders,
    awayLeaders,
  };
}

function summariseEvents(
  members: Array<SquadMember & { teamSide: "home" | "away" }>,
  countFor: (m: SquadMember) => number
): MatchEventEntry[] {
  return members
    .filter((m) => countFor(m) > 0)
    .map((m) => ({
      playerId: m.playerId,
      slug: m.slug,
      name: m.name,
      teamSide: m.teamSide,
      count: countFor(m),
    }));
}

