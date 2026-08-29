import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * COLLAPSIBLE SECTION — a small, generic disclosure primitive
 * ==========================================================================
 * See docs/MOBILE_EXPERIENCE_AUDIT.md Priority 3/5. Built for Match
 * Centre's Squad Performance (a full Starting XI + substitutes, for both
 * teams, was making the mobile page ~4,600px tall) but deliberately knows
 * nothing about squads, players, or football — it only knows "a label, an
 * optional count, and some children to reveal". That's the genuine
 * repeated shape worth extracting now (Best XI's bench, Player
 * Comparison's fuller breakdowns will need the exact same "collapsed by
 * default, expand for the rest" interaction) — the audit's own explicit
 * instruction was not to prematurely abstract beyond a real repeated
 * pattern, so this stays intentionally narrow rather than growing into a
 * generic "list of players" component.
 *
 * Uses the native <details>/<summary> element rather than useState:
 * expand/collapse works with zero JavaScript (keyboard and screen-reader
 * semantics come for free), there is no server/client hydration mismatch
 * to worry about (the `open` attribute is either present or it isn't,
 * identically on both), and it matches the same native-first instinct
 * already used elsewhere in this app.
 */
export function CollapsibleSection({
  label,
  count,
  defaultOpen = false,
  children,
  className,
}: {
  label: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={`group ${className ?? ""}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)] [&::-webkit-details-marker]:hidden">
        <span>
          {label}
          {count != null && ` (${count})`}
        </span>
        <ChevronDown size={15} strokeWidth={2.5} className="shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}
