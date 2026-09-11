import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamCrest } from "@/components/identity/team-crest";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import type { PerformanceLeader, PerformanceLeaders as PerformanceLeadersData } from "@/lib/analytics/scoring/matchRepository";

/**
 * `abbrev` marks the three rows below as a SINGLE-CATEGORY score, not an
 * overall rating — see LeaderRow. `bestPerformer` has none: its score
 * really is `MatchRating.scores.overall`, the same number Squad Performance
 * and the player's own page show for this match, and keeps looking like it.
 */
const ROWS: Array<{ key: keyof PerformanceLeadersData; icon: string; label: string; abbrev?: string }> = [
  { key: "bestPerformer", icon: "⭐", label: "Best performer" },
  { key: "strongestAttack", icon: "📈", label: "Strongest attack", abbrev: "ATK" },
  { key: "strongestCreation", icon: "🎨", label: "Strongest creation", abbrev: "CRE" },
  { key: "strongestDefence", icon: "🧱", label: "Strongest defence", abbrev: "DEF" },
];

/**
 * "Who ran the show?" — per side, only the categories that actually cleared
 * a meaningful bar (see `computeLeaders` in matchRepository.ts). A team
 * with nobody clearing the attack threshold simply doesn't show that row,
 * rather than forcing a "leader" from a mediocre score. The team's own
 * colour on the left edge exists purely to make "this whole block belongs
 * to THIS team" unmissable at a glance — every row inside still names the
 * PLAYER explicitly, so team and player are never confused for each other.
 *
 * DISPLAY FIX (category-vs-overall ambiguity, see investigation report):
 * `strongestAttack`/`strongestCreation`/`strongestDefence` read
 * `MatchRating.scores[category]` — one of four inputs that get blended,
 * position-weighted, into `scores.overall`, the number Squad Performance
 * and the player's own page show for this same player-match. Both are
 * correctly computed; the bug was purely visual — the category score used
 * to render in the exact same size/weight/colour as an overall rating, so
 * "Strongest attack: 9.9" looked exactly as authoritative as "Rating: 6.9"
 * two rows below it, for the same player. `bestPerformer` genuinely IS
 * `scores.overall` (see `computeLeaders`) and is untouched — it should
 * keep matching Squad Performance's look, not diverge from it.
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
        {rows.map(({ key, icon, label, abbrev }) => (
          <LeaderRow key={key} icon={icon} label={label} abbrev={abbrev} leader={leaders[key]!} />
        ))}
      </div>
    </div>
  );
}

function LeaderRow({
  icon,
  label,
  abbrev,
  leader,
}: {
  icon: string;
  label: string;
  /** Present only for a single-category score — see the note above. */
  abbrev?: string;
  leader: PerformanceLeader;
}) {
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
      {abbrev ? (
        // Single-category score: smaller, muted ink (not the info-blue used
        // for overall ratings everywhere else), with the category itself
        // tied directly to the number — reusing MatchRatingBadge's own
        // "score stacked over a small uppercase unit" shape
        // (components/matches/match-rating.tsx), not a new pattern.
        <span className="inline-flex shrink-0 flex-col items-end">
          <span className="font-display text-[13px] font-medium leading-none tabular text-[var(--color-ink-soft)]">
            {leader.score.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">{abbrev}</span>
        </span>
      ) : (
        <span className="shrink-0 font-display text-[15px] font-semibold tabular text-[var(--color-info)]">
          {leader.score.toFixed(1)}
        </span>
      )}
    </Link>
  );
}
