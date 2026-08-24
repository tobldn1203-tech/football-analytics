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

      <div className="rounded-b-xl border border-t-0 border-[var(--color-border)] bg-[var(--color-surface)] px-5 pt-4 sm:px-8">
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
            onClick={() => c.available && onChange(c.key)}
            disabled={!c.available}
            title={!c.available ? c.unavailableReason : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              isActive ? "text-[var(--hero-ink)]" : "text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink-soft)]",
              !c.available && "cursor-not-allowed opacity-50"
            )}
          >
            <Icon size={14} strokeWidth={2} aria-hidden="true" />
            {c.label}
            {!c.available && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                Soon
              </span>
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
            <th className="w-8 py-2.5 pr-3 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">Player</th>
            <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Team</th>
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">Position</th>
            <th className="px-3 py-2.5 text-right font-medium">Performance</th>
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
                  <td className="border-l-[3px] border-transparent py-2.5 pr-3 pl-2 tabular text-[var(--color-ink-faint)] transition-colors group-hover:[border-left-color:var(--row-accent)]">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="inline-flex shrink-0 transition-transform duration-200 group-hover:scale-[1.08]">
                        <PlayerAvatar
                          photoUrl={p.photoUrl}
                          name={p.name}
                          teamShortName={p.teamShortName}
                          size="md"
                        />
                      </span>
                      <span className="flex flex-col">
                        <Link
                          href={`/players/${p.slug}`}
                          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                        >
                          {p.name}
                        </Link>
                        <span className="text-[12px] text-[var(--color-ink-faint)] sm:hidden">
                          {p.teamShortName} · {POSITION_LABEL[p.position]}
                        </span>
                      </span>
                      {p.sample.confidence !== "established" && (
                        <span
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
                      size="sm"
                      showFullName={false}
                    />
                  </td>
                  <td className="hidden px-3 py-2.5 text-[var(--color-ink-soft)] md:table-cell">
                    {POSITION_LABEL[p.position]}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.playerId)}
                      className="group/score inline-flex flex-col items-end rounded-sm focus-visible:outline-offset-4"
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
