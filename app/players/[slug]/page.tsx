import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerProfile,
  intelligenceFromProfile,
  pickBestPerformances,
} from "@/lib/analytics/scoring/repository";
import { getPlayerAvailability } from "@/lib/analytics/availability/repository";
import { PlayerAvailabilityLine } from "@/components/players/availability-indicator";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import { qualityLabelFor, confidenceTone } from "@/lib/analytics/scoring/types";
import { explainPlayer } from "@/lib/analytics/scoring/explain";
import { buildSeasonStory } from "@/lib/analytics/story/seasonStory";
import { classifyArchetype } from "@/lib/analytics/archetypes/archetypes";
import { CategoryBar } from "@/components/ui/category-bar";
import { CATEGORY_ICON } from "@/components/ui/category-icons";
import { ComingSoonPanel } from "@/components/ui/coming-soon-panel";
import { TrendBadge } from "@/components/ui/trend-badge";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { TeamIdentity } from "@/components/identity/team-identity";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { MatchRatingBadge } from "@/components/matches/match-rating";
import { SeasonStory } from "@/components/players/season-story";
import { ArchetypeBadge, ArchetypeCard } from "@/components/players/archetype-card";

export const revalidate = 300;

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPlayerProfile(slug);
  if (!data) notFound();

  const { player, ranking, matches } = data;
  const chronological = [...matches].reverse(); // oldest first, for trend charts
  // Performance Journey — match ratings over the season, not raw bps (see
  // components/players/season-story.tsx). Matches without a rating (below
  // the ranking engine's minutes floor) are skipped rather than plotted as 0.
  const journeyPoints = chronological
    .filter((m) => m.matchRating)
    .map((m) => ({
      value: m.matchRating!.score,
      opponentShortName: m.opponentShortName,
      opponentCrestUrl: m.opponentCrestUrl,
      isHome: m.isHome,
    }));
  const best = pickBestPerformances(matches, 4);
  const explanation = ranking ? explainPlayer(ranking) : null;
  // The Performance Intelligence layer (lib/analytics/intelligence) — one
  // deterministic object powering Momentum, Consistency and the summary
  // sentence below. See docs/METHODOLOGY for the formulas.
  const intel = intelligenceFromProfile(data);
  const story = ranking && intel ? buildSeasonStory(ranking, intel, player.teamName) : null;
  const archetype = ranking ? classifyArchetype(ranking) : null;
  // Availability Intelligence — deliberately independent of `ranking`/
  // `intel` above: a player with no computed Performance score yet can
  // still have a meaningful availability status, and vice versa. See
  // docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md §5 for why this is not
  // gated by relevance on an individual player's own page.
  const availability = await getPlayerAvailability(player.id);

  const totals = matches.reduce(
    (acc, m) => ({
      minutes: acc.minutes + m.minutes,
      matches: acc.matches + (m.minutes > 0 ? 1 : 0),
      goals: acc.goals + m.goals,
      assists: acc.assists + m.assists,
      cleanSheets: acc.cleanSheets + (m.cleanSheet ? 1 : 0),
    }),
    { minutes: 0, matches: 0, goals: 0, assists: 0, cleanSheets: 0 }
  );

  const showCleanSheets = player.position === "GKP" || player.position === "DEF";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-12 sm:px-8">
      {/* Dark editorial header — a fixed masthead surface, see globals.css */}
      <div data-hero className="relative -mx-5 overflow-hidden rounded-b-xl bg-[var(--hero-bg)] px-5 pt-5 pb-7 sm:-mx-8 sm:rounded-xl sm:px-8 sm:pt-6">
        <div
          className="pointer-events-none absolute -top-20 left-1/3 h-56 w-56 rounded-full blur-3xl"
          style={{ background: "var(--hero-glow)" }}
          aria-hidden="true"
        />
        {/* A tighter spotlight behind the portrait, tinted with the
            player's own club colour — ties the imagery to the identity
            system without tinting the photo itself. */}
        <div
          className="pointer-events-none absolute top-2 left-2 h-40 w-40 rounded-full blur-3xl sm:top-0 sm:left-4"
          style={{ background: `color-mix(in srgb, ${getTeamColor(player.teamShortName)} 35%, transparent)` }}
          aria-hidden="true"
        />
        <Link
          href="/"
          className="relative text-[13px] text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink)]"
        >
          ← Top performers
        </Link>

        <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-5">
            <PlayerAvatar
              photoUrl={player.photoUrl}
              name={player.name}
              teamShortName={player.teamShortName}
              size="xl"
              glow
            />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate font-display text-[26px] font-semibold leading-tight tracking-tight text-[var(--hero-ink)] sm:text-[32px]">
                <NationalityFlag code={player.nationalityCode} country={player.nationality} size="md" />
                <span className="truncate">{player.name}</span>
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px] text-[var(--hero-ink-soft)]">
                <TeamIdentity
                  crestUrl={player.teamCrestUrl}
                  name={player.teamName}
                  shortName={player.teamShortName}
                  teamId={player.teamId}
                  size="sm"
                />
                <span>·</span>
                {POSITION_LABEL[player.position]}
              </div>
              {archetype && (
                <div className="mt-2.5">
                  <ArchetypeBadge archetype={archetype} />
                </div>
              )}
            </div>
          </div>

          {ranking && intel && (
            <div className="flex items-end gap-8">
              <div>
                <div className="font-display text-[42px] font-semibold leading-none tracking-tight text-[var(--hero-ink)] tabular">
                  {(ranking.scores.overall ?? 0).toFixed(1)}
                </div>
                <div className="mt-1.5 text-[12.5px] font-medium text-[var(--hero-accent)]">
                  {qualityLabelFor(ranking.scores.overall ?? 0)}
                </div>
              </div>
              <div className="flex flex-col items-start gap-1.5 pb-1">
                <TrendBadge
                  direction={
                    intel.momentum.direction === "RISING"
                      ? "up"
                      : intel.momentum.direction === "FALLING"
                        ? "down"
                        : "steady"
                  }
                  label={`${intel.form.label} form · ${intel.form.score.toFixed(1)}`}
                />
                {intel.consistency.available && (
                  <span className="text-[11.5px] text-[var(--hero-ink-faint)]">
                    {intel.consistency.label}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <PlayerAvailabilityLine availability={availability} />

        {ranking && ranking.sample.confidence !== "established" && (
          <p className="relative mt-4 flex items-center gap-1.5 text-[12.5px] text-[var(--hero-ink-faint)]">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--hero-${confidenceTone(ranking.sample.confidence)})` }}
              aria-hidden="true"
            />
            Small sample — {ranking.sample.matches} match
            {ranking.sample.matches === 1 ? "" : "es"} played this season.
          </p>
        )}
      </div>

      {!ranking || !intel || !story ? (
        <div className="mt-8 rounded-sm border border-dashed border-[var(--color-border-strong)] px-5 py-8 text-[14px] text-[var(--color-ink-faint)]">
          Not yet ranked — needs at least 45 minutes of playing time this season.
        </div>
      ) : (
        <>
          <SeasonStory
            paragraph={story.paragraph}
            totals={totals}
            showCleanSheets={showCleanSheets}
            journeyPoints={journeyPoints}
            explanation={explanation!}
            best={best}
          />

          {archetype && <ArchetypeCard archetype={archetype} />}

          <section className="mt-10">
            <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              Analytical breakdown
            </h2>
            <div className="divide-y divide-[var(--color-border)]">
              <CategoryBar label="Attack" icon={CATEGORY_ICON.attack} score={ranking.scores.attack} />
              <CategoryBar label="Creation" icon={CATEGORY_ICON.creation} score={ranking.scores.creation} />
              <CategoryBar label="Progression" icon={CATEGORY_ICON.progression} soon />
              <CategoryBar label="Defence" icon={CATEGORY_ICON.defence} score={ranking.scores.defence} />
              <CategoryBar label="Impact" icon={CATEGORY_ICON.impact} score={ranking.scores.impact} />
            </div>
            {intel.developmentAreas.length > 0 && (
              <p className="mt-3 text-[12px] text-[var(--color-ink-faint)]">
                Development area{intel.developmentAreas.length > 1 ? "s" : ""}:{" "}
                {intel.developmentAreas.map((a) => a.label).join(", ")}.
              </p>
            )}
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          Recent matches
        </h2>
        {matches.length === 0 ? (
          <p className="text-[13.5px] text-[var(--color-ink-faint)]">No matches played yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-[var(--color-border)]">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
                  <th className="px-3 py-2 font-medium">Opponent</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 text-right font-medium">Mins</th>
                  <th className="px-3 py-2 text-right font-medium">G</th>
                  <th className="px-3 py-2 text-right font-medium">A</th>
                  <th className="px-3 py-2 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 8).map((m) => (
                  <tr
                    key={m.matchId}
                    className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <td className="px-3 py-2 text-[var(--color-ink)]">
                      <Link href={`/match/${m.matchId}`} className="hover:text-[var(--color-accent)]">
                        <TeamIdentity
                          crestUrl={m.opponentCrestUrl}
                          name={m.opponentShortName}
                          shortName={m.opponentShortName}
                          size="sm"
                          showFullName={false}
                        />
                      </Link>
                      <span className="ml-1.5 text-[var(--color-ink-faint)]">
                        ({m.isHome ? "H" : "A"})
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular text-[var(--color-ink-soft)]">
                      {m.teamScore ?? "–"}–{m.opponentScore ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-[var(--color-ink-soft)]">{m.minutes}</td>
                    <td className="px-3 py-2 text-right tabular text-[var(--color-ink)]">{m.goals}</td>
                    <td className="px-3 py-2 text-right tabular text-[var(--color-ink)]">{m.assists}</td>
                    <td className="px-3 py-2 text-right">
                      <MatchRatingBadge rating={m.matchRating} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          Key moments
        </h2>
        <ComingSoonPanel
          title="Key moments"
          description="We haven't yet found a reliable, legitimately licensed data source that gives us minute-by-minute match events with enough context (scoreline, location) to identify significant moments responsibly. Rather than guess, we're leaving this until we can do it properly — see the methodology page for details."
        />
      </section>
    </main>
  );
}
