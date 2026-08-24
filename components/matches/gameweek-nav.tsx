import Link from "next/link";

export function GameweekNav({
  current,
  min,
  max,
}: {
  current: number;
  min: number;
  max: number;
}) {
  const prev = current > min ? current - 1 : null;
  const next = current < max ? current + 1 : null;

  return (
    <div className="relative mt-6 flex items-center justify-between gap-3">
      {prev ? (
        <Link
          href={`/matches/${prev}`}
          className="text-[13px] font-medium text-[var(--hero-ink-soft)] hover:text-[var(--hero-ink)]"
        >
          ← Gameweek {prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="font-display text-[15px] font-semibold text-[var(--hero-ink)]">
        Gameweek {current}
      </span>
      {next ? (
        <Link
          href={`/matches/${next}`}
          className="text-[13px] font-medium text-[var(--hero-ink-soft)] hover:text-[var(--hero-ink)]"
        >
          Gameweek {next} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
