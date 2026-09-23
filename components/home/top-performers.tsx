"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { RankedPlayer, Category } from "@/lib/analytics/scoring/types";
import { qualityLabelFor, confidenceTone } from "@/lib/analytics/scoring/types";
import { CATEGORY_DEFINITIONS } from "@/lib/analytics/scoring/categories";
import { directionFromScoreDelta } from "@/lib/analytics/scoring/trend";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamIdentity } from "@/components/identity/team-identity";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { CATEGORY_ICON } from "@/components/ui/category-icons";
import { WhyPanel } from "./why-panel";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * FULL RANKINGS — the scannable table underneath the homepage's League
 * Leaders hero (components/home/league-leaders-hero.tsx). This component
 * used to carry its own dark editorial masthead (kicker/headline/glow) —
 * that masthead is retired; League Leaders is now that moment. Everything
 * below this comment (category navigation, the ranking table, the expand-
 * in-place "why" panel) is the exact same logic and data as before,
 * restyled from the fixed-dark `--hero-*` tokens onto the normal
 * theme-aware `--color-*` surface, since this section is no longer inside
 * a masthead — see docs/VISUAL_UX_REIMAGINATION.md.
 */
export function TopPerformers({
  players,
  sampleNote,
}: {
  players: RankedPlayer[];
  sampleNote: string;
}) {
  const [active, setActive] = useState<Category>("overall");
  const definition = CATEGORY_DEFINITIONS.find((c) => c.key === active)!;

  const ranked = useMemo(() => {
    if (!definition.available) return [];
    return [...players]
      .sort((a, b) => (b.scores[active] ?? 0) - (a.scores[active] ?? 0))
      .slice(0, 15);
  }, [players, active, definition.available]);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 pt-5 pb-5 sm:px-8 sm:pb-7">
      <div className="px-2 sm:px-0">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          Full rankings
        </h2>
        <CategoryTabs active={active} onChange={setActive} />
      </div>

      <div className="mt-4 px-2 sm:px-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[13.5px] text-[var(--color-ink-soft)]">{definition.description}</p>
          <p className="text-[12px] text-[var(--color-ink-faint)]">
            {sampleNote} · min. 45 minutes played
          </p>
        </div>

        {!definition.available ? (
          <div className="rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-10 text-center text-[14px] text-[var(--color-ink-faint)]">
            {definition.unavailableReason}
          </div>
        ) : (
          <PerformanceTable players={ranked} activeCategory={active} />
        )}
      </div>
    </section>
  );
}

function CategoryTabs({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  const tabRefs = useRef<Partial<Record<Category, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = tabRefs.current[active];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  return (
    <div
      role="tablist"
      aria-label="Performance category"
      className="relative mt-4 flex gap-1 overflow-x-auto py-1"
    >
      {/*
        MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md, "no visual affordance
        for horizontally-scrollable regions"): a soft edge fade hinting
        there's more to scroll to. Purely decorative (pointer-events-none),
        shown on narrow widths where this row is most likely to overflow.
      */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent sm:hidden"
        aria-hidden="true"
      />
      {CATEGORY_DEFINITIONS.map((c) => {
        const Icon = CATEGORY_ICON[c.key];
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            ref={(el) => {
              tabRefs.current[c.key] = el;
            }}
            role="tab"
            aria-selected={isActive}
            aria-label={c.label}
            onClick={() => c.available && onChange(c.key)}
            disabled={!c.available}
            title={!c.available ? c.unavailableReason : c.label}
            className={clsx(
              // MOBILE FIX: seven tabs at full icon+label width only ever
              // showed 2-3 before requiring a scroll a user had no strong
              // reason to attempt — see docs/MOBILE_EXPERIENCE_AUDIT.md.
              // Icon-only below `sm` fits every category on screen at
              // once (verified: all 7 visible with no scrolling needed at
              // realistic phone widths); the full icon+label version
              // returns unchanged at `sm` and up.
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 py-2 text-[13.5px] font-medium transition-colors sm:px-3 sm:py-2.5",
              isActive ? "text-[var(--color-ink)]" : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink-soft)]",
              !c.available && "cursor-not-allowed opacity-50"
            )}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" className="sm:hidden" />
            <Icon size={14} strokeWidth={2} aria-hidden="true" className="hidden sm:block" />
            <span className="hidden sm:inline">{c.label}</span>
            {!c.available && (
              <>
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-current sm:hidden"
                  aria-hidden="true"
                />
                <span className="hidden rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline">
                  Soon
                </span>
              </>
            )}
          </button>
        );
      })}
      <div className="absolute bottom-0 left-0 h-px w-full bg-[var(--color-border)]" />
      {indicator && (
        <div
          className="absolute bottom-0 h-[2px] rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
    </div>
  );
}

function PerformanceTable({
  players,
  activeCategory,
}: {
  players: RankedPlayer[];
  activeCategory: Category;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="relative overflow-x-auto">
      {/*
        MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #3): the same
        scroll-affordance fade as the category tabs above (CategoryTabs,
        this file) — defensive here since #1a already removes the overflow
        this table has today, but the wrapper stays genuinely scrollable
        for whatever doesn't fit a future category/name, and this row
        shouldn't be the one place in the file that hints at more content
        one way and not the other. `from-[var(--color-surface)]` matches
        this table's own background (the hero strip above uses
        `--hero-bg]` instead — see CategoryTabs).
      */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent sm:hidden"
        aria-hidden="true"
      />
      {/*
        MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #1a): below
        `sm`, only #/Player/Performance render (Team/Position/Form are
        `hidden` until `sm`/`md`) — but `table-layout: auto`'s column-width
        algorithm was still sizing the Player column off its own content's
        theoretical no-wrap width, which routinely exceeded what was left
        over for Performance and clipped its quality label ("EXCELLE"
        instead of "EXCELLENT") by 8-23px, measured, with no scroll
        affordance hinting the rest was reachable. `table-fixed` makes the
        two visible content columns' widths an explicit, real budget
        instead of a content-derived guess, so Performance always gets the
        room its own content needs. `sm:table-auto` on both the table and
        each width below hands the layout straight back to today's
        unconstrained desktop behaviour — verified unchanged at 1280px.
      */}
      <table className="w-full table-fixed border-collapse text-[14px] sm:table-auto">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[11.5px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
            <th className="w-8 py-2.5 pr-2 font-medium sm:pr-3">#</th>
            <th className="w-[60%] px-2 py-2.5 font-medium sm:w-auto sm:px-3">Player</th>
            <th className="hidden w-0 px-3 py-2.5 font-medium sm:w-auto sm:table-cell">Team</th>
            <th className="hidden w-0 px-3 py-2.5 font-medium md:w-auto md:table-cell">Position</th>
            <th className="px-2 py-2.5 text-right font-medium sm:w-auto sm:px-3">
              {/*
                The DATA cells ("Excellent", "9.3") always fit this
                column's fixed mobile width — measured, the column
                HEADER's own uppercase, letter-spaced "Performance"
                (105px) was the actual thing still overflowing it (91px),
                one unbreakable word with nowhere to wrap. Same
                short-label-below-`sm` technique already used for "My
                Football" (components/personalisation/my-football-nav.tsx)
                and the category tabs above, not a new pattern.
              */}
              <span className="sm:hidden">Perf.</span>
              <span className="hidden sm:inline">Performance</span>
            </th>
            <th className="hidden w-0 px-3 py-2.5 text-right font-medium sm:w-auto sm:table-cell">Form</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const isExpanded = expandedId === p.playerId;
            const score = p.scores[activeCategory] ?? 0;
            const label = qualityLabelFor(score);
            const formDirection = directionFromScoreDelta(
              (p.scores.form ?? 0) - (p.scores.overall ?? 0)
            );
            return (
              <Fragment key={p.playerId}>
                <tr
                  className={clsx(
                    "group border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-2)]",
                    isExpanded && "bg-[var(--color-surface-2)]"
                  )}
                  style={{ ["--row-accent" as string]: getTeamColor(p.teamShortName) }}
                >
                  <td className="border-l-[3px] border-transparent py-2.5 pr-2 pl-2 tabular text-[var(--color-ink-faint)] transition-colors group-hover:[border-left-color:var(--row-accent)] sm:pr-3">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    <span className="inline-flex min-w-0 items-center gap-2.5">
                      {/*
                        MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md finding
                        #3): avatar and name used to look like one unit but
                        only the name text was actually a link — tapping
                        the photo did nothing. One Link now covers both,
                        with the name truncating (rather than the table
                        growing past the viewport) so a long name can never
                        push the Performance column off-screen — see
                        finding #2. No nested <a>: this replaces the old
                        avatar span + separate Link, it doesn't wrap one
                        inside the other.
                      */}
                      <Link href={`/players/${p.slug}`} className="group/player inline-flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex shrink-0 transition-transform duration-200 group-hover/player:scale-[1.08]">
                          <PlayerAvatar
                            photoUrl={p.photoUrl}
                            name={p.name}
                            teamShortName={p.teamShortName}
                            size="md"
                          />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--color-ink)] group-hover/player:text-[var(--color-accent)]">
                            <NationalityFlag code={p.nationalityCode} country={p.nationality} size="xs" />
                            <span className="max-w-[92px] truncate sm:max-w-none">{p.name}</span>
                          </span>
                          {/*
                            MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md
                            §4/§10 #1a): this line, not the capped name
                            above it, was the Player column's actual
                            width driver — "HUL · Goalkeeper" rendered on
                            one unconstrained line (95px, measured) is
                            wider than the name cap (92px), which pushed
                            the table's natural width 22-23px past the
                            viewport at 375-390px and clipped the
                            Performance column's own quality label on the
                            right. A max-width lets the longest position
                            words ("Goalkeeper"/"Midfielder") wrap onto a
                            second line instead of forcing the column
                            wider — same information, no truncation,
                            leaves sm:hidden (and therefore this whole
                            line) untouched at sm and up.
                          */}
                          <span className="block text-[12px] leading-snug text-[var(--color-ink-faint)] sm:hidden">
                            {p.teamShortName} · {POSITION_LABEL[p.position]}
                          </span>
                        </span>
                      </Link>
                      {p.sample.confidence !== "established" && (
                        <span
                          className="shrink-0"
                          style={{
                            color: `var(--color-${confidenceTone(p.sample.confidence)})`,
                          }}
                          title={`Small sample — ${p.sample.matches} match${p.sample.matches === 1 ? "" : "es"} played so far`}
                        >
                          ●
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <TeamIdentity
                      crestUrl={p.teamCrestUrl}
                      name={p.teamShortName}
                      shortName={p.teamShortName}
                      teamId={p.teamId}
                      size="sm"
                      showFullName={false}
                    />
                  </td>
                  <td className="hidden px-3 py-2.5 text-[var(--color-ink-soft)] md:table-cell">
                    {POSITION_LABEL[p.position]}
                  </td>
                  <td className="px-2 py-2.5 text-right sm:px-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.playerId)}
                      className="group/score inline-flex flex-col items-end rounded-sm py-1 focus-visible:outline-offset-4"
                      aria-expanded={isExpanded}
                    >
                      <span className="font-display tabular text-[18px] font-semibold leading-none text-[var(--color-ink)]">
                        {score.toFixed(1)}
                      </span>
                      <span className="mt-1 text-[10.5px] uppercase tracking-[0.06em] text-[var(--color-ink-faint)] group-hover/score:text-[var(--color-accent)] group-hover/score:underline">
                        {isExpanded ? "Hide" : label}
                      </span>
                    </button>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    <span className="flex items-center justify-end gap-1 tabular text-[var(--color-ink-soft)]">
                      <FormDirectionIcon direction={formDirection} />
                      {(p.scores.form ?? 0).toFixed(1)}
                    </span>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="animate-reveal border-b border-[var(--color-border)] bg-[var(--color-surface-2)] last:border-0">
                    <td colSpan={6}>
                      <WhyPanel player={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormDirectionIcon({ direction }: { direction: "up" | "down" | "steady" }) {
  if (direction === "up")
    return <TrendingUp size={13} strokeWidth={2.5} className="text-[var(--color-positive)]" aria-label="Trending up" />;
  if (direction === "down")
    return <TrendingDown size={13} strokeWidth={2.5} className="text-[var(--color-negative)]" aria-label="Trending down" />;
  return <Minus size={13} strokeWidth={2.5} className="text-[var(--color-ink-faint)]" aria-label="Steady" />;
}
