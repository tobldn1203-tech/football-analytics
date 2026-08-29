import { prisma } from "@/lib/db/client";
import { getTeamCrestUrl } from "@/lib/assets/images";
import { computeProvisionalRankings } from "./provisional";
import { getCurrentSeasonPerformanceInputs } from "./seasonInputs";
import { classifySampleConfidence, qualityLabelFor, type RankedPlayer, type SampleConfidence } from "./types";
import { detectStrengths } from "@/lib/analytics/intelligence/strengths";
import type { StrengthArea } from "@/lib/analytics/intelligence/types";
import { getMatchCentre, type PerformanceLeader } from "./matchRepository";
import { buildTeamStory, computeTeamMomentum } from "@/lib/analytics/story/teamStory";
import type { MomentumMetric } from "@/lib/analytics/intelligence/types";

/**
 * TEAM INTELLIGENCE — data layer
 * ==================================
 * Deliberately reuses everything it can rather than inventing a parallel
 * analytics philosophy for teams (per the brief this was built against):
 *
 * - Category/overall scores: a minutes-weighted average of the SAME
 *   per-player season Performance scores already shown on each player's
 *   own page (computeProvisionalRankings) — not a new formula, an
 *   aggregation of an existing one.
 * - Strengths/development areas: `detectStrengths` (the exact function
 *   season Performance Intelligence already uses) called on a synthetic
 *   RankedPlayer-shaped object built from the team's own aggregate scores
 *   — same confidence gating, same thresholds, zero new code path.
 * - "Players driving the team": literally the team's own players, sliced
 *   from the SAME `RankedPlayer[]` the homepage/Discover already compute.
 * - Per-match Team Performance / best performer: `computeTeamPerformance`/
 *   `computeLeaders`, the exact functions the Match Centre uses, exported
 *   and reused here unchanged.
 */

export interface TeamStanding {
  teamId: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number;
  /** Results, most recent first, capped to a short strip — for a compact "form" glance in the table. */
  form: Array<"W" | "D" | "L">;
}

const FORM_WINDOW = 5;

/** A standard league table, computed from the same `Match` rows Match Centre already reads — never fabricated, never a separate "standings" data source. */
export async function getLeagueStandings(): Promise<TeamStanding[]> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return [];

  const [allTeams, matches] = await Promise.all([
    prisma.team.findMany({ where: { competitionId: season.competitionId } }),
    prisma.match.findMany({
      where: { seasonId: season.id, status: "finished" },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, kickoff: true },
      orderBy: { kickoff: "asc" },
    }),
  ]);

  interface Row {
    teamId: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    form: Array<"W" | "D" | "L">;
  }
  const rows = new Map<string, Row>();
  const touch = (teamId: string): Row => {
    let row = rows.get(teamId);
    if (!row) {
      row = { teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, form: [] };
      rows.set(teamId, row);
    }
    return row;
  };

  // Every team in the competition gets a row from the start — a club that
  // hasn't played its first match yet (e.g. a postponed opener) still
  // belongs in an 20-team table at 0 points, not silently missing from it.
  for (const t of allTeams) touch(t.id);

  for (const m of matches) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = touch(m.homeTeamId);
    const away = touch(m.awayTeamId);
    home.played++;
    away.played++;
    home.goalsFor += m.homeScore;
    home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore;
    away.goalsAgainst += m.homeScore;
    let homeResult: "W" | "D" | "L";
    let awayResult: "W" | "D" | "L";
    if (m.homeScore > m.awayScore) {
      home.won++;
      away.lost++;
      homeResult = "W";
      awayResult = "L";
    } else if (m.awayScore > m.homeScore) {
      away.won++;
      home.lost++;
      homeResult = "L";
      awayResult = "W";
    } else {
      home.drawn++;
      away.drawn++;
      homeResult = "D";
      awayResult = "D";
    }
    home.form.push(homeResult);
    away.form.push(awayResult);
  }

  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  const standings = [...rows.values()]
    .map((r) => {
      const team = teamById.get(r.teamId)!;
      return {
        ...r,
        name: team.name,
        shortName: team.shortName,
        crestUrl: getTeamCrestUrl(team.crestCode),
        goalDifference: r.goalsFor - r.goalsAgainst,
        points: r.won * 3 + r.drawn,
        // Most recent first, capped — chronological order in `form` is oldest-first from the query above.
        form: r.form.slice(-FORM_WINDOW).reverse(),
      };
    })
    // Points → goal difference → goals for is the standard convention; an
    // alphabetical-by-name tie-break beyond that (e.g. two clubs with zero
    // matches played) keeps the table's ordering stable and deterministic
    // rather than depending on incidental DB/Map iteration order.
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));

  return standings.map((s, i) => ({ ...s, position: i + 1 }));
}

export interface TeamMatchHistoryEntry {
  matchId: string;
  gameweek: number | null;
  kickoff: string;
  opponentTeamId: string;
  opponentShortName: string;
  opponentCrestUrl: string | null;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: "W" | "D" | "L";
  /** This team's minutes-weighted Team Performance rating for this specific match — null if nobody cleared the ranking floor. */
  teamRating: number | null;
  bestPerformer: PerformanceLeader | null;
}

export interface TeamPlayersDriving {
  standout: RankedPlayer | null;
  inForm: RankedPlayer | null;
  attackingThreat: RankedPlayer | null;
  creativeLeader: RankedPlayer | null;
  defensiveStandout: RankedPlayer | null;
}

export interface TeamProfileData {
  team: { id: string; name: string; shortName: string; crestUrl: string | null };
  totalTeams: number;
  standing: TeamStanding | null;
  seasonScores: { attack: number; creation: number; defence: number; impact: number; overall: number };
  sample: { matches: number; confidence: SampleConfidence };
  qualityLabel: string;
  strengths: StrengthArea[];
  developmentAreas: StrengthArea[];
  momentum: MomentumMetric;
  story: string;
  players: TeamPlayersDriving;
  /** Every one of the club's players who has cleared the ranking engine's minutes floor — the full list `players` above picks its 5 highlights from. Exposed so a caller can cross-reference against other per-player data (e.g. availability) without a second ranking computation. */
  teamPlayers: RankedPlayer[];
  matchHistory: TeamMatchHistoryEntry[];
  nextFixture: { matchId: string; opponentTeamId: string; opponentShortName: string; opponentCrestUrl: string | null; isHome: boolean; kickoff: string } | null;
}

const STRENGTH_MIN = 5.5;
const MATCH_HISTORY_LIMIT = 10;

function pickLeadingPlayer(
  players: RankedPlayer[],
  category: "attack" | "creation" | "defence"
): RankedPlayer | null {
  const candidates = players.filter((p) => (p.scores[category] ?? 0) >= STRENGTH_MIN);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => (b.scores[category] ?? 0) - (a.scores[category] ?? 0))[0];
}

export async function getTeamProfile(teamId: string): Promise<TeamProfileData | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const [standings, inputs] = await Promise.all([getLeagueStandings(), getCurrentSeasonPerformanceInputs()]);
  const standing = standings.find((s) => s.teamId === teamId) ?? null;

  const { players: allPlayers } = computeProvisionalRankings(inputs);
  const teamPlayers = allPlayers.filter((p) => p.teamShortName === team.shortName);

  const totalMinutes = teamPlayers.reduce((sum, p) => sum + p.sample.minutes, 0);
  const weighted = (key: "attack" | "creation" | "defence" | "impact" | "overall") =>
    totalMinutes > 0 ? teamPlayers.reduce((sum, p) => sum + (p.scores[key] ?? 0) * p.sample.minutes, 0) / totalMinutes : 0;

  const seasonScores = {
    attack: Math.round(weighted("attack") * 10) / 10,
    creation: Math.round(weighted("creation") * 10) / 10,
    defence: Math.round(weighted("defence") * 10) / 10,
    impact: Math.round(weighted("impact") * 10) / 10,
    overall: Math.round(weighted("overall") * 10) / 10,
  };

  const matchesPlayed = standing?.played ?? 0;
  const confidence = classifySampleConfidence(matchesPlayed);

  // A synthetic RankedPlayer-shaped object purely so detectStrengths (an
  // already-battle-tested, confidence-gated function) can be reused
  // unchanged at team level — never persisted, never shown as a "player".
  const teamAsRanked: RankedPlayer = {
    playerId: team.id,
    slug: team.id,
    name: team.name,
    teamId: team.id,
    teamShortName: team.shortName,
    position: "MID",
    sample: { matches: matchesPlayed, minutes: totalMinutes, confidence },
    scores: seasonScores,
    qualityLabel: qualityLabelFor(seasonScores.overall),
    photoUrl: null,
    teamCrestUrl: null,
  };
  const { primaryStrengths, developmentAreas } = detectStrengths(teamAsRanked, { allowDevelopmentAreas: confidence !== "low" });

  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  const matches = season
    ? await prisma.match.findMany({
        where: { seasonId: season.id, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { kickoff: "desc" },
      })
    : [];

  const finishedMatches = matches.filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null);
  const upcomingMatches = matches.filter((m) => m.status !== "finished").sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  // Capped to the most recent MATCH_HISTORY_LIMIT matches — each one reuses
  // getMatchCentre (the exact Match Centre computation) rather than
  // reconstructing squad rows/ratings independently, per the brief's
  // explicit instruction not to duplicate Match Centre's functionality.
  const recentFinished = finishedMatches.slice(0, MATCH_HISTORY_LIMIT);
  const matchHistory: TeamMatchHistoryEntry[] = await Promise.all(
    recentFinished.map(async (m) => {
      const isHome = m.homeTeamId === teamId;
      const opponent = isHome ? m.awayTeam : m.homeTeam;
      const teamScore = (isHome ? m.homeScore : m.awayScore)!;
      const opponentScore = (isHome ? m.awayScore : m.homeScore)!;
      const result: "W" | "D" | "L" = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "D";

      const centre = await getMatchCentre(m.id);
      const teamRating = centre ? (isHome ? centre.homeTeamPerformance.rating : centre.awayTeamPerformance.rating) : null;
      const bestPerformer = centre ? (isHome ? centre.homeLeaders.bestPerformer : centre.awayLeaders.bestPerformer) : null;

      return {
        matchId: m.id,
        gameweek: m.gameweek,
        kickoff: m.kickoff.toISOString(),
        opponentTeamId: opponent.id,
        opponentShortName: opponent.shortName,
        opponentCrestUrl: getTeamCrestUrl(opponent.crestCode),
        isHome,
        teamScore,
        opponentScore,
        result,
        teamRating,
        bestPerformer,
      };
    })
  );

  const next = upcomingMatches[0];
  const nextFixture = next
    ? {
        matchId: next.id,
        opponentTeamId: (next.homeTeamId === teamId ? next.awayTeam : next.homeTeam).id,
        opponentShortName: (next.homeTeamId === teamId ? next.awayTeam : next.homeTeam).shortName,
        opponentCrestUrl: getTeamCrestUrl((next.homeTeamId === teamId ? next.awayTeam : next.homeTeam).crestCode),
        isHome: next.homeTeamId === teamId,
        kickoff: next.kickoff.toISOString(),
      }
    : null;

  const momentum = computeTeamMomentum(matchHistory.map((m) => m.teamRating).filter((r): r is number => r !== null));

  const story = buildTeamStory({
    name: team.name,
    overallScore: seasonScores.overall,
    matchesPlayed,
    confidence,
    strengths: primaryStrengths,
    developmentAreas,
    momentum,
  });

  const players: TeamPlayersDriving = {
    standout: teamPlayers.length > 0 ? [...teamPlayers].sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))[0] : null,
    inForm: teamPlayers.length > 0 ? [...teamPlayers].sort((a, b) => (b.scores.form ?? 0) - (a.scores.form ?? 0))[0] : null,
    attackingThreat: pickLeadingPlayer(teamPlayers, "attack"),
    creativeLeader: pickLeadingPlayer(teamPlayers, "creation"),
    defensiveStandout: pickLeadingPlayer(teamPlayers, "defence"),
  };

  return {
    team: { id: team.id, name: team.name, shortName: team.shortName, crestUrl: getTeamCrestUrl(team.crestCode) },
    totalTeams: standings.length,
    standing,
    seasonScores,
    sample: { matches: matchesPlayed, confidence },
    qualityLabel: qualityLabelFor(seasonScores.overall),
    strengths: primaryStrengths,
    developmentAreas,
    momentum,
    story,
    players,
    teamPlayers,
    matchHistory,
    nextFixture,
  };
}
