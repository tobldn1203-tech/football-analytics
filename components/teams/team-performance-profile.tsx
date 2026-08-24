import { qualityLabelFor } from "@/lib/analytics/scoring/types";

type CategoryKey = "attack" | "creation" | "defence" | "impact";

const ICON: Record<CategoryKey, string> = { attack: "⚡", creation: "🎨", defence: "🧱", impact: "💥" };
const LABEL: Record<CategoryKey, string> = {
  attack: "Attacking output",
  creation: "Chance creation",
  defence: "Defensive contribution",
  impact: "Overall match impact",
};

/**
 * PERFORMANCE PROFILE — replaces the old FIFA-attribute-style chip grid.
 * Same four category scores, same Performance scoring engine, completely
 * unchanged underneath. The difference is entirely presentational: rows
 * are ranked strongest-first so the ordering itself carries meaning, the
 * qualitative label ("Very good", "Good"...) is the primary read, and the
 * raw 0–10 score is kept small and secondary rather than being the hero
 * number in a big bold font. No bars, no meters — the ranking + words do
 * the work a bar chart would otherwise do.
 */
export function TeamPerformanceProfile({
  scores,
}: {
  scores: { attack: number; creation: number; defence: number; impact: number; overall: number };
}) {
  const categories = (Object.keys(LABEL) as CategoryKey[]).map((key) => ({ key, score: scores[key] })).sort((a, b) => b.score - a.score);

  return (
    <div>
      <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
        {categories.map(({ key, score }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3">
            <span className="text-[17px]" aria-hidden="true">
              {ICON[key]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-faint)]">{LABEL[key]}</div>
              <div className="text-[14.5px] font-medium text-[var(--color-ink)]">{qualityLabelFor(score)}</div>
            </div>
            <span className="shrink-0 tabular text-[12px] text-[var(--color-ink-faint)]">{score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--color-surface-2)] px-4 py-3">
        <span className="text-[12.5px] font-medium text-[var(--color-ink)]">Overall performance</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13.5px] font-semibold text-[var(--color-accent)]">{qualityLabelFor(scores.overall)}</span>
          <span className="tabular text-[11.5px] text-[var(--color-ink-faint)]">{scores.overall.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}
