import type { LucideIcon } from "lucide-react";
import { qualityLabelFor } from "@/lib/analytics/scoring/types";

export function CategoryBar({
  label,
  icon: Icon,
  score,
  soon,
}: {
  label: string;
  icon: LucideIcon;
  score?: number;
  soon?: boolean;
}) {
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-ink)]">
          <Icon size={14} strokeWidth={2} className="text-[var(--color-ink-faint)]" aria-hidden="true" />
          {label}
        </span>
        {soon ? (
          <span className="text-[12px] text-[var(--color-ink-faint)]">Coming soon</span>
        ) : (
          <span className="flex items-baseline gap-2">
            <span className="text-[12px] text-[var(--color-ink-faint)]">
              {qualityLabelFor(score ?? 0)}
            </span>
            <span className="tabular text-[14px] font-semibold text-[var(--color-ink)]">
              {(score ?? 0).toFixed(1)}
            </span>
          </span>
        )}
      </div>
      {!soon && (
        <div className="h-[5px] overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full origin-left rounded-full bg-[var(--color-accent)] motion-safe:animate-[grow-bar_0.6s_ease-out]"
            style={{ width: `${Math.max(2, Math.min(100, (score ?? 0) * 10))}%` }}
          />
        </div>
      )}
    </div>
  );
}
