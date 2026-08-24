"use client";

import { usePreferences } from "@/lib/preferences/usePreferences";
import { setSupportedClub, clearSupportedClub } from "@/lib/preferences/store";

/** The one personalisation touchpoint on the team page — sets/clears the single stored preference (supported club). Nothing else. */
export function SupportedClubButton({ teamId }: { teamId: string }) {
  const preferences = usePreferences();
  const isSupported = preferences.supportedClubId === teamId;

  return (
    <button
      onClick={() => (isSupported ? clearSupportedClub() : setSupportedClub(teamId))}
      aria-pressed={isSupported}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors"
      style={
        isSupported
          ? { borderColor: "var(--hero-accent)", color: "var(--hero-accent)", backgroundColor: "color-mix(in srgb, var(--hero-accent) 12%, transparent)" }
          : { borderColor: "var(--hero-border)", color: "var(--hero-ink-soft)" }
      }
    >
      <span aria-hidden="true">{isSupported ? "✓" : "+"}</span>
      {isSupported ? "Your club" : "Make this my club"}
    </button>
  );
}
