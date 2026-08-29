import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { MatchRatingBadge } from "./match-rating";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import type { SquadMember } from "@/lib/analytics/scoring/matchRepository";

/**
 * MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md Priority 3): two full
 * Starting XIs plus substitute benches, always fully expanded for both
 * teams, was the single biggest contributor to Match Centre reaching
 * ~4,600px tall on a phone. Desktop keeps exactly today's presentation
 * (both lists always visible, no change at all) — the two blocks below
 * are genuinely separate renders, not one component reacting to screen
 * size, so there is no risk of a desktop regression here. Mobile gets a
 * `CollapsibleSection` per list, closed by default; no player, rating, or
 * event data is removed, only its default visibility.
 */
export function SquadList({
  startingXI,
  substitutes,
  teamShortName,
}: {
  startingXI: SquadMember[];
  substitutes: SquadMember[];
  teamShortName: string;
}) {
  const startingRows = (
    <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
      {startingXI.map((member) => (
        <SquadRow key={member.playerId} member={member} teamShortName={teamShortName} />
      ))}
    </div>
  );
  const subRows = substitutes.length > 0 && (
    <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
      {substitutes.map((member) => (
        <SquadRow key={member.playerId} member={member} teamShortName={teamShortName} />
      ))}
    </div>
  );

  return (
    <div>
      {/* Desktop — unchanged from before this pass: always fully expanded. */}
      <div className="hidden sm:block">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Starting XI</h3>
        {startingRows}
        {subRows && (
          <>
            <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Substitutes used</h3>
            {subRows}
          </>
        )}
      </div>

      {/* Mobile — collapsed by default; the complete squad is one tap away. */}
      <div className="space-y-3 sm:hidden">
        <CollapsibleSection label="Starting XI" count={startingXI.length}>
          {startingRows}
        </CollapsibleSection>
        {subRows && (
          <CollapsibleSection label="Substitutes used" count={substitutes.length}>
            {subRows}
          </CollapsibleSection>
        )}
      </div>
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
