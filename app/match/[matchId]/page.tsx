import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchCentre } from "@/lib/analytics/scoring/matchRepository";
import { TeamCrest } from "@/components/identity/team-crest";
import { SquadList } from "@/components/matches/squad-list";
import { MatchStandout } from "@/components/matches/match-standout";
import { MatchEvents } from "@/components/matches/match-events";
import { MatchSnapshot } from "@/components/matches/match-snapshot";
import { TeamPerformance } from "@/components/matches/team-performance";
import { PerformanceLeaders } from "@/components/matches/performance-leaders";
import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";

export const revalidate = 300;

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default async function MatchCentrePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await getMatchCentre(matchId);
  if (!data) notFound();

  const {
    match,
    homeTeam,
    awayTeam,
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
  } = data;
  const played = match.status === "finished" && match.homeScore !== null;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-12 sm:px-8">
      {/* MATCH HEADER */}
      <div data-hero className="relative -mx-5 overflow-hidden rounded-b-xl bg-[var(--hero-bg)] px-5 pt-5 pb-8 sm:-mx-8 sm:rounded-xl sm:px-8 sm:pt-6">
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between">
          {match.gameweek != null ? (
            <Link href={`/matches/${match.gameweek}`} className="text-[13px] text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink)]">
              ← Gameweek {match.gameweek}
            </Link>
          ) : (
            <span />
          )}
        </div>

        <p className="relative mt-5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--hero-accent)]">
          Premier League{match.gameweek != null ? ` · Gameweek ${match.gameweek}` : ""}
        </p>

        <div className="relative mt-3 flex items-center justify-center gap-4 sm:gap-8">
          <Link
            href={`/teams/${homeTeam.id}`}
            className="flex flex-1 flex-col items-center gap-2 text-center transition-opacity hover:opacity-80"
          >
            <TeamCrest crestUrl={homeTeam.crestUrl} shortName={homeTeam.shortName} size="lg" />
            <span className="font-display text-[15px] font-semibold text-[var(--hero-ink)] sm:text-[17px]">
              {homeTeam.name}
            </span>
          </Link>

          <div className="flex shrink-0 flex-col items-center px-2">
            {played ? (
              <div className="font-display flex items-center gap-2 text-[36px] font-semibold tabular text-[var(--hero-ink)] sm:text-[44px]">
                <span>{match.homeScore}</span>
                <span className="text-[var(--hero-ink-faint)]">–</span>
                <span>{match.awayScore}</span>
              </div>
            ) : (
              <div className="text-[15px] font-medium text-[var(--hero-ink-faint)]">vs</div>
            )}
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--hero-accent)]">
              {played ? "Full time" : "Upcoming"}
            </div>
          </div>

          <Link
            href={`/teams/${awayTeam.id}`}
            className="flex flex-1 flex-col items-center gap-2 text-center transition-opacity hover:opacity-80"
          >
            <TeamCrest crestUrl={awayTeam.crestUrl} shortName={awayTeam.shortName} size="lg" />
            <span className="font-display text-[15px] font-semibold text-[var(--hero-ink)] sm:text-[17px]">
              {awayTeam.name}
            </span>
          </Link>
        </div>

        <p className="relative mt-5 text-center text-[12.5px] text-[var(--hero-ink-faint)]">
          {formatKickoff(match.kickoff)}
        </p>
      </div>

      {played ? (
        <>
          {/* MATCH SUMMARY — "what happened?", scoped to THE MATCH */}
          <section className="mt-7">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
              What happened
            </p>
            <p className="text-[15px] leading-relaxed text-[var(--color-ink)]">{summary}</p>
          </section>

          {/* MATCH SNAPSHOT */}
          <section className="mt-6">
            <MatchSnapshot snapshot={snapshot} />
          </section>

          {/* MATCH STANDOUT */}
          {standout && standout.rating && (
            <section className="mt-8">
              <MatchStandout
                standout={standout}
                teamId={standout.teamSide === "home" ? homeTeam.id : awayTeam.id}
                teamShortName={standout.teamSide === "home" ? homeTeam.shortName : awayTeam.shortName}
                teamCrestUrl={standout.teamSide === "home" ? homeTeam.crestUrl : awayTeam.crestUrl}
              />
            </section>
          )}

          {/* TEAM PERFORMANCE */}
          <section className="mt-9">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Team performance
            </h2>
            <TeamPerformance home={homeTeamPerformance} away={awayTeamPerformance} homeTeam={homeTeam} awayTeam={awayTeam} />
          </section>

          {/* WHO RAN THE SHOW? */}
          <section className="mt-9">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Who ran the show?
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <PerformanceLeaders leaders={homeLeaders} team={homeTeam} />
              <PerformanceLeaders leaders={awayLeaders} team={awayTeam} />
            </div>
          </section>

          {/* MATCH EVENTS */}
          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Match events
            </h2>
            <MatchEvents
              scorers={scorers}
              assistProviders={assistProviders}
              cards={cards}
              sides={{ home: homeTeam, away: awayTeam }}
            />
          </section>

          {/* SQUAD PERFORMANCE */}
          <section className="mt-10">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Squad performance
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <Link href={`/teams/${homeTeam.id}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
                  <TeamCrest crestUrl={homeTeam.crestUrl} shortName={homeTeam.shortName} size="md" />
                  <span className="text-[14px] font-semibold text-[var(--color-ink)]">{homeTeam.name}</span>
                </Link>
                <SquadList
                  startingXI={homeSquad.startingXI}
                  substitutes={homeSquad.substitutes}
                  teamShortName={homeTeam.shortName}
                />
              </div>
              <div>
                <Link href={`/teams/${awayTeam.id}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
                  <TeamCrest crestUrl={awayTeam.crestUrl} shortName={awayTeam.shortName} size="md" />
                  <span className="text-[14px] font-semibold text-[var(--color-ink)]">{awayTeam.name}</span>
                </Link>
                <SquadList
                  startingXI={awaySquad.startingXI}
                  substitutes={awaySquad.substitutes}
                  teamShortName={awayTeam.shortName}
                />
              </div>
            </div>
          </section>

          {/* MATCH TIMELINE — deferred until a legitimately licensed event-minute source exists (see docs/KEY_MOMENTS_DATA_RESEARCH.md) */}
          <section className="mt-10">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Match timeline
            </h2>
            <ComingSoonPanel
              title="Match timeline"
              description="We don't yet have a reliable, legitimately licensed data source that gives us the minute of each goal, card or substitution — only that they happened. Rather than guess at timing or a play-by-play story, we're leaving this until we can do it properly. See the methodology page for details."
            />
          </section>
        </>
      ) : (
        <div className="mt-8 rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-8 text-center text-[14px] text-[var(--color-ink-faint)]">
          This match hasn&apos;t been played yet.
        </div>
      )}
    </main>
  );
}
