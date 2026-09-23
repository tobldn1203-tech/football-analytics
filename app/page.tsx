import { getTopPerformers, getHomepageDiscover } from "@/lib/analytics/scoring/repository";
import { getAllClubFixtureSnapshots, type ClubFixtureSnapshot } from "@/lib/analytics/scoring/matchRepository";
import { getLeagueStandings, type TeamStanding } from "@/lib/analytics/scoring/teamRepository";
import { getPlayerAvailabilityMap } from "@/lib/analytics/availability/repository";
import { getAllTeams } from "@/lib/directory/repository";
import { buildWorthKnowingInsight, type WorthKnowingInsight } from "@/lib/analytics/availability/worthKnowing";
import { LeagueLeadersHero } from "@/components/home/league-leaders-hero";
import { TopPerformers } from "@/components/home/top-performers";
import { DiscoverTeaser } from "@/components/home/discover-teaser";
import { MyFootballWidget } from "@/components/home/my-football-widget";
import { LeagueContextPanel } from "@/components/home/league-context-panel";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";

export const revalidate = 300;

export default async function Home() {
  let players: RankedPlayer[] = [];
  let sampleNote = "";
  let errorMessage: string | null = null;
  let discover = null;
  let fixtures: Record<string, ClubFixtureSnapshot> = {};
  let standings: TeamStanding[] = [];
  let standoutByTeam: Record<string, RankedPlayer> = {};
  let insightByTeam: Record<string, string> = {};
  let worthKnowingByTeam: Record<string, WorthKnowingInsight> = {};

  try {
    const [topPerformers, discoverData, fixtureSnapshots, standingsData, teamDirectory] = await Promise.all([
      getTopPerformers(),
      getHomepageDiscover(),
      getAllClubFixtureSnapshots(),
      getLeagueStandings(),
      getAllTeams(),
    ]);
    players = topPerformers.players;
    sampleNote = topPerformers.sampleNote;
    const teamNameByShortName = new Map(teamDirectory.map((t) => [t.shortName, t.name]));
    discover = discoverData;
    fixtures = fixtureSnapshots;
    standings = standingsData;

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

    // "Worth knowing" — availability cross-referenced against each
    // player's own already-computed Performance score above, exactly the
    // primitive Team Intelligence uses (see
    // lib/analytics/availability/worthKnowing.ts). One availability query
    // for every player league-wide, since personalisation is client-only
    // (localStorage) — the server can't know which club to compute this
    // for ahead of time, so every club gets one, same pattern as
    // `standoutByTeam`/`insightByTeam` above.
    const playersByTeam: Record<string, RankedPlayer[]> = {};
    for (const player of players) {
      (playersByTeam[player.teamShortName] ??= []).push(player);
    }
    const availabilityMap = await getPlayerAvailabilityMap(players.map((p) => p.playerId));
    for (const [teamShortName, teamPlayers] of Object.entries(playersByTeam)) {
      const teamName = teamNameByShortName.get(teamShortName) ?? teamShortName;
      const insight = buildWorthKnowingInsight(teamName, teamPlayers, availabilityMap);
      if (insight) worthKnowingByTeam[teamShortName] = insight;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Data is temporarily unavailable.";
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-10 sm:px-8">
      {/* UX REWORK: was a full-width, always-expanded line sitting above
          everything else on the page — accurate, but disproportionately
          prominent for a footnote. Same two claims, same link, same
          meaning — "Preview build" (the product's current stage) and
          "Provisional scoring" (the methodology caveat) are still both
          here verbatim, just closed by default via the same native
          <details> disclosure already used for Match Centre's squad lists
          (components/ui/collapsible-section.tsx). A reader who doesn't
          care skips a single small label; a reader who does care gets the
          full explanation and working link one click away, not a
          navigation away.

          HOME PAGE TIGHTENING: the top of this page previously carried
          `py-10` (40px) above this disclosure, on top of its own `mb-6`
          (24px) gap to the next section below it — measured, a bigger gap
          to the header above than the page uses between any of its own
          stacked sections. `pt-6` (24px) brings it in line with that
          established rhythm instead of inventing a new, smaller one;
          `pb-10` at the bottom of the page is untouched. */}
      <div className="mb-6">
        <CollapsibleSection label="Preview build" className="inline-block">
          <p className="pb-1 text-[12px] text-[var(--color-ink-faint)]">
            Provisional scoring —{" "}
            <a href="/methodology" className="underline underline-offset-2 hover:text-[var(--color-ink)]">
              how these scores are calculated
            </a>
          </p>
        </CollapsibleSection>
      </div>

      {errorMessage || players.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-10 text-center text-[14px] text-[var(--color-ink-faint)]">
          {errorMessage
            ? `Data is temporarily unavailable: ${errorMessage}`
            : (
              <>
                No data yet — run <code className="font-mono">npm run ingest</code> to load the current season.
              </>
            )}
        </div>
      ) : (
        <>
          {/*
            LEAGUE LEADERS — the new cinematic masthead, then the full
            ranked table directly beneath it (see both components' own
            comments and docs/VISUAL_UX_REIMAGINATION.md §5/§13). Same
            `players`/`sampleNote` TopPerformers always received — no new
            data, no new query.
          */}
          <div className="mb-6">
            <LeagueLeadersHero players={players} sampleNote={sampleNote} />
          </div>
          <div className="mb-8">
            <TopPerformers players={players} sampleNote={sampleNote} />
          </div>
        </>
      )}

      {/*
        MY FOOTBALL / LEAGUE CONTEXT — a CSS auto-fit grid, deliberately not
        a component-level "is a club supported" check: MyFootballWidget
        already renders nothing (returns null) when no club is set, which
        with `auto-fit` means the grid simply collapses to LeagueContextPanel
        alone at full width — no client-side layout logic duplicated here.
      */}
      <div className="mb-8 grid items-start gap-6 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
        <MyFootballWidget
          fixtures={fixtures}
          standoutByTeam={standoutByTeam}
          insightByTeam={insightByTeam}
          worthKnowingByTeam={worthKnowingByTeam}
        />
        <LeagueContextPanel standings={standings} />
      </div>

      {discover && <DiscoverTeaser discover={discover} />}
    </main>
  );
}
