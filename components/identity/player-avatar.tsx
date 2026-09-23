"use client";

import { useState } from "react";
import Image from "next/image";
import { getTeamColor } from "@/lib/competitions/teamBranding";

const PX: Record<"sm" | "md" | "lg" | "xl", number> = { sm: 28, md: 36, lg: 88, xl: 108 };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.slice(0, 2).toUpperCase();
}

/**
 * Renders a player photo, falling back to a generated monogram (tinted with
 * the player's club colour) if no photo is available or it fails to load.
 * See lib/assets/images.ts for where the photo URL itself comes from.
 *
 * This fallback is common, not rare — roughly 40% of players in the
 * database have no working photo at the Premier League's own CDN (verified
 * directly against every player; it's a gap in that source, not a bug in
 * this app's ingestion). The thin club-colour ring below is a deliberately
 * small addition on top of the existing monogram, not a redesign of it —
 * everywhere this component already renders (tables, rows, match/team
 * pages) keeps its exact size and layout; the ring is the one touch that
 * ties it to the more fully-developed version of this same "no photo"
 * treatment in the homepage's League Leaders hero.
 */
export function PlayerAvatar({
  photoUrl,
  name,
  teamShortName,
  size = "md",
  glow = false,
}: {
  photoUrl: string | null;
  name: string;
  teamShortName: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** A soft accent-tinted ring, for placement on the dark editorial header. */
  glow?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const px = PX[size];
  const ringStyle = glow
    ? { boxShadow: "0 0 0 3px var(--hero-bg), 0 0 0 5px var(--hero-accent), 0 8px 24px -6px var(--hero-glow)" }
    : undefined;

  if (!photoUrl || failed) {
    const teamColor = getTeamColor(teamShortName);
    return (
      <span
        aria-label={name}
        style={{
          width: px,
          height: px,
          fontSize: px * 0.34,
          backgroundColor: `${teamColor}26`,
          color: teamColor,
          boxShadow: ringStyle ? ringStyle.boxShadow : `inset 0 0 0 1px ${teamColor}40`,
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      >
        {initialsOf(name)}
      </span>
    );
  }

  return (
    <Image
      src={photoUrl}
      alt={name}
      width={px}
      height={px}
      className="shrink-0 rounded-full object-cover object-top"
      style={{ width: px, height: px, ...ringStyle }}
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
