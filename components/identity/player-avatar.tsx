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
    return (
      <span
        aria-label={name}
        style={{
          width: px,
          height: px,
          fontSize: px * 0.34,
          backgroundColor: `${getTeamColor(teamShortName)}26`,
          color: getTeamColor(teamShortName),
          ...ringStyle,
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
