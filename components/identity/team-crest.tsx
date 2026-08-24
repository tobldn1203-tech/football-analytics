"use client";

import { useState } from "react";
import Image from "next/image";
import { getTeamColor } from "@/lib/competitions/teamBranding";

const PX: Record<"sm" | "md" | "lg", number> = { sm: 18, md: 24, lg: 40 };

/**
 * Renders a club crest, falling back to a small coloured monogram if the
 * image is missing or fails to load — never a broken-image icon.
 */
export function TeamCrest({
  crestUrl,
  shortName,
  size = "md",
}: {
  crestUrl: string | null;
  shortName: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const px = PX[size];

  if (!crestUrl || failed) {
    return (
      <span
        aria-label={shortName}
        style={{
          width: px,
          height: px,
          backgroundColor: getTeamColor(shortName),
          fontSize: px * 0.36,
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-[3px] font-semibold text-white/95"
      >
        {shortName.slice(0, 3)}
      </span>
    );
  }

  return (
    <Image
      src={crestUrl}
      alt={shortName}
      width={px}
      height={px}
      className="shrink-0 object-contain"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}
