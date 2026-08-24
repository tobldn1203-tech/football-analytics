export const metadata = { title: "Methodology · Premier League Analytics" };

export default function MethodologyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--color-accent)]">
        Level 3 · For analytics users
      </p>
      <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight">
        How scores are calculated
      </h1>

      <div className="mt-6 space-y-5 text-[14.5px] leading-relaxed text-[var(--color-ink-soft)]">
        <p>
          This is a <strong className="text-[var(--color-ink)]">provisional</strong> scoring
          model, not the finished analytics engine. It exists to show the product direction
          using real data while the full, database-backed engine is built.
        </p>

        <section>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Data</h2>
          <p className="mt-1.5">
            Every number comes from the Fantasy Premier League public API, refreshed hourly.
            No statistic on this page is invented or estimated.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Method</h2>
          <p className="mt-1.5">
            <strong className="text-[var(--color-ink)]">Attack, Creation, Impact and Form</strong>{" "}
            rank every player league-wide, because those statistics mean the same thing regardless
            of position — a goal is a goal. That&apos;s deliberate: a standalone &quot;who has the
            best goal threat right now&quot; list should surface forwards and wingers, not a
            defender who happens to have scored the only goal among defenders.
          </p>
          <p className="mt-1.5">
            <strong className="text-[var(--color-ink)]">Defence</strong> is compared only within
            position, because what &quot;good defensively&quot; means genuinely differs by role —
            a goalkeeper&apos;s saves, a centre-back&apos;s tackles, and a winger&apos;s work-rate
            aren&apos;t the same metric.
          </p>
          <p className="mt-1.5">
            <strong className="text-[var(--color-ink)]">Overall</strong> blends the league-wide
            categories with position-relative Defence, weighted differently per position — a
            forward&apos;s overall score leans on attack; a defender&apos;s leans on defence.
            Those weights are a stated starting hypothesis, not a validated result, and will
            change as the model is tested against what actually happens on the pitch.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
            Performance Intelligence
          </h2>
          <p className="mt-1.5">
            Above the category scores sits an intelligence layer that turns those numbers into
            football language. It doesn&apos;t compute anything new about a match — it interprets
            what the scoring engine already produced. Six concepts:
          </p>

          <ul className="mt-3 space-y-3">
            <li>
              <strong className="text-[var(--color-ink)]">Performance</strong> — how good the
              player has been this season. This is the Overall score above, unchanged.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Form</strong> — how good they&apos;ve
              been <em>recently</em>. A weighted average of their last five matches (most recent
              match weighted highest, decaying by 20 percentage points each match back), ranked
              league-wide the same way Performance is. Form and Performance are deliberately
              allowed to disagree — a player can be &quot;8.2 Performance, 9.1 Form&quot; or the
              reverse, and both numbers are shown rather than blended into one.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Impact</strong> — how much the player
              has influenced matches, using FPL&apos;s own match-contribution score (bonus points
              system) as a single proxy spanning goals, defensive actions, and other
              bonus-worthy moments. A genuinely position-specific breakdown (e.g. shot-stopping
              vs. distribution for goalkeepers, or ball progression for defenders) isn&apos;t
              built yet — we don&apos;t have reliable data for it. See &quot;What&apos;s
              intentionally missing&quot; below.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Consistency</strong> — how reliably a
              player performs around their <em>own</em> normal level, not against the league.
              A player who is steadily average every week scores highly here despite a modest
              Performance score; a player who is brilliant one week and anonymous the next scores
              low here despite moments of brilliance. The two numbers are reported side by side
              on purpose — &quot;strong performer, high consistency&quot; and &quot;strong
              performer, low consistency&quot; are meaningfully different profiles.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Momentum</strong> — whether recent form
              is rising, stable, or falling, by comparing a player&apos;s last three qualifying
              matches against their own season average. Needs at least four matches to say
              anything at all; with fewer, it honestly reports &quot;not enough matches yet&quot;
              rather than guessing.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Confidence</strong> — Limited /
              Developing / Established, based on matches played. Every metric above is shown
              alongside this, because a conclusion from one match should never look as certain as
              one from twelve.
            </li>
          </ul>

          <details className="mt-3 rounded-sm border border-[var(--color-border)] px-3.5 py-3">
            <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-ink)]">
              Advanced: exact formulas and thresholds
            </summary>
            <div className="mt-2.5 space-y-2 text-[13px] leading-relaxed">
              <p>
                <strong className="text-[var(--color-ink)]">Form</strong>: per-90 <code>bps</code>{" "}
                over the last 5 matches, weights [1, 0.8, 0.6, 0.4, 0.2] applied to both the
                numerator and the minutes denominator, then league-wide percentile-ranked exactly
                like Impact.
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">Consistency</strong>: coefficient of
                variation (population standard deviation ÷ mean) of per-90 <code>bps</code> across
                qualifying matches (≥20 minutes played, minimum 3 qualifying matches). Mapped to
                0–10 via <code>10 − CV × 10</code>, clamped. Bands: ≥8 High consistency, ≥6
                Consistent, ≥4 Variable, else Highly variable.
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">Momentum</strong>: average per-90{" "}
                <code>bps</code> over the last 3 qualifying matches minus the season-long average
                per-90 <code>bps</code> across all qualifying matches. Rising/Falling requires the
                difference to exceed <code>max(3, baseline × 0.25)</code> — a fixed floor plus a
                relative threshold, so the bar doesn&apos;t get trivially easy for high-output
                players or trivially hard for low-output ones. Needs ≥4 qualifying matches.
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">Confidence</strong>: fewer than 3
                matches → Limited; fewer than 8 → Developing; 8+ → Established. Development-area
                callouts (a category clearly below the player&apos;s own level) are suppressed
                entirely at Limited confidence — a small sample should never produce a confident
                negative conclusion.
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">Form&apos;s categorical bands</strong>{" "}
                are deliberately wider than Performance&apos;s: Elite ≥9.0, Excellent ≥7.5, Strong
                ≥6.0, Solid ≥4.5, Below Average ≥2.5, Poor below that — sensible round numbers, not
                a statistical fit.
              </p>
            </div>
          </details>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
            What&apos;s intentionally missing
          </h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-[var(--color-ink)]">Progression</strong> — no confirmed
              free data source currently provides progressive passing/carrying data.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Minute-level Key Moments</strong> — the
              data available gives match-level performance, not a minute-by-minute event log
              with match-state context, so in-match narrative moments aren&apos;t built yet.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Position-specific Impact</strong> — the
              long-term goal is a breakdown by role (shot-stopping and distribution for
              goalkeepers; progression and prevention for defenders; and so on). Today Impact is
              one league-wide proxy (match-contribution score) for every position, because that&apos;s
              what the data reliably supports.
            </li>
            <li>
              <strong className="text-[var(--color-ink)]">Player archetypes</strong> (e.g.
              &quot;Progressive Defender&quot;, &quot;Chance Creator&quot;) — the underlying
              category scores are structured to support this eventually, but no archetype
              classification is built yet.
            </li>
          </ul>
          <p className="mt-1.5">
            Full detail on every source investigated is documented in the project&apos;s data
            source assessment.
          </p>
        </section>

        <section>
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Sample size</h2>
          <p className="mt-1.5">
            Early in the season, scores are based on very few matches and should be read with
            that in mind — the sample size is shown wherever rankings are displayed.
          </p>
        </section>
      </div>
    </main>
  );
}
