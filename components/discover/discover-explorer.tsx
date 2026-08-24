"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DISCOVER_CATEGORIES, type DiscoverCategoryDef, type DiscoverCategoryKey } from "@/lib/discover/categories";
import type { DiscoverEntry } from "@/lib/analytics/scoring/repository";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { PlayerIdentity } from "@/components/identity/player-identity";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "@/components/personalisation/personalisation-provider";

type ExplorerKey = DiscoverCategoryKey | "personal";
type ExplorerCategoryDef = Omit<DiscoverCategoryDef, "key"> & { key: ExplorerKey };

/**
 * The full /discover page: pick a football question, reveal the answer as
 * a card grid — deliberately not a dense statistical table (that's what
 * the homepage's Top Performers already does). Mirrors the tab-switching
 * interaction TopPerformers already uses (components/home/top-performers.tsx)
 * rather than inventing a new pattern.
 *
 * `players` is the full ranked list (already fetched by the page for the
 * `creators`/`defenders` categories) — reused here, with no new analytics,
 * to build one modest personalised entry point when the user follows a team
 * (Personalisation Foundation, phase 5): "Because you follow Arsenal", the
 * same team's players sorted by their existing Performance score. Nothing
 * more sophisticated than that — see the module comment in
 * lib/preferences/store.ts for why this stays deliberately small.
 */
export function DiscoverExplorer({
  categories,
  players,
}: {
  categories: Record<DiscoverCategoryKey, DiscoverEntry[]>;
  players: RankedPlayer[];
}) {
  const preferences = usePreferences();
  const { teams } = useDirectory();
  const favouriteTeam = teams.find((t) => t.id === preferences.supportedClubId);

  const personalDef: ExplorerCategoryDef | null = useMemo(
    () =>
      favouriteTeam
        ? {
            key: "personal",
            icon: "❤️",
            title: `Because you follow ${favouriteTeam.shortName}`,
            question: `How's ${favouriteTeam.shortName} doing this season?`,
            description: `${favouriteTeam.name}'s players, by season Performance.`,
            tint: "var(--color-accent)",
          }
        : null,
    [favouriteTeam]
  );

  const personalEntries: DiscoverEntry[] = useMemo(() => {
    if (!favouriteTeam) return [];
    return [...players]
      .filter((p) => p.teamShortName === favouriteTeam.shortName)
      .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
      .slice(0, 9)
      .map((player) => ({ player, indicator: `${(player.scores.overall ?? 0).toFixed(1)}` }));
  }, [players, favouriteTeam]);

  const allDefs: ExplorerCategoryDef[] = personalDef ? [personalDef, ...DISCOVER_CATEGORIES] : DISCOVER_CATEGORIES;
  const allEntries: Record<ExplorerKey, DiscoverEntry[]> = { ...categories, personal: personalEntries };

  const withData = allDefs.filter((c) => allEntries[c.key as ExplorerKey].length > 0);
  const [active, setActive] = useState<ExplorerKey | null>(withData[0]?.key ?? null);
  const activeDef = allDefs.find((c) => c.key === active);
  const entries = active ? allEntries[active] : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-14 sm:px-8">
      <div
        data-hero
        className="relative -mx-5 overflow-hidden rounded-b-xl bg-[var(--hero-bg)] px-5 pt-8 pb-8 sm:-mx-8 sm:rounded-xl sm:px-8 sm:pt-10"
      >
        <div
          className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        <p className="relative text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-accent)]">
          Premier League · Discover
        </p>
        <h1 className="relative mt-2 font-display text-[32px] font-semibold leading-none tracking-tight text-[var(--hero-ink)] sm:text-[40px]">
          Find something interesting.
        </h1>
        <p className="relative mt-3 max-w-md text-[14px] leading-relaxed text-[var(--hero-ink-soft)]">
          Explore the season through the stories the data tells — pick a question below.
        </p>
      </div>

      {withData.length === 0 ? (
        <div className="mt-8 rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-10 text-center text-[14px] text-[var(--color-ink-faint)]">
          Not enough data yet to surface any storylines — check back after a few more matches.
        </div>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {withData.map((c) => {
              const isActive = active === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setActive(c.key)}
                  aria-pressed={isActive}
                  className="group rounded-xl border px-4 py-4 text-left transition-all"
                  style={{
                    borderColor: isActive ? c.tint : "var(--color-border)",
                    backgroundColor: isActive ? `color-mix(in srgb, ${c.tint} 10%, transparent)` : "var(--color-surface)",
                  }}
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `color-mix(in srgb, ${c.tint} 18%, transparent)` }}
                    aria-hidden="true"
                  >
                    {c.icon}
                  </span>
                  <div className="mt-2.5 text-[13.5px] font-semibold text-[var(--color-ink)]">{c.title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-ink-faint)]">{c.question}</div>
                </button>
              );
            })}
          </div>

          {activeDef && (
            <section className="mt-9">
              <div className="mb-4 flex items-start gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{ backgroundColor: `color-mix(in srgb, ${activeDef.tint} 16%, transparent)` }}
                  aria-hidden="true"
                >
                  {activeDef.icon}
                </span>
                <div>
                  <h2 className="font-display text-[19px] font-semibold tracking-tight text-[var(--color-ink)]">
                    {activeDef.title}
                  </h2>
                  <p className="text-[13px] text-[var(--color-ink-faint)]">{activeDef.description}</p>
                </div>
              </div>

              {entries.length === 0 ? (
                <p className="text-[13.5px] text-[var(--color-ink-faint)]">
                  Nothing clears the bar for this one yet — check back after a few more matches.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {entries.map((entry) => (
                    <DiscoverCard key={entry.player.playerId} entry={entry} tint={activeDef.tint} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function DiscoverCard({ entry, tint }: { entry: DiscoverEntry; tint: string }) {
  const { player, indicator } = entry;
  return (
    <Link
      href={`/players/${player.slug}`}
      className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-2)]"
      style={{ borderLeftColor: tint, borderLeftWidth: 3 }}
    >
      <PlayerIdentity
        photoUrl={player.photoUrl}
        name={player.name}
        crestUrl={player.teamCrestUrl}
        teamShortName={player.teamShortName}
        nationality={player.nationality}
        nationalityCode={player.nationalityCode}
        size="md"
        subtitle={`${player.teamShortName} · ${POSITION_LABEL[player.position]}`}
      />
      <span className="shrink-0 text-[12.5px] font-semibold text-[var(--color-ink-soft)] group-hover:text-[var(--color-ink)]">
        {indicator}
      </span>
    </Link>
  );
}
