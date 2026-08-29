import { qualityLabelFor } from "@/lib/analytics/scoring/types";
import type { StrengthArea } from "@/lib/analytics/intelligence/types";

type CategoryKey = "attack" | "creation" | "defence" | "impact";

const ICON: Record<CategoryKey, string> = { attack: "⚡", creation: "🎨", defence: "🧱", impact: "💥" };
const LABEL: Record<CategoryKey, string> = {
  attack: "Attacking output",
  creation: "Chance creation",
  defence: "Defensive contribution",
  impact: "Overall match impact",
};

/**
 * PERFORMANCE PROFILE — the single, canonical place the four category
 * scores are shown. Rows are ranked strongest-first so the ordering
 * itself carries meaning, the qualitative label ("Very good", "Good"...)
 * is the primary read, and the raw 0–10 score is kept small and
 * secondary. No bars, no meters — the ranking + words do the work a bar
 * chart would otherwise do.
 *
 * `strengths`/`developmentAreas` (optional — the exact, unchanged
 * `detectStrengths` output, confidence-gated the same way as everywhere
 * else) tag the matching rows inline as "Strongest area"/"Area to
 * watch". This used to be its own separate headline (Team Overview) AND
 * its own separate full-list card (What's Working/Areas to Watch) — both
 * were describing these same four numbers a second and third time. See
 * docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md Part 3.
 */
export function TeamPerformanceProfile({
  scores,
  strengths = [],
  developmentAreas = [],
}: {
  scores: { attack: number; creation: number; defence: number; impact: number; overall: number };
  strengths?: StrengthArea[];
  developmentAreas?: StrengthArea[];
}) {
  const strongestKey = strengths[0]?.key;
  const watchKey = developmentAreas[0]?.key;
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
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-faint)]">
                {LABEL[key]}
                {key === strongestKey && <span className="text-[var(--color-positive)]">· Strongest area</span>}
                {key === watchKey && key !== strongestKey && <span className="text-[var(--color-attention)]">· Area to watch</span>}
              </div>
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
