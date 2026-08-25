import type { PlayerAvailability } from "@/lib/analytics/availability/types";

/**
 * The player page's only availability UI — a single, compact line, never a
 * card or panel. See docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §4/§5.
 * Renders nothing when `availability` is null — that's the deliberate
 * "available" and "no information" case, not an oversight (an explicit
 * "Available" badge for every player was ruled out by design, see docs
 * §5 "Visibility rule").
 */
export function PlayerAvailabilityLine({ availability }: { availability: PlayerAvailability | null }) {
  if (!availability) return null;

  const { label, detail, chanceOfPlayingNextRound, state } = availability;

  // FPL's own note is already specific enough on its own for suspensions
  // ("Suspended until 19 Sep") — repeating the word "Suspended" ahead of
  // it would just be noise. For every other case the note doesn't restate
  // the label, so both are shown together.
  const detailRepeatsLabel = detail != null && detail.toLowerCase().startsWith(label.toLowerCase());

  const text = detail
    ? detailRepeatsLabel
      ? detail
      : `${label} — ${detail}`
    : state === "doubtful" && chanceOfPlayingNextRound != null
      ? `${label} — ${chanceOfPlayingNextRound}% chance of playing next match`
      : label;

  return (
    <p className="relative mt-2.5 flex items-center gap-1.5 text-[12.5px] text-[var(--hero-ink-soft)]">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--hero-attention)" }}
        aria-hidden="true"
      />
      <span>
        <span className="font-medium text-[var(--hero-ink)]">Availability: </span>
        {text}
      </span>
    </p>
  );
}
