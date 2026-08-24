import type { MatchSnapshot as MatchSnapshotData } from "@/lib/analytics/scoring/matchRepository";

/**
 * A tight row of facts, explicitly scoped to THE MATCH (not a team, not a
 * player) — the "THE MATCH" kicker exists specifically so a reader never
 * has to guess whose numbers these are, per the information-clarity
 * hierarchy (MATCH → TEAM → PLAYER) this page now follows throughout.
 * Kept to four counts, all already derivable from data shown elsewhere on
 * the page — no new statistics.
 */
export function MatchSnapshot({ snapshot }: { snapshot: MatchSnapshotData }) {
  return (
    <div>
      <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
        The match
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Chip value={snapshot.totalGoals} label="Goals" />
        <Chip value={snapshot.totalCards} label="Cards" />
        <Chip value={snapshot.strongPerformances} label="Strong performances (both sides)" tone="var(--color-positive)" />
        <Chip value={snapshot.poorPerformances} label="Difficult afternoons (both sides)" tone="var(--color-ink-faint)" />
      </div>
    </div>
  );
}

function Chip({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] px-3.5 py-3 text-center">
      <div
        className="font-display text-[22px] font-semibold tabular"
        style={{ color: tone ?? "var(--color-ink)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] leading-tight text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}
