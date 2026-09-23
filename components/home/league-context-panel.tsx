"use client";

import Link from "next/link";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "@/components/personalisation/personalisation-provider";
import { LeagueTable } from "@/components/teams/league-table";
import type { TeamStanding } from "@/lib/analytics/scoring/teamRepository";

/**
 * LEAGUE CONTEXT — sits beside My Football (see app/page.tsx's grid) rather
 * than as a separate, unrelated "standings" widget further down the page.
 * Reuses LeagueTable's existing `compact` mode verbatim — no new table, no
 * new data shape. The one new decision is WHICH team to centre the compact
 * window on: the viewer's own supported club if they have one (so "League
 * Context" genuinely means "where my club sits"), otherwise the club
 * currently top of the table (so an unpersonalised visitor still gets a
 * meaningful default — "who's leading" — rather than an arbitrary slice).
 */
export function LeagueContextPanel({ standings }: { standings: TeamStanding[] }) {
  const preferences = usePreferences();
  const { teams } = useDirectory();
  const club = teams.find((t) => t.id === preferences.supportedClubId);

  if (standings.length === 0) return null;

  const aroundTeamId = club?.id ?? standings[0].teamId;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          {club ? "Where your club stands" : "League context"}
        </h2>
        <Link href="/teams" className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline">
          Full table →
        </Link>
      </div>
      <LeagueTable standings={standings} compact={{ aroundTeamId, window: 6 }} showForm={false} />
    </div>
  );
}
