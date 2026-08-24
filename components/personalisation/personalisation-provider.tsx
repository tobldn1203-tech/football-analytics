"use client";

import { createContext, useContext, useState } from "react";
import type { TeamSummary } from "@/lib/directory/repository";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { PreferencesModal } from "./preferences-modal";

/**
 * Fetched once, server-side, in app/layout.tsx and handed down through this
 * context so every personalisation-aware client component — the club
 * prompt, the header widget, the homepage "My Football" section — can
 * resolve a club id into a name/crest without a fetch of its own.
 */
const DirectoryContext = createContext<{ teams: TeamSummary[] }>({ teams: [] });

export function useDirectory() {
  return useContext(DirectoryContext);
}

export function PersonalisationProvider({
  teams,
  children,
}: {
  teams: TeamSummary[];
  children: React.ReactNode;
}) {
  return (
    <DirectoryContext.Provider value={{ teams }}>
      {children}
      <OnboardingGate />
    </DirectoryContext.Provider>
  );
}

/** Auto-opens the club prompt once, for anyone who hasn't picked a club or dismissed it. */
function OnboardingGate() {
  const preferences = usePreferences();
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  if (preferences.promptDismissed || preferences.supportedClubId || dismissedThisSession) return null;

  return <PreferencesModal onClose={() => setDismissedThisSession(true)} />;
}
