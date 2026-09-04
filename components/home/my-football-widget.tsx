"use client";

import Link from "next/link";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "@/components/personalisation/personalisation-provider";
import type { ClubFixtureSnapshot } from "@/lib/analytics/scoring/matchRepository";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { qualityLabelFor } from "@/lib/analytics/scoring/types";
import type { WorthKnowingInsight } from "@/lib/analytics/availability/worthKnowing";
import { TeamCrest } from "@/components/identity/team-crest";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { getTeamColor } from "@/lib/competitions/teamBranding";

const RESULT_COLOR = {
  W: "var(--color-positive)",
  D: "var(--color-ink-faint)",
  L: "var(--color-negative)",
} as const;

/**
 * The personalised layer on top of the existing homepage (Personalisation
 * Foundation) — renders nothing at all when no club is selected, so the
 * default experience is untouched. Once a club is picked, this surfaces
 * real, already-computed data: the club identity, the one piece of
 * intelligence worth knowing about it right now, and quick jumps into its
 * next fixture / latest result / standout player — no new analytics, no
 * team-rating formula, just existing facts surfaced club-first.
 *
 * UX REWORK (see docs — My Football module rework): this used to be a
 * bordered, dashboard-like card with its own header link, a divided
 * 3-column stat grid, a separate "worth knowing" block and a separate
 * bottom CTA link — four visually competing pieces stacked in one box.
 * It's now one editorial callout modelled directly on DiscoverTeaser (the
 * component that already sits right below it on this page): a single link
 * for the whole club identity + intelligence, left-accented in the club's
 * colour, ending in an inline "Explore Team Intelligence →" — plus a
 * compact secondary row of small sibling links for the facts that used to
 * fill a whole grid. Same data in, same destinations, far less chrome.
 *
 * FOLLOW-UP TIGHTENING PASS (home page tightening — My Club consolidation):
 * two further refinements on top of that rework, not a new redesign.
 *
 * (1) The generic category-leader sentence ("Strongest area this season:
 * X.") is no longer rendered — `insightByTeam` is still accepted as a
 * prop (app/page.tsx's computation and the call site are both untouched;
 * this is a presentation change, not a data change) but no longer read in
 * this component's body. `worthKnowing`'s own headline — the richer,
 * availability-aware insight — was already preferred over it whenever
 * both existed; the generic line only ever showed for clubs where
 * `worthKnowing` was absent, and read as a noticeably blander, more
 * template-y sentence than everything else on this card. For a club with
 * no `worthKnowing` today, the card now leads with identity and lets the
 * facts row below (2) carry "something worth knowing," rather than
 * filling that space with the weakest signal available.
 *
 * (2) The "quick facts" row (next match / last result / standout player)
 * used to be a second, unbordered block sitting below this card with a
 * gap — same component, same file, but visually read as two stacked
 * pieces rather than one. The border (and its left accent) now wraps
 * BOTH the identity+intelligence link AND the facts row, with a thin
 * border-top dividing them inside the same card — one bordered box, one
 * primary link, the facts row's individual Links still siblings of it
 * (never nested inside the `<a>`, exactly the constraint the original
 * rework enforced — verified with zero nested anchors, same as before).
 */
export function MyFootballWidget({
  fixtures,
  standoutByTeam,
  insightByTeam = {},
  worthKnowingByTeam = {},
}: {
  fixtures: Record<string, ClubFixtureSnapshot>;
  standoutByTeam: Record<string, RankedPlayer>;
  /** One cheap, already-computed line per team (e.g. its leading category this season) — see app/page.tsx. Never a new analysis, just a sentence over numbers already in memory there. Accepted for backward compatibility with app/page.tsx's existing computation/prop-threading (untouched — this is a presentation change only) but no longer rendered here; see the tightening-pass note above. */
  insightByTeam?: Record<string, string>;
  /** Availability × performance insight per team, keyed the same way — see lib/analytics/availability/worthKnowing.ts. Only present for a club when there's genuinely something noteworthy; absent otherwise. */
  worthKnowingByTeam?: Record<string, WorthKnowingInsight>;
}) {
  const preferences = usePreferences();
  const { teams } = useDirectory();

  const club = teams.find((t) => t.id === preferences.supportedClubId);
  if (!club) return null;

  const snapshot = fixtures[club.id];
  const standout = standoutByTeam[club.shortName];
  const worthKnowing = worthKnowingByTeam[club.shortName];
  const accent = getTeamColor(club.shortName);
  const teamHref = `/teams/${club.id}`;

  // Only the richer, availability-aware insight is shown as the card's
  // headline now — the generic category-leader sentence formerly used as
  // its fallback ("Strongest area this season: X.") read as noticeably
  // blander next to it, and is no longer displayed (see the tightening-
  // pass note above). A club without a `worthKnowing` insight today shows
  // no headline line at all; the facts row below still gives it real
  // content rather than leaving the space empty.
  const primaryLine = worthKnowing?.headline ?? null;
  const secondaryLine = worthKnowing ? worthKnowing.context : null;
  const voiceLine = worthKnowing?.voice?.observation ?? null;

  const lastResult = fixtureResult(snapshot?.last ?? null, club.shortName);

  return (
    <div
      className="mb-8 overflow-hidden rounded-xl border border-[var(--color-border)]"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
    >
      {/* CLUB IDENTITY + INTELLIGENCE — one link, one destination. Crest and
          name anchor "this is my club"; the intelligence line is the reason
          the module exists, not an afterthought; the trailing label makes
          Team Intelligence the obvious next step — never a second,
          competing link inside the same block. The border/rounding/accent
          now live on the OUTER div (see the tightening-pass note above),
          not this Link, so the facts row below shares the same card. */}
      <Link
        href={teamHref}
        className="group flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)] sm:items-center sm:gap-4 sm:px-6"
      >
        <TeamCrest crestUrl={club.crestUrl} shortName={club.shortName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
            My club
          </p>
          <p className="font-display truncate text-[18px] font-semibold tracking-tight text-[var(--color-ink)] sm:text-[19px]">
            {club.name}
          </p>
          {primaryLine && (
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--color-ink-soft)]">{primaryLine}</p>
          )}
          {secondaryLine && (
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-ink-faint)]">{secondaryLine}</p>
          )}
          {voiceLine && (
            <p className="mt-0.5 text-[11px] italic leading-snug text-[var(--color-ink-faint)]">{voiceLine}</p>
          )}
        </div>
        <span className="hidden shrink-0 items-center gap-1 self-center text-[12.5px] font-medium text-[var(--color-ink-soft)] transition-colors group-hover:text-[var(--color-accent)] sm:flex">
          Explore Team Intelligence
          <ChevronRight />
        </span>
        <ChevronRight className="mt-1 shrink-0 self-start text-[var(--color-ink-faint)] transition-colors group-hover:text-[var(--color-accent)] sm:hidden" />
      </Link>

      {/* QUICK FACTS — visually secondary, small sibling links (never
          nested inside the link above). Replaces the old bordered 3-column
          grid and the separate bottom "View next match →" CTA: the fixture
          chip below already points at whichever of next/last is the more
          useful destination, the same priority the old CTA used. Now
          inside the same card as the identity link above (border-top
          divider, matching horizontal padding) instead of a separate
          unbordered block below it — one card, not two stacked pieces. */}
      {(snapshot?.next || snapshot?.last || standout) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--color-border)] px-5 py-3 text-[12px] text-[var(--color-ink-faint)] sm:px-6">
          {snapshot?.next && (
            <Link href={`/match/${snapshot.next.matchId}`} className="flex items-center gap-1.5 hover:text-[var(--color-ink)]">
              <span className="uppercase tracking-[0.04em]">Next</span>
              <TeamCrest crestUrl={opponentOf(snapshot.next, club.shortName).crestUrl} shortName={opponentOf(snapshot.next, club.shortName).shortName} size="sm" />
              <span className="text-[var(--color-ink-soft)]">vs {opponentOf(snapshot.next, club.shortName).shortName}</span>
            </Link>
          )}
          {snapshot?.last && lastResult && (
            <Link href={`/match/${snapshot.last.matchId}`} className="flex items-center gap-1.5 hover:text-[var(--color-ink)]">
              <span className="uppercase tracking-[0.04em]">Last</span>
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[var(--color-canvas)]"
                style={{ backgroundColor: RESULT_COLOR[lastResult.letter] }}
                aria-label={lastResult.letter === "W" ? "Won" : lastResult.letter === "L" ? "Lost" : "Drew"}
              >
                {lastResult.letter}
              </span>
              <span className="tabular text-[var(--color-ink-soft)]">
                {lastResult.teamScore}–{lastResult.oppScore}
              </span>
              <TeamCrest crestUrl={lastResult.opponent.crestUrl} shortName={lastResult.opponent.shortName} size="sm" />
              <span className="text-[var(--color-ink-soft)]">{lastResult.opponent.shortName}</span>
            </Link>
          )}
          {standout && (
            <Link href={`/players/${standout.slug}`} className="flex items-center gap-1.5 hover:text-[var(--color-ink)]">
              <span className="uppercase tracking-[0.04em]">Standout</span>
              <PlayerAvatar photoUrl={standout.photoUrl} name={standout.name} teamShortName={standout.teamShortName} size="sm" />
              <span className="text-[var(--color-ink-soft)]">
                {standout.name} · {(standout.scores.overall ?? 0).toFixed(1)} · {qualityLabelFor(standout.scores.overall ?? 0)}
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function opponentOf(fixture: { homeTeam: { shortName: string; crestUrl: string | null }; awayTeam: { shortName: string; crestUrl: string | null } }, clubShortName: string) {
  return fixture.homeTeam.shortName === clubShortName ? fixture.awayTeam : fixture.homeTeam;
}

function fixtureResult(
  fixture: { homeTeam: { shortName: string; crestUrl: string | null }; awayTeam: { shortName: string; crestUrl: string | null }; homeScore: number | null; awayScore: number | null } | null,
  clubShortName: string,
): { letter: "W" | "D" | "L"; teamScore: number; oppScore: number; opponent: { shortName: string; crestUrl: string | null } } | null {
  if (!fixture || fixture.homeScore === null || fixture.awayScore === null) return null;
  const isHome = fixture.homeTeam.shortName === clubShortName;
  const teamScore = isHome ? fixture.homeScore : fixture.awayScore;
  const oppScore = isHome ? fixture.awayScore : fixture.homeScore;
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  const letter = teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "D";
  return { letter, teamScore, oppScore, opponent };
}
