/**
 * Lets the user always see (and eventually change) which competition and
 * season they're looking at. Only one option in each menu resolves today —
 * the rest are visibly present but disabled, so the affordance is already
 * in place for Champions League / multi-season support later without a
 * navigation rework.
 */
export function CompetitionSeasonSwitcher({ seasonLabel }: { seasonLabel: string | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <SwitcherMenu
        label="Premier League"
        options={[
          { label: "Premier League", active: true },
          { label: "Champions League", active: false },
        ]}
      />
      <span className="text-[var(--color-border-strong)]">·</span>
      <SwitcherMenu
        label={seasonLabel ?? "—"}
        options={[
          { label: seasonLabel ?? "Current season", active: true },
          { label: "Earlier seasons", active: false },
        ]}
      />
    </div>
  );
}

function SwitcherMenu({
  label,
  options,
}: {
  label: string;
  options: Array<{ label: string; active: boolean }>;
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm px-1.5 py-1 text-[12.5px] font-medium text-[var(--color-ink-faint)] marker:content-none hover:text-[var(--color-ink)]">
        {label}
        <svg width="8" height="8" viewBox="0 0 8 8" className="mt-px opacity-70">
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </summary>
      <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-sm">
        {options.map((opt) => (
          <div
            key={opt.label}
            className={
              opt.active
                ? "px-3 py-1.5 text-[13px] font-medium text-[var(--color-ink)]"
                : "flex items-center justify-between px-3 py-1.5 text-[13px] text-[var(--color-ink-faint)]"
            }
          >
            {opt.label}
            {!opt.active && (
              <span className="ml-2 rounded-full bg-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                Soon
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
