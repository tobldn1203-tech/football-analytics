/**
 * TEAM OVERVIEW — the interpretation, made the hero. Just the
 * deterministic Team Story paragraph (lib/analytics/story/teamStory.ts)
 * now — no separate "strongest area / area to watch" headline. That
 * headline was a preview of the exact same `strengths`/`developmentAreas`
 * arrays that TeamPerformanceProfile's ranked list already shows in full,
 * a few hundred pixels below — see
 * docs/PLAYER_TEAM_INFORMATION_DENSITY_AUDIT.md Part 3. The ranked list
 * now carries that same "strongest"/"area to watch" framing directly on
 * its own top/bottom rows instead of restating it here first.
 */
export function TeamOverview({ story }: { story: string }) {
  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-6 sm:px-7 sm:py-7">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">Team Overview</span>
      <p className="mt-2 text-[15.5px] leading-relaxed text-[var(--color-ink)] sm:text-[16.5px]">{story}</p>
    </section>
  );
}
