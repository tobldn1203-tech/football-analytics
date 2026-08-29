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
 * The homepage's centrepiece: a dark editorial masthead (kicker, headline,
 * category navigation) flowing into a light, highly scannable ranking
 * table that visually "docks" onto it. The dark band is a fixed brand
 * surface (see globals.css) — it doesn't invert with system dark mode,
 * the same way a newspaper's banner doesn't change with the reader's
 * settings.
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
    <section>
      <div data-hero className="relative overflow-hidden rounded-t-xl bg-[var(--hero-bg)] px-5 pb-0 pt-8 sm:px-8 sm:pt-10">
        {/* subtle radial glow — depth without a loud gradient */}
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />

        <p className="relative text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-accent)]">
          Premier League · 2026/27
        </p>
        <h1 className="relative mt-2 font-display text-[32px] font-semibold leading-none tracking-tight text-[var(--hero-ink)] sm:text-[40px]">
          Top Performers
        </h1>
        <p className="relative mt-3 max-w-md text-[14px] leading-relaxed text-[var(--hero-ink-soft)]">
          Who&rsquo;s performing at the highest level this season.
        </p>

        <CategoryTabs active={active} onChange={setActive} />
      </div>

      <div className="rounded-b-xl border border-t-0 border-[var(--color-border)] bg-[var(--color-surface)] px-3 pt-4 sm:px-8">
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
      className="relative mt-5 flex gap-1 overflow-x-auto py-1"
    >
      {/*
        MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md, "no visual affordance
        for horizontally-scrollable regions"): a soft edge fade hinting
        there's more to scroll to. Purely decorative (pointer-events-none),
        shown on narrow widths where this row is most likely to overflow.
      */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--hero-bg)] to-transparent sm:hidden"
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
              isActive ? "text-[var(--hero-ink)]" : "text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink-soft)]",
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
                <span className="hidden rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline">
                  Soon
                </span>
              </>
            )}
          </button>
        );
      })}
      <div className="absolute bottom-0 left-0 h-px w-full bg-[var(--hero-border)]" />
      {indicator && (
        <div
          className="absolute bottom-0 h-[2px] rounded-full bg-[var(--hero-accent)] transition-all duration-300 ease-out"
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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[11.5px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
            <th className="w-8 py-2.5 pr-2 font-medium sm:pr-3">#</th>
            <th className="px-2 py-2.5 font-medium sm:px-3">Player</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Team</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Position</th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">Performance</th>
            <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Form</th>
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
                          <span className="text-[12px] text-[var(--color-ink-faint)] sm:hidden">
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
