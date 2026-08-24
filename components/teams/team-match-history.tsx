import Link from "next/link";
import { TeamCrest } from "@/components/identity/team-crest";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import type { TeamMatchHistoryEntry } from "@/lib/analytics/scoring/teamRepository";

const RESULT_COLOR: Record<"W" | "D" | "L", string> = {
  W: "var(--color-positive)",
  D: "var(--color-ink-faint)",
  L: "var(--color-negative)",
};

/**
 * A performance journey, not a fixture table — each row links straight
 * into the existing Match Centre rather than duplicating any of its
 * detail. The best performer (a PLAYER stat) and Team Perf. (a TEAM stat)
 * are given their own labelled sub-blocks, deliberately not placed
 * adjacent without labels — the exact ambiguity the Match Centre clarity
 * pass was built to avoid.
 */
export function TeamMatchHistory({ matches, teamShortName }: { matches: TeamMatchHistoryEntry[]; teamShortName: string }) {
  if (matches.length === 0) {
    return <p className="text-[13.5px] text-[var(--color-ink-faint)]">No matches played yet.</p>;
  }

  return (
    <div className="space-y-2">
      {matches.map((m) => (
        <Link
          key={m.matchId}
          href={`/match/${m.matchId}`}
          className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-[var(--color-canvas)]"
            style={{ backgroundColor: RESULT_COLOR[m.result] }}
          >
            {m.result}
          </span>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamCrest crestUrl={m.opponentCrestUrl} shortName={m.opponentShortName} size="sm" />
            <span className="truncate text-[13.5px] text-[var(--color-ink)]">
              {m.isHome ? "vs" : "@"} <span className="font-medium">{m.opponentShortName}</span>
            </span>
            <span className="shrink-0 tabular text-[13px] text-[var(--color-ink-soft)]">
              {m.teamScore}–{m.opponentScore}
            </span>
          </div>

          {m.bestPerformer && (
            <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex" title={`Best performer for ${teamShortName}: ${m.bestPerformer.name}`}>
              <span className="text-[9.5px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">Best performer</span>
              <span className="flex items-center gap-1.5">
                <PlayerAvatar photoUrl={m.bestPerformer.photoUrl} name={m.bestPerformer.name} teamShortName={teamShortName} size="sm" />
                <NationalityFlag code={m.bestPerformer.nationalityCode} country={m.bestPerformer.nationality} size="xs" />
                <span className="max-w-[80px] truncate text-[12px] font-medium text-[var(--color-ink)]">{m.bestPerformer.name}</span>
              </span>
            </div>
          )}

          <div className="shrink-0 border-l border-[var(--color-border)] pl-3 text-right">
            {m.teamRating !== null ? (
              <>
                <div className="font-display text-[15px] font-semibold tabular text-[var(--color-info)]">{m.teamRating.toFixed(1)}</div>
                <div className="text-[9.5px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">Team Perf.</div>
              </>
            ) : (
              <span className="text-[11px] text-[var(--color-ink-faint)]">—</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
