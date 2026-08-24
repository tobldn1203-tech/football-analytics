"use client";

import Link from "next/link";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "@/components/personalisation/personalisation-provider";
import type { ClubFixtureSnapshot } from "@/lib/analytics/scoring/matchRepository";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { qualityLabelFor } from "@/lib/analytics/scoring/types";
import { TeamCrest } from "@/components/identity/team-crest";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { getTeamColor } from "@/lib/competitions/teamBranding";

/**
 * The personalised layer on top of the existing homepage (Personalisation
 * Foundation) — renders nothing at all when no club is selected, so the
 * default experience is untouched. Once a club is picked, this enhances
 * the top of the page with real, already-computed data: the club's next
 * fixture, most recent result, and standout player (highest existing
 * Performance score on the squad) — no new analytics, no team-rating
 * formula, just existing facts surfaced club-first.
 */
export function MyFootballWidget({
  fixtures,
  standoutByTeam,
  insightByTeam = {},
}: {
  fixtures: Record<string, ClubFixtureSnapshot>;
  standoutByTeam: Record<string, RankedPlayer>;
  /** One cheap, already-computed line per team (e.g. its leading category this season) — see app/page.tsx. Never a new analysis, just a sentence over numbers already in memory there. */
  insightByTeam?: Record<string, string>;
}) {
  const preferences = usePreferences();
  const { teams } = useDirectory();

  const club = teams.find((t) => t.id === preferences.supportedClubId);
  if (!club) return null;

  const snapshot = fixtures[club.id];
  const standout = standoutByTeam[club.shortName];
  const insight = insightByTeam[club.shortName];
  const accent = getTeamColor(club.shortName);

  const ctaHref = snapshot?.next ? `/match/${snapshot.next.matchId}` : snapshot?.last ? `/match/${snapshot.last.matchId}` : "/matches";
  const ctaLabel = snapshot?.next ? "View next match" : snapshot?.last ? "View last match" : "View fixtures";

  return (
    <div
      className="mb-8 overflow-hidden rounded-xl border border-[var(--color-border)]"
      style={{ borderTopColor: accent, borderTopWidth: 3 }}
    >
      <Link href={`/teams/${club.id}`} className="flex flex-wrap items-center gap-4 bg-[var(--color-surface-2)] px-5 py-4 hover:bg-[var(--color-border)] sm:px-6">
        <TeamCrest crestUrl={club.crestUrl} shortName={club.shortName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
            My Football
          </p>
          <p className="font-display text-[19px] font-semibold tracking-tight text-[var(--color-ink)]">
            {club.name}
          </p>
          {insight && <p className="mt-0.5 text-[12px] text-[var(--color-ink-faint)]">{insight}</p>}
        </div>
        <span className="shrink-0 text-[12px] font-medium text-[var(--color-accent)]">Team Intelligence →</span>
      </Link>

      <div className="grid grid-cols-1 divide-y divide-[var(--color-border)] px-5 py-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
        <FixtureBlock label="Next match" fixture={snapshot?.next ?? null} clubShortName={club.shortName} />
        <FixtureBlock label="Latest result" fixture={snapshot?.last ?? null} clubShortName={club.shortName} showResult />
        {standout ? (
          <div className="py-3 sm:pl-6">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">
              Standout player
            </p>
            <Link href={`/players/${standout.slug}`} className="flex items-center gap-2.5 hover:opacity-80">
              <PlayerAvatar photoUrl={standout.photoUrl} name={standout.name} teamShortName={standout.teamShortName} size="md" />
              <span>
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--color-ink)]">
                  <NationalityFlag code={standout.nationalityCode} country={standout.nationality} size="xs" />
                  {standout.name}
                </span>
                <span className="block text-[11.5px] text-[var(--color-ink-faint)]">
                  {(standout.scores.overall ?? 0).toFixed(1)} · {qualityLabelFor(standout.scores.overall ?? 0)}
                </span>
              </span>
            </Link>
          </div>
        ) : (
          <div className="py-3 sm:pl-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">
              Standout player
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-faint)]">Not enough data yet.</p>
          </div>
        )}
      </div>

      <Link
        href={ctaHref}
        className="block border-t border-[var(--color-border)] px-5 py-2.5 text-[12.5px] font-medium text-[var(--color-accent)] hover:underline sm:px-6"
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}

function FixtureBlock({
  label,
  fixture,
  clubShortName,
  showResult,
}: {
  label: string;
  fixture: { homeTeam: { shortName: string; crestUrl: string | null }; awayTeam: { shortName: string; crestUrl: string | null }; homeScore: number | null; awayScore: number | null; kickoff: string } | null;
  clubShortName: string;
  showResult?: boolean;
}) {
  return (
    <div className="py-3 first:pt-0 sm:py-0 sm:pr-6 sm:first:pl-0">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">{label}</p>
      {!fixture ? (
        <p className="text-[12.5px] text-[var(--color-ink-faint)]">
          {showResult ? "No result yet this season." : "Nothing scheduled yet."}
        </p>
      ) : (
        <div className="flex items-center gap-2 text-[13.5px] text-[var(--color-ink)]">
          <TeamCrest crestUrl={fixture.homeTeam.crestUrl} shortName={fixture.homeTeam.shortName} size="sm" />
          <span className={fixture.homeTeam.shortName === clubShortName ? "font-semibold" : ""}>
            {fixture.homeTeam.shortName}
          </span>
          {showResult && fixture.homeScore !== null ? (
            <span className="tabular font-semibold">
              {fixture.homeScore}–{fixture.awayScore}
            </span>
          ) : (
            <span className="text-[var(--color-ink-faint)]">vs</span>
          )}
          <span className={fixture.awayTeam.shortName === clubShortName ? "font-semibold" : ""}>
            {fixture.awayTeam.shortName}
          </span>
          <TeamCrest crestUrl={fixture.awayTeam.crestUrl} shortName={fixture.awayTeam.shortName} size="sm" />
        </div>
      )}
    </div>
  );
}
