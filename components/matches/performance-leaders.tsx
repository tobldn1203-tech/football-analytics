import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamCrest } from "@/components/identity/team-crest";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import type { PerformanceLeader, PerformanceLeaders as PerformanceLeadersData } from "@/lib/analytics/scoring/matchRepository";

const ROWS: Array<{ key: keyof PerformanceLeadersData; icon: string; label: string }> = [
  { key: "bestPerformer", icon: "⭐", label: "Best performer" },
  { key: "strongestAttack", icon: "📈", label: "Strongest attack" },
  { key: "strongestCreation", icon: "🎨", label: "Strongest creation" },
  { key: "strongestDefence", icon: "🧱", label: "Strongest defence" },
];

/**
 * "Who ran the show?" — per side, only the categories that actually cleared
 * a meaningful bar (see `computeLeaders` in matchRepository.ts). A team
 * with nobody clearing the attack threshold simply doesn't show that row,
 * rather than forcing a "leader" from a mediocre score. The team's own
 * colour on the left edge exists purely to make "this whole block belongs
 * to THIS team" unmissable at a glance — every row inside still names the
 * PLAYER explicitly, so team and player are never confused for each other.
 */
export function PerformanceLeaders({
  leaders,
  team,
}: {
  leaders: PerformanceLeadersData;
  team: { id: string; shortName: string; crestUrl: string | null };
}) {
  const rows = ROWS.filter((r) => leaders[r.key] !== null);
  if (rows.length === 0) return null;

  return (
    <div className="border-l-2 pl-3.5" style={{ borderColor: getTeamColor(team.shortName) }}>
      <Link href={`/teams/${team.id}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
        <TeamCrest crestUrl={team.crestUrl} shortName={team.shortName} size="sm" />
        <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">{team.shortName}</span>
      </Link>
      <div className="space-y-2.5">
        {rows.map(({ key, icon, label }) => (
          <LeaderRow key={key} icon={icon} label={label} leader={leaders[key]!} />
        ))}
      </div>
    </div>
  );
}

function LeaderRow({ icon, label, leader }: { icon: string; label: string; leader: PerformanceLeader }) {
  return (
    <Link
      href={`/players/${leader.slug}`}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span className="w-5 shrink-0 text-center text-[14px]" aria-hidden="true">
        {icon}
      </span>
      <PlayerAvatar photoUrl={leader.photoUrl} name={leader.name} teamShortName="" size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--color-ink)]">
          <NationalityFlag code={leader.nationalityCode} country={leader.nationality} size="xs" />
          <span className="truncate">{leader.name}</span>
        </span>
        <span className="block text-[11px] text-[var(--color-ink-faint)]">{label}</span>
      </span>
      <span className="shrink-0 font-display text-[15px] font-semibold tabular text-[var(--color-info)]">
        {leader.score.toFixed(1)}
      </span>
    </Link>
  );
}
