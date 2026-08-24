import { notFound } from "next/navigation";
import { getAvailableGameweeks, getGameweekFixtures } from "@/lib/analytics/scoring/matchRepository";
import { FixtureCard } from "@/components/matches/fixture-card";
import { GameweekNav } from "@/components/matches/gameweek-nav";

export const revalidate = 300;

export default async function GameweekPage({
  params,
}: {
  params: Promise<{ gameweek: string }>;
}) {
  const { gameweek: gameweekParam } = await params;
  const gameweek = Number(gameweekParam);
  if (!Number.isInteger(gameweek) || gameweek < 1) notFound();

  const [gameweeks, fixtures] = await Promise.all([
    getAvailableGameweeks(),
    getGameweekFixtures(gameweek),
  ]);
  if (fixtures.length === 0) notFound();

  const min = gameweeks[0]?.gameweek ?? gameweek;
  const max = gameweeks[gameweeks.length - 1]?.gameweek ?? gameweek;

  const finishedCount = fixtures.filter((f) => f.status === "finished").length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div data-hero className="relative overflow-hidden rounded-xl bg-[var(--hero-bg)] px-5 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        <p className="relative text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-accent)]">
          Premier League · Match Centre
        </p>
        <h1 className="relative mt-2 font-display text-[32px] font-semibold leading-none tracking-tight text-[var(--hero-ink)] sm:text-[40px]">
          Gameweek {gameweek}
        </h1>
        <p className="relative mt-3 max-w-md text-[14px] leading-relaxed text-[var(--hero-ink-soft)]">
          {finishedCount === fixtures.length
            ? `All ${fixtures.length} fixtures played.`
            : `${finishedCount} of ${fixtures.length} fixtures played so far.`}
        </p>

        <GameweekNav current={gameweek} min={min} max={max} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fixtures.map((fixture) => (
          <FixtureCard key={fixture.matchId} fixture={fixture} />
        ))}
      </div>
    </main>
  );
}
