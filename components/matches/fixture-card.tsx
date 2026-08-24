import Link from "next/link";
import { TeamCrest } from "@/components/identity/team-crest";
import type { FixtureCard as FixtureCardData } from "@/lib/analytics/scoring/matchRepository";

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function FixtureCard({ fixture }: { fixture: FixtureCardData }) {
  const played = fixture.status === "finished" && fixture.homeScore !== null;

  return (
    <Link
      href={`/match/${fixture.matchId}`}
      className="group flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 transition-all hover:-translate-y-px hover:border-[var(--color-border-strong)] hover:shadow-sm sm:px-5"
    >
      <div className="flex flex-1 items-center justify-end gap-2.5 text-right">
        <span className="truncate text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
          {fixture.homeTeam.name}
        </span>
        <TeamCrest crestUrl={fixture.homeTeam.crestUrl} shortName={fixture.homeTeam.shortName} size="lg" />
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center px-1">
        {played ? (
          <div className="font-display flex items-center gap-1.5 text-[20px] font-semibold tabular text-[var(--color-ink)]">
            <span>{fixture.homeScore}</span>
            <span className="text-[var(--color-ink-faint)]">–</span>
            <span>{fixture.awayScore}</span>
          </div>
        ) : (
          <div className="text-[12px] font-medium text-[var(--color-ink-faint)]">vs</div>
        )}
        <div className="mt-1 whitespace-nowrap text-[10.5px] uppercase tracking-[0.05em] text-[var(--color-ink-faint)]">
          {played ? "Full time" : formatKickoff(fixture.kickoff)}
        </div>
      </div>

      <div className="flex flex-1 items-center gap-2.5">
        <TeamCrest crestUrl={fixture.awayTeam.crestUrl} shortName={fixture.awayTeam.shortName} size="lg" />
        <span className="truncate text-[13.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
          {fixture.awayTeam.name}
        </span>
      </div>
    </Link>
  );
}
