import { getTopPerformers, getHomepageDiscover } from "@/lib/analytics/scoring/repository";
import { getAllClubFixtureSnapshots, type ClubFixtureSnapshot } from "@/lib/analytics/scoring/matchRepository";
import { TopPerformers } from "@/components/home/top-performers";
import { DiscoverTeaser } from "@/components/home/discover-teaser";
import { MyFootballWidget } from "@/components/home/my-football-widget";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";

export const revalidate = 300;

export default async function Home() {
  let content;
  let discover = null;
  let fixtures: Record<string, ClubFixtureSnapshot> = {};
  let standoutByTeam: Record<string, RankedPlayer> = {};
  let insightByTeam: Record<string, string> = {};

  try {
    const [{ players, sampleNote }, discoverData, fixtureSnapshots] = await Promise.all([
      getTopPerformers(),
      getHomepageDiscover(),
      getAllClubFixtureSnapshots(),
    ]);
    discover = discoverData;
    fixtures = fixtureSnapshots;

    // Standout player per club — the existing overall Performance score,
    // grouped by team and taking the top one. No new analytics: same
    // number already shown on the homepage table and every player page.
    for (const player of players) {
      const current = standoutByTeam[player.teamShortName];
      if (!current || (player.scores.overall ?? 0) > (current.scores.overall ?? 0)) {
        standoutByTeam[player.teamShortName] = player;
      }
    }

    // "My Football" widget insight — a minutes-weighted category leader per
    // team, from the SAME players array above (no new query, no new
    // formula). Only shown when a category genuinely clears the same 5.5
    // threshold used everywhere else in the app for "this stands out" —
    // most teams correctly get no insight line yet, this early in a season.
    const teamMinutes: Record<string, number> = {};
    const teamCategorySums: Record<string, { attack: number; creation: number; defence: number }> = {};
    for (const player of players) {
      const minutes = player.sample.minutes;
      teamMinutes[player.teamShortName] = (teamMinutes[player.teamShortName] ?? 0) + minutes;
      const sums = (teamCategorySums[player.teamShortName] ??= { attack: 0, creation: 0, defence: 0 });
      sums.attack += (player.scores.attack ?? 0) * minutes;
      sums.creation += (player.scores.creation ?? 0) * minutes;
      sums.defence += (player.scores.defence ?? 0) * minutes;
    }
    const CATEGORY_INSIGHT_LABEL = { attack: "attacking output", creation: "chance creation", defence: "defensive performances" } as const;
    for (const [teamShortName, sums] of Object.entries(teamCategorySums)) {
      const minutes = teamMinutes[teamShortName];
      if (!minutes) continue;
      const entries = (["attack", "creation", "defence"] as const).map((k) => ({ k, score: sums[k] / minutes }));
      const top = entries.sort((a, b) => b.score - a.score)[0];
      if (top.score >= 5.5) {
        insightByTeam[teamShortName] = `Strongest area this season: ${CATEGORY_INSIGHT_LABEL[top.k]}.`;
      }
    }

    if (players.length === 0) {
      content = (
        <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-10 text-center text-[14px] text-[var(--color-ink-faint)]">
          No data yet — run <code className="font-mono">npm run ingest</code> to load the
          current season.
        </div>
      );
    } else {
      content = <TopPerformers players={players} sampleNote={sampleNote} />;
    }
  } catch (err) {
    content = (
      <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-10 text-center text-[14px] text-[var(--color-ink-faint)]">
        Data is temporarily unavailable
        {err instanceof Error ? `: ${err.message}` : "."}
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--color-ink-faint)]">
        <span className="font-medium uppercase tracking-[0.1em]">Preview build</span>
        <span aria-hidden="true">·</span>
        <span>
          Provisional scoring —{" "}
          <a href="/methodology" className="underline underline-offset-2 hover:text-[var(--color-ink)]">
            how these scores are calculated
          </a>
        </span>
      </div>

      <MyFootballWidget fixtures={fixtures} standoutByTeam={standoutByTeam} insightByTeam={insightByTeam} />

      {discover && <DiscoverTeaser discover={discover} />}

      {content}
    </main>
  );
}
