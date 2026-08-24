import type { StrengthArea } from "@/lib/analytics/intelligence/types";

/**
 * TEAM OVERVIEW — the interpretation, made the hero. The team's category
 * scores are still real numbers (see TeamPerformanceProfile, further down
 * the page), but the page now OPENS with the deterministic Team Story
 * paragraph (lib/analytics/story/teamStory.ts) plus a single-line
 * "strongest area / area to watch" headline — pulled from the exact same
 * detectStrengths() output teamRepository.ts already computes. No new
 * analysis here, just leading with the interpretation instead of the
 * numbers.
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

      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-positive)]">Strongest area</div>
          <div className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{strongest ? strongest.label : "Too early to call"}</div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-attention)]">Area to watch</div>
          <div className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{watch ? watch.label : "Nothing flagged right now"}</div>
        </div>
      </div>
    </section>
  );
}
