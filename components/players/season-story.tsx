import Link from "next/link";
import { MatchTrend, type MatchTrendPoint } from "@/components/charts/match-trend";
import { TeamIdentity } from "@/components/identity/team-identity";
import type { PlayerExplanation } from "@/lib/analytics/scoring/explain";
import type { PlayerMatchRow } from "@/lib/analytics/scoring/repository";

/**
 * SEASON STORY
 * =============
 * The player page's headline section — a narrative paragraph plus the
 * supporting evidence for it, in the order the product brief asked for:
 * story → supporting numbers → performance journey → what stands out →
 * best performances. Every number here was already computed elsewhere
 * (lib/analytics/scoring, lib/analytics/intelligence, lib/analytics/story)
 * — this component only arranges and labels it.
 */

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
    {children}
  </h3>
);

export function SeasonStory({
  paragraph,
  totals,
  showCleanSheets,
  journeyPoints,
  explanation,
  best,
}: {
  paragraph: string;
  totals: { minutes: number; matches: number; goals: number; assists: number; cleanSheets: number };
  showCleanSheets: boolean;
  journeyPoints: MatchTrendPoint[];
  explanation: PlayerExplanation;
  best: PlayerMatchRow[];
}) {
  const whatStandsOut = explanation.strengths.slice(0, 3);

  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
          Season Story
        </span>
      </div>
      <p className="text-[15.5px] leading-relaxed text-[var(--color-ink)] sm:text-[16.5px]">{paragraph}</p>

      {/*
        Season Performance / Momentum / Consistency are deliberately not
        repeated here — the hero above already shows the score, the
        Form/Momentum trend pill, and the consistency line. Re-stating
        them a few pixels below was the exact duplication identified in
        docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md Part 2; Recent
        Form's actual number (the one thing the hero didn't show) now
        lives in that same trend pill instead of a fifth chip here.
      */}

      {/* Supporting elements: Appearances / Minutes / Goals / Assists */}
      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--color-border)] pt-4">
        <StatTile label="Appearances" value={totals.matches} />
        <StatTile label="Minutes" value={totals.minutes} />
        <StatTile label="Goals" value={totals.goals} />
        <StatTile label="Assists" value={totals.assists} />
        {showCleanSheets && <StatTile label="Clean sheets" value={totals.cleanSheets} />}
      </div>

      {/* Performance Journey */}
      <div className="mt-7">
        <SectionLabel>Performance Journey</SectionLabel>
        <MatchTrend points={journeyPoints} color="var(--color-info)" />
      </div>

      {/* What Stands Out */}
      {whatStandsOut.length > 0 && (
        <div className="mt-7">
          <SectionLabel>What Stands Out</SectionLabel>
          <div className="space-y-3.5">
            {whatStandsOut.map((s) => (
              <div key={s.title} className="flex items-start gap-2.5">
                <span className="text-[17px] leading-none" aria-hidden="true">
                  {s.icon}
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--color-ink)]">{s.title}</div>
                  <div className="text-[12.5px] leading-snug text-[var(--color-ink-faint)]">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Performances */}
      {best.length > 0 && (
        <div className="mt-7">
          <SectionLabel>Best Performances</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {best.map((m) => (
              <Link
                key={m.matchId}
                href={`/match/${m.matchId}`}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-4 py-3 transition-colors hover:border-[var(--color-info)] hover:bg-[var(--color-surface-2)]"
              >
                <TeamIdentity crestUrl={m.opponentCrestUrl} name={m.opponentShortName} shortName={m.opponentShortName} size="md" showFullName={false} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-[var(--color-ink)]">
                    vs {m.opponentShortName} ({m.isHome ? "H" : "A"})
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--color-ink-faint)]">
                    {[
                      m.goals > 0 && `${m.goals} goal${m.goals > 1 ? "s" : ""}`,
                      m.assists > 0 && `${m.assists} assist${m.assists > 1 ? "s" : ""}`,
                      m.cleanSheet && "clean sheet",
                    ]
                      .filter(Boolean)
                      .join(" · ") || `${m.minutes} minutes played`}
                  </div>
                </div>
                {m.matchRating && (
                  <div className="shrink-0 text-right">
                    <div className="font-display text-[17px] font-semibold tabular text-[var(--color-info)]">
                      {m.matchRating.score.toFixed(1)}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">
                      {m.matchRating.label}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[70px]">
      <div className="font-display text-[22px] font-semibold tabular text-[var(--color-ink)]">{value}</div>
      <div className="text-[11.5px] text-[var(--color-ink-faint)]">{label}</div>
    </div>
  );
}
