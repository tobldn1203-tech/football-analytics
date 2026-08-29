import type { StrengthArea } from "@/lib/analytics/intelligence/types";

/**
 * TEAM OVERVIEW — the interpretation, made the hero. The deterministic
 * Team Story paragraph (lib/analytics/story/teamStory.ts) already
 * narrates the team's strongest area in prose once there's enough
 * confidence to say so — this section adds only ONE small supporting
 * line beneath it for "what's working / what isn't" (the one thing the
 * prose doesn't cover: development areas), reusing the exact same
 * `strengths`/`developmentAreas` `detectStrengths` already computed.
 *
 * Deliberately not a second card or a ranked list — see
 * docs/TEAM_NAVIGATION_AND_PLAYER_DRIVERS_REFINEMENT.md: the standalone
 * "Performance Profile" section this used to point to has been removed
 * entirely, and the brief was explicit not to compensate for that by
 * adding a new section back. This is one quiet line, not a replacement.
 */
export function TeamOverview({
  story,
  strengths,
  developmentAreas,
}: {
  story: string;
  strengths: StrengthArea[];
  developmentAreas: StrengthArea[];
}) {
  const strongest = strengths[0];
  const watch = developmentAreas[0];

  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 sm:px-7 sm:py-7">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">Team Overview</span>
      <p className="mt-2 text-[15.5px] leading-relaxed text-[var(--color-ink)] sm:text-[16.5px]">{story}</p>
      {(strongest || watch) && (
        <p className="mt-3 text-[12.5px] text-[var(--color-ink-faint)]">
          {strongest && (
            <>
              Strongest area: <span className="font-medium text-[var(--color-positive)]">{strongest.label}</span>
            </>
          )}
          {strongest && watch && " · "}
          {watch && (
            <>
              Area to watch: <span className="font-medium text-[var(--color-attention)]">{watch.label}</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}
