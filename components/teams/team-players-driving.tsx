import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import type { RankedPlayer, Category } from "@/lib/analytics/scoring/types";

const SLOTS: Array<{ key: "standout" | "inForm" | "attackingThreat" | "creativeLeader" | "defensiveStandout"; icon: string; label: string; metric: Category }> = [
  { key: "standout", icon: "⭐", label: "Standout performer", metric: "overall" },
  { key: "inForm", icon: "🔥", label: "Most in form", metric: "form" },
  { key: "attackingThreat", icon: "⚡", label: "Biggest attacking threat", metric: "attack" },
  { key: "creativeLeader", icon: "🎨", label: "Creative leader", metric: "creation" },
  { key: "defensiveStandout", icon: "🧱", label: "Defensive standout", metric: "defence" },
];

export function TeamPlayersDriving({
  players,
}: {
  players: Partial<Record<(typeof SLOTS)[number]["key"], RankedPlayer | null>>;
}) {
  const filled = SLOTS.filter((s) => players[s.key]);
  if (filled.length === 0) {
    return <p className="text-[13.5px] text-[var(--color-ink-faint)]">Not enough matches yet to single anyone out — too early to call.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filled.map((s) => {
        const player = players[s.key]!;
        const score = player.scores[s.metric] ?? 0;
        return (
          <Link
            key={s.key}
            href={`/players/${player.slug}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <PlayerAvatar photoUrl={player.photoUrl} name={player.name} teamShortName={player.teamShortName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">
                <span aria-hidden="true">{s.icon}</span>
                {s.label}
              </div>
              <div className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[var(--color-ink)]">
                <NationalityFlag code={player.nationalityCode} country={player.nationality} size="xs" />
                <span className="truncate">{player.name}</span>
              </div>
              <div className="text-[11.5px] text-[var(--color-ink-faint)]">{POSITION_LABEL[player.position]}</div>
            </div>
            <div className="shrink-0 font-display text-[17px] font-semibold tabular text-[var(--color-accent)]">{score.toFixed(1)}</div>
          </Link>
        );
      })}
    </div>
  );
}
