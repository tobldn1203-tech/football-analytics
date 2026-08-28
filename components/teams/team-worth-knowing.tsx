import Link from "next/link";
import type { WorthKnowingInsight } from "@/lib/analytics/availability/worthKnowing";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";

/**
 * "Availability watch" — Team Intelligence's richer rendering of the same
 * insight My Football shows compactly (see my-football-worth-knowing.tsx).
 * See docs/NEWS_CONTEXT_PRODUCT_DESIGN.md. Renders nothing at all when
 * there's no insight — a quiet section is the correct outcome, not a
 * fallback state to fill with something.
 */
export function TeamWorthKnowing({ insight }: { insight: WorthKnowingInsight | null }) {
  if (!insight) return null;

  return (
    <section className="mt-9">
      <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">Availability watch</h2>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 sm:px-6">
        <p className="text-[14.5px] leading-relaxed text-[var(--color-ink)]">{insight.headline}</p>
        {insight.voice && <p className="mt-1.5 text-[12.5px] italic text-[var(--color-ink-faint)]">{insight.voice.observation}</p>}

        <div className="mt-4 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {insight.players.map((p) => (
            <Link
              key={p.playerId}
              href={`/players/${p.slug}`}
              className="flex items-center gap-3 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
            >
              <PlayerAvatar photoUrl={p.photoUrl} name={p.name} teamShortName="" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                  <NationalityFlag code={p.nationalityCode} country={p.nationality} size="xs" />
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--color-ink-faint)]">
                  <span>{POSITION_LABEL[p.position]}</span>
                  <span
                    className="inline-block h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: "var(--color-attention)" }}
                    aria-hidden="true"
                  />
                  <span>{p.availability.label}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-[15px] font-semibold tabular text-[var(--color-accent)]">{p.score.toFixed(1)}</div>
                <div className="text-[10.5px] text-[var(--color-ink-faint)]">{p.qualityLabel}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
