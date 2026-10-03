"use client";

import Link from "next/link";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { TeamCrest } from "@/components/identity/team-crest";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import type { TeamStanding } from "@/lib/analytics/scoring/teamRepository";

const RESULT_COLOR: Record<"W" | "D" | "L", string> = {
  W: "var(--color-positive)",
  D: "var(--color-ink-faint)",
  L: "var(--color-negative)",
};

/**
 * The Premier League table — one canonical rendering, reused both as the
 * full 20-team standings (`/teams`) and, in `compact` mode, as a short
 * "league position" strip on an individual team's page. Always built from
 * `getLeagueStandings()` (lib/analytics/scoring/teamRepository.ts) — never
 * a second data source, never fabricated.
 *
 * Supported-club highlighting is a personalisation LAYER on top of a table
 * that already works perfectly with nothing selected: `usePreferences()`
 * simply matches nothing when `supportedClubId` is null, so the table's
 * structure, sorting and readability never depend on it.
 */
export function LeagueTable({
  standings,
  compact,
  showForm = true,
}: {
  standings: TeamStanding[];
  /** Show only a short window of rows centred on one team, for use inside that team's own page. */
  compact?: { aroundTeamId: string; window?: number };
  showForm?: boolean;
}) {
  const preferences = usePreferences();
  const supportedClubId = preferences.supportedClubId;

  let rows = standings;
  if (compact) {
    const window = compact.window ?? 7;
    const idx = standings.findIndex((s) => s.teamId === compact.aroundTeamId);
    if (idx !== -1) {
      const half = Math.floor(window / 2);
      const start = Math.max(0, Math.min(idx - half, standings.length - window));
      rows = standings.slice(start, start + window);
    } else {
      rows = standings.slice(0, window);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">
            <th className="w-8 px-2.5 py-2.5 text-center">#</th>
            <th className="px-2 py-2.5">Club</th>
            <th className="w-8 px-1.5 py-2.5 text-center">P</th>
            <th className="hidden w-8 px-1.5 py-2.5 text-center sm:table-cell">W</th>
            <th className="hidden w-8 px-1.5 py-2.5 text-center sm:table-cell">D</th>
            <th className="hidden w-8 px-1.5 py-2.5 text-center sm:table-cell">L</th>
            <th className="hidden w-9 px-1.5 py-2.5 text-center md:table-cell">GF</th>
            <th className="hidden w-9 px-1.5 py-2.5 text-center md:table-cell">GA</th>
            <th className="w-9 px-1.5 py-2.5 text-center">GD</th>
            <th className="w-9 px-2 py-2.5 text-center font-bold">Pts</th>
            {showForm && <th className="hidden px-3 py-2.5 lg:table-cell">Form</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const isSupported = s.teamId === supportedClubId;
            const isViewed = compact?.aroundTeamId === s.teamId;
            const highlighted = isSupported || isViewed;
            const accent = getTeamColor(s.shortName);
            return (
              <tr
                key={s.teamId}
                className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-2)]"
                style={highlighted ? { backgroundColor: `color-mix(in srgb, ${accent} 7%, transparent)` } : undefined}
              >
                <td
                  className="px-2.5 py-2.5 text-center tabular text-[var(--color-ink-faint)]"
                  style={{
                    // Highlighted (supported club / compact-view centre)
                    // keeps its existing, stronger fixed 3px tick, exactly
                    // as before in both themes. Every other row now gets a
                    // quieter permanent tick too, via --row-swatch (3px in
                    // Stadium Daylight, 0px in dark — a no-op there, so
                    // unhighlighted rows in dark are unchanged).
                    boxShadow: highlighted ? `inset 3px 0 0 ${accent}` : `inset var(--row-swatch) 0 0 ${accent}`,
                  }}
                >
                  {s.position}
                </td>
                <td className="px-2 py-2.5">
                  <Link href={`/teams/${s.teamId}`} className="flex items-center gap-2.5 hover:opacity-80">
                    <TeamCrest crestUrl={s.crestUrl} shortName={s.shortName} size="sm" />
                    <span className={`truncate ${highlighted ? "font-semibold" : "font-medium"} text-[var(--color-ink)]`}>
                      <span className="hidden sm:inline">{s.name}</span>
                      <span className="sm:hidden">{s.shortName}</span>
                    </span>
                    {isSupported && (
                      <span
                        className="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-white sm:inline"
                        style={{ backgroundColor: accent }}
                      >
                        Your club
                      </span>
                    )}
                  </Link>
                </td>
                <td className="px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)]">{s.played}</td>
                <td className="hidden px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)] sm:table-cell">{s.won}</td>
                <td className="hidden px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)] sm:table-cell">{s.drawn}</td>
                <td className="hidden px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)] sm:table-cell">{s.lost}</td>
                <td className="hidden px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)] md:table-cell">{s.goalsFor}</td>
                <td className="hidden px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)] md:table-cell">{s.goalsAgainst}</td>
                <td className="px-1.5 py-2.5 text-center tabular text-[var(--color-ink-soft)]">
                  {s.goalDifference > 0 ? "+" : ""}
                  {s.goalDifference}
                </td>
                <td className="px-2 py-2.5 text-center font-display font-bold tabular text-[var(--color-ink)]">{s.points}</td>
                {showForm && (
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {s.form.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {s.form.map((r, i) => (
                          <span
                            key={i}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[8.5px] font-bold text-white"
                            style={{ backgroundColor: RESULT_COLOR[r] }}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--color-ink-faint)]">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
