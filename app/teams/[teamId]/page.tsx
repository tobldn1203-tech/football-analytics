import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, getLeagueStandings } from "@/lib/analytics/scoring/teamRepository";
import { getPlayerAvailabilityMap } from "@/lib/analytics/availability/repository";
import { buildWorthKnowingInsight } from "@/lib/analytics/availability/worthKnowing";
import { TeamWorthKnowing } from "@/components/teams/team-worth-knowing";
import { TeamCrest } from "@/components/identity/team-crest";
import { MatchTrend } from "@/components/charts/match-trend";
import { TrendBadge } from "@/components/ui/trend-badge";
import { SupportedClubButton } from "@/components/teams/supported-club-button";
import { TeamOverview } from "@/components/teams/team-overview";
import { TeamPlayersDriving } from "@/components/teams/team-players-driving";
import { TeamMatchHistory } from "@/components/teams/team-match-history";
import { LeagueTable } from "@/components/teams/league-table";

export const revalidate = 300;

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [data, standings] = await Promise.all([getTeamProfile(teamId), getLeagueStandings()]);
  if (!data) notFound();

  const { team, totalTeams, standing, strengths, developmentAreas, momentum, story, players, teamPlayers, matchHistory, nextFixture } = data;

  // "Worth knowing" — availability cross-referenced against each player's
  // own already-computed Performance score. See
  // lib/analytics/availability/worthKnowing.ts; this reuses the exact
  // same primitive/insight function My Football uses (app/page.tsx).
  const availabilityMap = await getPlayerAvailabilityMap(teamPlayers.map((p) => p.playerId));
  const worthKnowing = buildWorthKnowingInsight(team.name, teamPlayers, availabilityMap);

  const journeyPoints = [...matchHistory]
    .reverse() // oldest first
    .filter((m) => m.teamRating !== null)
    .map((m) => ({
      value: m.teamRating!,
      opponentShortName: m.opponentShortName,
      opponentCrestUrl: m.opponentCrestUrl,
      isHome: m.isHome,
    }));

  const formStrip = matchHistory.slice(0, 6).reverse();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-12 sm:px-8">
      {/* IDENTITY */}
      <div data-hero className="relative -mx-5 overflow-hidden rounded-b-xl bg-[var(--hero-bg)] px-5 pt-5 pb-7 sm:-mx-8 sm:rounded-xl sm:px-8 sm:pt-6">
        <div
          className="pointer-events-none absolute -top-20 left-1/3 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        {/*
          MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #5): same
          -m-2/p-2 tap-target technique as this page's Player/Match Centre
          siblings — visual position unchanged, real hit area grows.
        */}
        <Link href="/teams" className="relative -m-2 p-2 text-[13px] text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink)]">
          ← Premier League table
        </Link>

        <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TeamCrest crestUrl={team.crestUrl} shortName={team.shortName} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-[var(--hero-ink)] sm:text-[32px]">
                  {team.name}
                </h1>
                <SupportedClubButton teamId={team.id} />
              </div>
              <div className="mt-1.5 text-[14px] text-[var(--hero-ink-soft)]">
                {standing ? (
                  <>
                    {standing.position}
                    <sup>{ordinalSuffix(standing.position)}</sup> of {totalTeams} · {standing.won}W {standing.drawn}D {standing.lost}L
                  </>
                ) : (
                  "No matches played yet this season"
                )}
              </div>
            </div>
          </div>

          {formStrip.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5">
              {formStrip.map((m) => (
                <span
                  key={m.matchId}
                  title={`${m.isHome ? "vs" : "@"} ${m.opponentShortName} — ${m.teamScore}–${m.opponentScore}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-[var(--hero-bg)]"
                  style={{ backgroundColor: m.result === "W" ? "var(--hero-accent)" : m.result === "L" ? "#e5484d" : "var(--hero-ink-faint)" }}
                >
                  {m.result}
                </span>
              ))}
            </div>
          )}
        </div>

        {standing && (
          <p className="relative mt-4 text-[12.5px] text-[var(--hero-ink-faint)]">
            {standing.goalsFor} scored · {standing.goalsAgainst} conceded · {standing.goalDifference >= 0 ? "+" : ""}
            {standing.goalDifference} goal difference · {standing.points} points
          </p>
        )}
      </div>

      {/* TEAM OVERVIEW — the interpretation, up front, including the one "what's working/what isn't" line the story prose doesn't cover */}
      <TeamOverview story={story} strengths={strengths} developmentAreas={developmentAreas} />

      {/*
        PLAYERS DRIVING THE TEAM — promoted well above the fold. See
        docs/TEAM_NAVIGATION_AND_PLAYER_DRIVERS_REFINEMENT.md: the players
        driving a team are more interesting to a fan than a dashboard of
        five abstract scores, so they now come right after the Overview
        rather than after a since-removed Performance Profile section.
      */}
      <section className="mt-9">
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Players driving the team</h2>
        <TeamPlayersDriving players={players} />
      </section>

      {/* AVAILABILITY WATCH — "what should I know right now"; only rendered when genuinely noteworthy */}
      <TeamWorthKnowing insight={worthKnowing} />

      {/* PERFORMANCE JOURNEY / TRENDS */}
      <section className="mt-9">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Performance journey</h2>
          {momentum.available && (
            <TrendBadge
              direction={momentum.direction === "RISING" ? "up" : momentum.direction === "FALLING" ? "down" : "steady"}
              label={momentum.label}
            />
          )}
        </div>
        <MatchTrend points={journeyPoints} color="var(--color-info)" />
        <p className="mt-2 text-[12px] text-[var(--color-ink-faint)]">
          {momentum.available ? momentum.explanation : "Too early to call a trend — check back after a few more matches."}
        </p>
      </section>

      {/* MATCH HISTORY */}
      <section className="mt-10">
        <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Match history</h2>
        <TeamMatchHistory matches={matchHistory} teamId={team.id} teamShortName={team.shortName} />
      </section>

      {/* LEAGUE POSITION */}
      {standings.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">League position</h2>
            <Link href="/teams" className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline">
              Full table →
            </Link>
          </div>
          <LeagueTable standings={standings} compact={{ aroundTeamId: team.id }} showForm={false} />
        </section>
      )}

      {/* NEXT FIXTURE */}
      {nextFixture && (
        <section className="mt-10 flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-5 py-4">
          <Link href={`/teams/${nextFixture.opponentTeamId}`} className="flex flex-1 items-center gap-3 hover:opacity-80">
            <TeamCrest crestUrl={nextFixture.opponentCrestUrl} shortName={nextFixture.opponentShortName} size="md" />
            <div className="text-[13.5px] text-[var(--color-ink)]">
              Next: {nextFixture.isHome ? "vs" : "@"} <span className="font-medium">{nextFixture.opponentShortName}</span>
            </div>
          </Link>
          <Link href={`/match/${nextFixture.matchId}`} className="shrink-0 text-[12.5px] font-medium text-[var(--color-accent)] hover:underline">
            View match →
          </Link>
        </section>
      )}
    </main>
  );
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
