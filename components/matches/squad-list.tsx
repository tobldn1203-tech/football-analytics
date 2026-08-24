import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { MatchRatingBadge } from "./match-rating";
import type { SquadMember } from "@/lib/analytics/scoring/matchRepository";

export function SquadList({
  startingXI,
  substitutes,
  teamShortName,
}: {
  startingXI: SquadMember[];
  substitutes: SquadMember[];
  teamShortName: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        Starting XI
      </h3>
      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {startingXI.map((member) => (
          <SquadRow key={member.playerId} member={member} teamShortName={teamShortName} />
        ))}
      </div>

      {substitutes.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
            Substitutes used
          </h3>
          <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {substitutes.map((member) => (
              <SquadRow key={member.playerId} member={member} teamShortName={teamShortName} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SquadRow({ member, teamShortName }: { member: SquadMember; teamShortName: string }) {
  const events = [
    member.goals > 0 && `⚽ ${member.goals > 1 ? `×${member.goals}` : ""}`.trim(),
    member.assists > 0 && `🅰️ ${member.assists > 1 ? `×${member.assists}` : ""}`.trim(),
    member.yellowCards > 0 && "🟨",
    member.redCards > 0 && "🟥",
  ].filter(Boolean);

  return (
    <Link
      href={`/players/${member.slug}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <PlayerAvatar photoUrl={member.photoUrl} name={member.name} teamShortName={teamShortName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <NationalityFlag code={member.nationalityCode} country={member.nationality} size="xs" />
          <span className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">{member.name}</span>
          {events.length > 0 && (
            <span className="shrink-0 text-[11px]">{events.join(" ")}</span>
          )}
        </div>
        <div className="text-[11.5px] text-[var(--color-ink-faint)]">
          {POSITION_LABEL[member.position]} · {member.minutes}&apos;
          {member.matchStrength && ` · ${member.matchStrength.label}`}
        </div>
      </div>
      <MatchRatingBadge rating={member.rating} size="sm" />
    </Link>
  );
}
