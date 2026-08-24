/**
 * Match Rating is deliberately styled in the "info" (cyan) accent rather
 * than the brand lime used for season Performance throughout the rest of
 * the app — colour, not just a label, keeps "this match only" visually
 * distinct from "this season" at a glance. See
 * docs/MATCH_CENTRE_DATA_AUDIT.md §4.
 */
export function MatchRatingBadge({
  rating,
  size = "md",
}: {
  rating: { score: number; label: string; lowMinutes: boolean } | null;
  size?: "sm" | "md";
}) {
  if (!rating) {
    return (
      <span className="text-[11.5px] text-[var(--color-ink-faint)]" title="Fewer than 45 minutes played — not enough to rate.">
        Limited minutes
      </span>
    );
  }

  const scoreSize = size === "md" ? "text-[20px]" : "text-[14px]";

  return (
    <span className="inline-flex flex-col items-end">
      <span className={`font-display ${scoreSize} font-semibold leading-none tabular text-[var(--color-info)]`}>
        {rating.score.toFixed(1)}
      </span>
      <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">
        {rating.label}
        {rating.lowMinutes && (
          <span title="Played fewer than 60 minutes — rating based on limited time on the pitch.">
            {" "}
            · brief
          </span>
        )}
      </span>
    </span>
  );
}
