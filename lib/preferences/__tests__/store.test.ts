import { describe, expect, it, beforeEach } from "vitest";
import {
  getUserPreferences,
  getSupportedClub,
  setSupportedClub,
  clearSupportedClub,
  dismissPrompt,
  subscribe,
  resetPreferences,
} from "../store";

// No `window`/localStorage in this test environment (vitest.config.mts uses
// "node") — deliberately exercising the in-memory-cache-only degrade path,
// which is exactly what a real private-browsing session falls back to too.

beforeEach(() => {
  resetPreferences();
});

describe("preferences store", () => {
  it("starts with sensible, empty defaults", () => {
    const prefs = getUserPreferences();
    expect(prefs.supportedClubId).toBeNull();
    expect(prefs.promptDismissed).toBe(false);
  });

  it("setSupportedClub sets the club and marks the prompt dismissed", () => {
    setSupportedClub("arsenal");
    const prefs = getUserPreferences();
    expect(prefs.supportedClubId).toBe("arsenal");
    expect(prefs.promptDismissed).toBe(true);
  });

  it("getSupportedClub is a convenience read for just the club id", () => {
    setSupportedClub("arsenal");
    expect(getSupportedClub()).toBe("arsenal");
  });

  it("clearSupportedClub removes the club without re-triggering the prompt", () => {
    setSupportedClub("arsenal");
    clearSupportedClub();
    const prefs = getUserPreferences();
    expect(prefs.supportedClubId).toBeNull();
    expect(prefs.promptDismissed).toBe(true);
  });

  it("changing club overwrites the previous one", () => {
    setSupportedClub("arsenal");
    setSupportedClub("chelsea");
    expect(getSupportedClub()).toBe("chelsea");
  });

  it("dismissPrompt marks the prompt seen without picking a club", () => {
    dismissPrompt();
    const prefs = getUserPreferences();
    expect(prefs.supportedClubId).toBeNull();
    expect(prefs.promptDismissed).toBe(true);
  });

  it("notifies subscribers on every write", () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls++;
    });
    setSupportedClub("arsenal");
    clearSupportedClub();
    unsubscribe();
    setSupportedClub("chelsea"); // after unsubscribe — should not increment
    expect(calls).toBe(2);
  });
});
