import type { PlayerAvailability } from "@/lib/analytics/availability/types";
import { formatAvailabilityContext } from "@/lib/analytics/availability/describe";

/**
 * The player page's only availability UI — a single, compact line, never a
 * card or panel. See docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §4/§5.
 * Renders nothing when `availability` is null — that's the deliberate
 * "available" and "no information" case, not an oversight (an explicit
 * "Available" badge for every player was ruled out by design, see docs
 * §5 "Visibility rule").
 *
 * Text comes from `formatAvailabilityContext` — the same shared formatter
 * Availability Watch uses (see docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md
 * Part 1) — so a player's own page and any club-level mention of them
 * always describe their situation identically, never two divergent phrasings.
 */
export function PlayerAvailabilityLine({ availability }: { availability: PlayerAvailability | null }) {
  if (!availability) return null;

  return (
    <p className="relative mt-2.5 flex items-center gap-1.5 text-[12.5px] text-[var(--hero-ink-soft)]">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--hero-attention)" }}
        aria-hidden="true"
      />
      <span>
        <span className="font-medium text-[var(--hero-ink)]">Availability: </span>
        {formatAvailabilityContext(availability)}
      </span>
    </p>
  );
}
