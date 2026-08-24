import type { StrengthArea } from "@/lib/analytics/intelligence/types";

const ICON: Record<string, string> = { attack: "⚡", creation: "🎨", defence: "🧱", impact: "💥" };

/**
 * "What's Working" / "Areas to Watch" — reads `strengths`/`developmentAreas`
 * exactly as `detectStrengths` (Performance Intelligence) already computed
 * them, confidence-gated the same way as everywhere else in the app. Never
 * says "weakness" — `developmentAreas` labels are already framed gently at
 * the source (lib/analytics/intelligence/strengths.ts).
 */
export function TeamStrengths({ strengths, developmentAreas }: { strengths: StrengthArea[]; developmentAreas: StrengthArea[] }) {
  if (strengths.length === 0 && developmentAreas.length === 0) {
    return (
      <p className="text-[13.5px] text-[var(--color-ink-faint)]">
        Not enough matches yet to say what&rsquo;s working or what needs attention — too early to call.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-positive)]">What&rsquo;s working</h3>
        {strengths.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-ink-faint)]">Nothing stands out clearly yet.</p>
        ) : (
          <div className="space-y-2.5">
            {strengths.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <span className="text-[16px]" aria-hidden="true">{ICON[s.key] ?? "•"}</span>
                <div>
                  <div className="text-[13px] font-medium text-[var(--color-ink)]">{s.label}</div>
                  <div className="text-[11.5px] tabular text-[var(--color-ink-faint)]">{s.score.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-attention)]">Areas to watch</h3>
        {developmentAreas.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-ink-faint)]">Nothing flagged right now.</p>
        ) : (
          <div className="space-y-2.5">
            {developmentAreas.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5">
                <span className="text-[16px]" aria-hidden="true">{ICON[s.key] ?? "•"}</span>
                <div>
                  <div className="text-[13px] font-medium text-[var(--color-ink)]">{s.label}</div>
                  <div className="text-[11.5px] tabular text-[var(--color-ink-faint)]">Currently less effective — {s.score.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
