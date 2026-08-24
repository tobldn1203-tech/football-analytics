import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { explainPlayer } from "@/lib/analytics/scoring/explain";

export function WhyPanel({ player }: { player: RankedPlayer }) {
  const { headline, strengths } = explainPlayer(player);

  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        Why {player.name} ranks {player.qualityLabel.toLowerCase()}
      </div>
      <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-[var(--color-ink-soft)]">
        {headline}
      </p>
      {strengths.length > 0 && (
        <div className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {strengths.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5">
              <span className="text-[16px] leading-none" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <div className="text-[13px] font-semibold text-[var(--color-ink)]">{s.title}</div>
                <div className="text-[12.5px] leading-snug text-[var(--color-ink-faint)]">
                  {s.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
