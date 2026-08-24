"use client";

import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, getServerSnapshot } from "./store";
import type { UserPreferences } from "./types";

/**
 * The one hook every personalisation-aware client component uses to read
 * live preferences — re-renders automatically whenever ANY component calls
 * a mutator in lib/preferences/store.ts (followTeam, unfollowPlayer, …),
 * without prop-drilling or a manual event bus. `useSyncExternalStore` also
 * gives this the correct hydration behaviour for free: server-rendered
 * markup always starts from `getServerSnapshot` (defaults, since the
 * server has no localStorage), then reconciles to the real client value
 * immediately after mount — no manual "isMounted" loading-state juggling.
 */
export function usePreferences(): UserPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
