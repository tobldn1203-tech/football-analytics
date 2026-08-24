import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamCrest } from "@/components/identity/team-crest";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import type { MatchStandout as MatchStandoutData } from "@/lib/analytics/scoring/matchRepository";

/**
 * The observation sits as a normal sentence next to the evidence, not a
 * giant capitalised headline — see docs/FOOTBALL_VOICE_REDESIGN.md. Level
 * 3 (an actual mechanism fired) gets a small "·" divider before the
 * evidence, still same weight as everything around it; Levels 1–2 just
 * read as one calm line, since there's no separate joke to set apart.
 */
export function MatchStandout({
  standout,
  teamShortName,
  teamCrestUrl,
}: {
  standout: MatchStandoutData;
  teamShortName: string;
  teamCrestUrl: string | null;
}) {
  const { narrative } = standout;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <div className="flex items-center gap-4 px-5 pt-5 pb-4 sm:px-6">
        <PlayerAvatar photoUrl={standout.photoUrl} name={standout.name} teamShortName={teamShortName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-info)]">
            Match standout
          </p>
          <Link
            href={`/players/${standout.slug}`}
            className="font-display flex items-center gap-1.5 truncate text-[17px] font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)]"
          >
            <NationalityFlag code={standout.nationalityCode} country={standout.nationality} size="sm" />
            <span className="truncate">{standout.name}</span>
          </Link>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--color-ink-faint)]">
            <TeamCrest crestUrl={teamCrestUrl} shortName={teamShortName} size="sm" />
            {teamShortName}
          </div>
        </div>
        <div className="flex w-[78px] shrink-0 flex-col items-end text-right sm:w-[92px]">
          <span className="font-display text-[30px] font-semibold leading-none tabular text-[var(--color-info)] sm:text-[38px]">
            {standout.rating!.score.toFixed(1)}
          </span>
          <span className="mt-1 text-[10px] uppercase leading-snug tracking-[0.04em] text-[var(--color-ink-faint)] sm:text-[11px]">
            Match Rating · {standout.rating!.label}
          </span>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] px-5 py-3.5 sm:px-6">
        <p className="text-[14px] leading-relaxed text-[var(--color-ink)]">
          {narrative.observation}
          {narrative.level === 3 && <span className="text-[var(--color-ink-faint)]"> · {narrative.evidence}</span>}
        </p>
        {narrative.level < 3 && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-faint)]">{narrative.evidence}</p>
        )}
      </div>
    </div>
  );
}
