import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamCrest } from "@/components/identity/team-crest";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { MatchRatingBadge } from "./match-rating";
import type { PerformanceLeader, PerformanceLeaders as PerformanceLeadersData } from "@/lib/analytics/scoring/matchRepository";

/**
 * "Who ran the show?" — simplified to a plain top-3 by overall Match
 * Rating per side (see `computeLeaders` in matchRepository.ts). Used to
 * also surface a per-category leader (strongest attack/creation/defence);
 * removed by product decision after those correctly-computed category
 * scores turned out to be easy to misread as a second, competing rating
 * next to Squad Performance's overall one for the same player-match (see
 * docs — the Palacios/Fulham v Crystal Palace investigation). Every score
 * in this section is now `scores.overall` — the exact number Squad
 * Performance and the player page already show — so it gets that same
 * "overall rating" treatment via `MatchRatingBadge`, reused rather than
 * redrawn, with nothing left to visually distinguish from anything else
 * on this page. A team with fewer than 3 rated players simply shows fewer
 * rows, rather than padding the list out.
 *
 * The team's own colour on the left edge exists purely to make "this
 * whole block belongs to THIS team" unmissable at a glance — every row
 * inside still names the PLAYER explicitly, so team and player are never
 * confused for each other.
 */
export function PerformanceLeaders({
  leaders,
  team,
}: {
  leaders: PerformanceLeadersData;
  team: { id: string; shortName: string; crestUrl: string | null };
}) {
  if (leaders.top.length === 0) return null;

  return (
    <div className="border-l-2 pl-3.5" style={{ borderColor: getTeamColor(team.shortName) }}>
      <Link href={`/teams/${team.id}`} className="mb-3 flex items-center gap-2 hover:opacity-80">
        <TeamCrest crestUrl={team.crestUrl} shortName={team.shortName} size="sm" />
        <span className="text-[13.5px] font-semibold text-[var(--color-ink)]">{team.shortName}</span>
      </Link>
      <div className="space-y-2.5">
        {leaders.top.map((leader, i) => (
          <LeaderRow key={leader.playerId} rank={i + 1} leader={leader} />
        ))}
      </div>
    </div>
  );
}

function LeaderRow({ rank, leader }: { rank: number; leader: PerformanceLeader }) {
  return (
    <Link
      href={`/players/${leader.slug}`}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <span className="w-5 shrink-0 text-center font-display text-[13px] font-semibold tabular text-[var(--color-ink-faint)]" aria-hidden="true">
        {rank}
      </span>
      <PlayerAvatar photoUrl={leader.photoUrl} name={leader.name} teamShortName="" size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--color-ink)]">
          <NationalityFlag code={leader.nationalityCode} country={leader.nationality} size="xs" />
          <span className="truncate">{leader.name}</span>
        </span>
        <span className="block text-[11px] text-[var(--color-ink-faint)]">
          {POSITION_LABEL[leader.position]} · {leader.minutes}&apos;
        </span>
      </span>
      <MatchRatingBadge rating={{ score: leader.score, label: leader.qualityLabel, lowMinutes: leader.lowMinutes }} size="sm" />
    </Link>
  );
}
