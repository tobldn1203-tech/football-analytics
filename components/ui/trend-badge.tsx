import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TrendDirection } from "@/lib/analytics/scoring/trend";

const CONFIG: Record<TrendDirection, { Icon: typeof TrendingUp; color: string; bg: string }> = {
  up: { Icon: TrendingUp, color: "var(--color-positive)", bg: "var(--color-positive-soft)" },
  down: { Icon: TrendingDown, color: "var(--color-negative)", bg: "var(--color-negative-soft)" },
  steady: { Icon: Minus, color: "var(--color-ink-faint)", bg: "var(--color-surface-2)" },
};

export function TrendBadge({ direction, label }: { direction: TrendDirection; label: string }) {
  const { Icon, color, bg } = CONFIG[direction];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium"
      style={{ color, backgroundColor: bg }}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}
