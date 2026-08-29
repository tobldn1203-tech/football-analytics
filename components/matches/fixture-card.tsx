import Link from "next/link";
import { TeamCrest } from "@/components/identity/team-crest";
import type { FixtureCard as FixtureCardData } from "@/lib/analytics/scoring/matchRepository";

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Three sibling links, not one card-wide link with team names nested
 * inside it: each team goes to its own Team Intelligence page, and the
 * middle score/kickoff area goes to Match Centre — see
 * docs/TEAM_NAVIGATION_AND_PLAYER_DRIVERS_REFINEMENT.md. Nesting an <a>
 * inside another <a> is invalid HTML and breaks click targeting, so this
 * is deliberately NOT one big Link with two Links inside it.
 */
export function FixtureCard({ fixture }: { fixture: FixtureCardData }) {
  const played = fixture.status === "finished" && fixture.homeScore !== null;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 transition-all hover:-translate-y-px hover:border-[var(--color-border-strong)] hover:shadow-sm sm:px-5">
      <Link href={`/teams/${fixture.homeTeam.id}`} className="flex flex-1 items-center justify-end gap-2.5 text-right hover:opacity-80">
        <span className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
          {fixture.homeTeam.name}
        </span>
        <TeamCrest crestUrl={fixture.homeTeam.crestUrl} shortName={fixture.homeTeam.shortName} size="lg" />
      </Link>

      <Link href={`/match/${fixture.matchId}`} className="group flex shrink-0 flex-col items-center justify-center px-1">
        {played ? (
          <div className="font-display flex items-center gap-1.5 text-[20px] font-semibold tabular text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
            <span>{fixture.homeScore}</span>
            <span className="text-[var(--color-ink-faint)]">–</span>
            <span>{fixture.awayScore}</span>
          </div>
        ) : (
          <div className="text-[12px] font-medium text-[var(--color-ink-faint)] group-hover:text-[var(--color-accent)]">vs</div>
        )}
        <div className="mt-1 whitespace-nowrap text-[10.5px] uppercase tracking-[0.05em] text-[var(--color-ink-faint)]">
          {played ? "Full time" : formatKickoff(fixture.kickoff)}
        </div>
      </Link>

      <Link href={`/teams/${fixture.awayTeam.id}`} className="flex flex-1 items-center gap-2.5 hover:opacity-80">
        <TeamCrest crestUrl={fixture.awayTeam.crestUrl} shortName={fixture.awayTeam.shortName} size="lg" />
        <span className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
          {fixture.awayTeam.name}
        </span>
      </Link>
    </div>
  );
}
