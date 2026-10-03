"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";
import { explainPlayer } from "@/lib/analytics/scoring/explain";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { useCountUp } from "@/lib/hooks/useCountUp";

/**
 * LEAGUE LEADERS — the homepage's new cinematic masthead.
 * ==========================================================================
 * See docs/VISUAL_UX_REIMAGINATION.md. Replaces the former dark-hero portion
 * of TopPerformers (kicker/headline/glow) — the category tabs and ranked
 * table that used to live inside that hero now sit directly below this,
 * completely unchanged (see top-performers.tsx's own comment).
 *
 * DELIBERATELY NOT three equal cards. This is an asymmetric podium: the
 * league's #1 performer is the dominant figure (tallest portrait, biggest
 * numeral, full brightness); #2 and #3 flank them, smaller and slightly
 * dimmed until hovered/focused. Visual order is podium order (2nd, 1st,
 * 3rd — the classic silver/gold/bronze arrangement), with an explicit rank
 * badge on each figure so the actual ranking is never ambiguous despite the
 * reordering.
 *
 * No new data or analytics: `players` is the exact same getTopPerformers()
 * array every other section on this page receives, sorted here by the same
 * `scores.overall` every ranking on the site already uses. The one
 * intelligence line per player is `explainPlayer(...).headline` — an
 * existing, deterministic sentence (lib/analytics/scoring/explain.ts),
 * never invented copy.
 */
export function LeagueLeadersHero({
  players,
  sampleNote,
}: {
  players: RankedPlayer[];
  sampleNote: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const ranked = [...players]
    .sort((a, b) => (b.scores.overall ?? 0) - (a.scores.overall ?? 0))
    .slice(0, 3)
    .map((player, i) => ({ player, rank: i + 1 }));

  if (ranked.length === 0) return null;

  // Podium order: 2nd, 1st, 3rd — for a genuine 3-player field. Two or one
  // players (very early season) just render in rank order, centred.
  const visualOrder =
    ranked.length === 3 ? [ranked[1], ranked[0], ranked[2]] : ranked;
  const gridCols = ranked.length === 3 ? "grid-cols-3" : ranked.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <section
      data-leaders-hero
      className="relative overflow-hidden rounded-2xl px-5 pb-8 pt-7 sm:px-8 sm:pb-10 sm:pt-9"
      style={{ background: "var(--leaders-bg)", boxShadow: "var(--leaders-shadow)" }}
    >
      <AmbientLight />

      <div className="relative flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full animate-live-pulse"
          style={{ background: "var(--leaders-accent)" }}
          aria-hidden="true"
        />
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em] sm:text-[11.5px]"
          style={{ color: "var(--leaders-accent)" }}
        >
          Premier League · Leading performances
        </p>
      </div>
      <p className="relative mt-1.5 max-w-md text-[13px] leading-relaxed sm:text-[14px]" style={{ color: "var(--leaders-ink-faint)" }}>
        Who&rsquo;s performing at the highest level right now — {sampleNote.charAt(0).toLowerCase() + sampleNote.slice(1)}.
      </p>

      <div className={clsx("relative mt-7 grid items-end gap-2.5 sm:mt-10 sm:gap-5", gridCols)}>
        {visualOrder.map(({ player, rank }, i) => (
          <LeaderFigure
            key={player.playerId}
            player={player}
            rank={rank}
            entranceDelay={i * 110}
            isDimmed={activeId !== null && activeId !== player.playerId}
            onEnter={() => setActiveId(player.playerId)}
            onLeave={() => setActiveId(null)}
          />
        ))}
      </div>

      {/* the shared baseline the trio "stands" on — a touchline, not a generic
          divider. In light mode (Stadium Daylight) --touchline-image adds a
          real pitch-marking tick pattern on top of the same solid line;
          --touchline-image is `none` in dark, leaving Floodlit's plain
          baseline exactly as it was. */}
      <div
        className="relative mt-5 h-px w-full sm:mt-7"
        style={{ backgroundColor: "var(--leaders-line)", backgroundImage: "var(--touchline-image)" }}
        aria-hidden="true"
      />
    </section>
  );
}

function AmbientLight() {
  return (
    <>
      <div
        className="pointer-events-none absolute -top-16 left-1/4 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl animate-floodlight-breathe"
        style={{ background: "var(--leaders-glow)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-10 right-0 h-56 w-56 rounded-full blur-3xl animate-floodlight-breathe"
        style={{ background: "var(--leaders-glow)", animationDelay: "1.4s" }}
        aria-hidden="true"
      />
    </>
  );
}

const RANK_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

function LeaderFigure({
  player,
  rank,
  entranceDelay,
  isDimmed,
  onEnter,
  onLeave,
}: {
  player: RankedPlayer;
  rank: number;
  entranceDelay: number;
  isDimmed: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const isLeader = rank === 1;
  const score = useCountUp(player.scores.overall ?? 0);
  const headline = explainPlayer(player).headline;
  const teamColor = getTeamColor(player.teamShortName);

  return (
    <Link
      href={`/players/${player.slug}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className={clsx(
        "group/leader relative flex flex-col items-center rounded-xl px-1.5 pb-3 pt-2 text-center transition-[opacity,transform] duration-300 focus-visible:outline-offset-4 sm:px-3",
        "animate-leader-rise",
        isDimmed ? "opacity-55" : "opacity-100"
      )}
      style={{ animationDelay: `${entranceDelay}ms` }}
    >
      <span
        className={clsx(
          "mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] sm:text-[10px]",
          isLeader ? "text-[var(--leaders-bg)]" : ""
        )}
        style={
          isLeader
            ? { background: "var(--leaders-accent)" }
            : { color: "var(--leaders-ink-faint)", border: "1px solid var(--leaders-line)" }
        }
      >
        {RANK_LABEL[rank] ?? `${rank}th`}
      </span>

      <LeaderPortrait player={player} isLeader={isLeader} teamColor={teamColor} />

      <span
        className={clsx(
          "mt-3 max-w-full truncate font-display font-semibold tracking-tight",
          isLeader ? "text-[17px] sm:text-[21px]" : "text-[13.5px] sm:text-[16px]"
        )}
        style={{ color: "var(--leaders-ink)" }}
        title={player.name}
      >
        {player.name}
      </span>
      <span className="mt-0.5 truncate text-[11px] sm:text-[12.5px]" style={{ color: "var(--leaders-ink-faint)" }}>
        {player.teamShortName}
      </span>

      <span
        className={clsx(
          "mt-2.5 font-display font-semibold leading-none tabular sm:mt-3",
          isLeader ? "text-[40px] sm:text-[64px]" : "text-[24px] sm:text-[34px]"
        )}
        style={{ color: "var(--leaders-ink)" }}
      >
        {score.toFixed(1)}
      </span>
      <span
        className="mt-1 text-[10px] font-medium uppercase tracking-[0.06em] sm:text-[11px]"
        style={{ color: "var(--leaders-accent)" }}
      >
        {player.qualityLabel}
      </span>

      <p
        className={clsx(
          "mt-3 line-clamp-2 max-w-[13.5rem] leading-snug",
          isLeader ? "text-[12.5px] sm:max-w-[15rem] sm:text-[13.5px]" : "text-[11px] sm:text-[12px]"
        )}
        style={{ color: "var(--leaders-ink-soft)" }}
      >
        {headline}
      </p>
    </Link>
  );
}

function LeaderPortrait({
  player,
  isLeader,
  teamColor,
}: {
  player: RankedPlayer;
  isLeader: boolean;
  teamColor: string;
}) {
  const [failed, setFailed] = useState(false);
  const heroPhoto = toHeroPhotoUrl(player.photoUrl);
  const size = isLeader ? 152 : 100;

  return (
    <span
      className="relative flex shrink-0 items-end justify-center transition-transform duration-300 group-hover/leader:scale-[1.035]"
      style={{ width: size, height: size * (isLeader ? 1.08 : 1) }}
    >
      {/* club-colour rim light — the per-entity "identity light" behind the
          cutout. --rim-intensity is 60% in dark (Floodlit's original,
          unchanged value) and a lower 46% in light (Stadium Daylight),
          since a saturated glow reads as light spill at night but as mud on
          a bright surface — the same recipe, tuned per theme via CSS, not a
          second code path. */}
      <span
        className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${teamColor} var(--rim-intensity), transparent) 0%, transparent 72%)`,
        }}
        aria-hidden="true"
      />
      {/* kit swatch — a firm rectangular block of club colour, the "Stadium
          Daylight" reading of identity (a shirt's colour, not a glow).
          --kit-swatch-opacity is 0 in dark, so this has zero visual effect
          there — Floodlit keeps its single circular rim light, unchanged. */}
      <span
        className="pointer-events-none absolute -inset-2 -z-20 rounded-2xl"
        style={{ backgroundColor: teamColor, opacity: "var(--kit-swatch-opacity)" }}
        aria-hidden="true"
      />
      {heroPhoto && !failed ? (
        <Image
          src={heroPhoto}
          alt={player.name}
          width={size}
          height={size}
          unoptimized
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
          style={{
            maskImage: "radial-gradient(ellipse 68% 88% at 50% 38%, black 62%, transparent 96%)",
            WebkitMaskImage: "radial-gradient(ellipse 68% 88% at 50% 38%, black 62%, transparent 96%)",
          }}
        />
      ) : (
        // No working photo at the source for this player — real, not rare:
        // roughly 40% of the database has no photo the Premier League's own
        // CDN actually serves (verified directly against every player, not
        // assumed). Deliberately NOT a smaller/plainer "broken image"
        // treatment: it shares the real photo's exact footprint, its same
        // edge-dissolving mask, and a crisp club-colour ring, so a missing
        // photo reads as one of two intentional looks this hero can show,
        // not a degraded fallback bolted on afterwards.
        <span
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full font-display font-semibold"
          style={{
            background: `radial-gradient(circle at 42% 32%, color-mix(in srgb, ${teamColor} 42%, white) 0%, color-mix(in srgb, ${teamColor} 30%, transparent) 55%, transparent 88%)`,
            boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${teamColor} 55%, transparent)`,
            color: teamColor,
            maskImage: "radial-gradient(ellipse 68% 88% at 50% 38%, black 62%, transparent 96%)",
            WebkitMaskImage: "radial-gradient(ellipse 68% 88% at 50% 38%, black 62%, transparent 96%)",
          }}
          aria-hidden="true"
        >
          <span style={{ fontSize: size * 0.28 }}>{initialsOf(player.name)}</span>
          <span
            className="text-[9px] font-sans font-semibold uppercase tracking-[0.08em] opacity-80"
            style={{ fontSize: size * 0.075 }}
          >
            {POSITION_LABEL[player.position]}
          </span>
        </span>
      )}
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.slice(0, 2).toUpperCase();
}

/**
 * Requests the Premier League CDN's larger, better-cropped photo size for
 * this hero context only — a presentation-time string transform, not a
 * data-layer change (lib/assets/images.ts and every other consumer of
 * `photoUrl` are untouched, so no other avatar in the app is affected).
 * Verified directly against the real CDN: "md" (110x140) is a full-torso
 * shot with a lot of empty headroom above the face; "lg" (250x250) is a
 * proper waist-up portrait — worth the switch specifically here, where the
 * photo is the actual visual centrepiece rather than a small avatar.
 * `lg` is not guaranteed to exist for every player (confirmed: it 403s for
 * at least one real current top performer) — LeaderPortrait's onError
 * handler falls back to the initials treatment exactly as PlayerAvatar
 * already does elsewhere, it just never gets a second, smaller-size retry,
 * since a missing "lg" photo is missing at every other size too for the
 * same player (verified directly, not assumed).
 */
function toHeroPhotoUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  return photoUrl.replace("/110x140/", "/250x250/");
}
