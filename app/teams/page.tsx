import { getLeagueStandings } from "@/lib/analytics/scoring/teamRepository";
import { LeagueTable } from "@/components/teams/league-table";

export const revalidate = 300;

export default async function TeamsIndexPage() {
  const standings = await getLeagueStandings();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div data-hero className="relative -mx-5 overflow-hidden rounded-b-xl bg-[var(--hero-bg)] px-5 pt-8 pb-8 sm:-mx-8 sm:rounded-xl sm:px-8 sm:pt-10">
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        <p className="relative text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-accent)]">
          Premier League · Teams
        </p>
        <h1 className="relative mt-2 font-display text-[32px] font-semibold leading-none tracking-tight text-[var(--hero-ink)] sm:text-[40px]">
          Table &amp; Team Intelligence
        </h1>
        <p className="relative mt-3 max-w-md text-[14px] leading-relaxed text-[var(--hero-ink-soft)]">
          The full standings — and how every club is actually performing this season, not just their results. Select any team below.
        </p>
      </div>

      <div className="mt-8">
        {standings.length === 0 ? (
          <p className="text-[14px] text-[var(--color-ink-faint)]">No matches played yet this season.</p>
        ) : (
          <LeagueTable standings={standings} />
        )}
      </div>
    </main>
  );
}
