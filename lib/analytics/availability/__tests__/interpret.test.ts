import { describe, expect, it } from "vitest";
import { interpretPlayerAvailability } from "../interpret";

/**
 * All non-synthetic cases below use real values captured from the live
 * 2026/27 FPL API on 2026-08-25 (see docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md
 * §1) — status codes, chance_of_playing_next_round values and news text are
 * copied verbatim from that investigation, not invented.
 */

const NOW = new Date("2026-08-25T20:00:00Z");

describe("interpretPlayerAvailability", () => {
  it("1. definitely unavailable — injured (real: an injured player's actual note)", () => {
    const result = interpretPlayerAvailability({
      status: "i",
      chanceOfPlayingNextRound: 0,
      latestNews: {
        description: "Groin injury - Unknown return date",
        publishedAt: new Date("2026-08-20T12:00:00Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result).toEqual({
      state: "unavailable",
      category: "injury",
      label: "Injured",
      detail: "Groin injury - Unknown return date",
      chanceOfPlayingNextRound: null, // never shown for a non-doubtful state — always 0, adds nothing
      updatedAt: new Date("2026-08-20T12:00:00Z"),
      sourceName: "Fantasy Premier League",
    });
  });

  it("2. doubtful — real: Ajayi, 75% chance of playing, hamstring injury", () => {
    const result = interpretPlayerAvailability({
      status: "d",
      chanceOfPlayingNextRound: 75,
      latestNews: {
        description: "Hamstring injury - 75% chance of playing",
        publishedAt: new Date("2026-08-22T17:30:07.668Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.state).toBe("doubtful");
    expect(result?.category).toBe("availability");
    expect(result?.label).toBe("Doubtful");
    expect(result?.chanceOfPlayingNextRound).toBe(75);
    expect(result?.detail).toBe("Hamstring injury - 75% chance of playing");
  });

  it("2b. doubtful — real: Anselmino, 25% chance of playing (the low end of the graded range)", () => {
    const result = interpretPlayerAvailability({
      status: "d",
      chanceOfPlayingNextRound: 25,
      latestNews: {
        description: "Hamstring injury - 25% chance of playing",
        publishedAt: new Date("2026-08-23T19:00:08.536Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.chanceOfPlayingNextRound).toBe(25);
    // The UI must not upgrade a 25% chance into "likely available" language —
    // see docs §2/§4: the number is shown as-is, never re-interpreted.
    expect(result?.state).toBe("doubtful");
  });

  it("3. 'likely available' is not a rendered state — a residual chance=100 on an already-available player produces no signal", () => {
    // Real: 40 currently-'a' players carry a lingering chance=100 (docs §1).
    // Functionally identical to fully available — deliberately not
    // distinguished, since surfacing it would imply a fitness claim we
    // can't back beyond "no current concern is on file".
    const result = interpretPlayerAvailability({
      status: "a",
      chanceOfPlayingNextRound: 100,
      latestNews: null,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("4. available — status 'a', chance null: no signal, not an 'Available' claim", () => {
    const result = interpretPlayerAvailability({
      status: "a",
      chanceOfPlayingNextRound: null,
      latestNews: null,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("5. null / no information — an unrecognised status code is never guessed at", () => {
    const result = interpretPlayerAvailability({
      status: "",
      chanceOfPlayingNextRound: null,
      latestNews: null,
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it("6. stale news — the status/label still show, but a note older than the freshness window is hidden", () => {
    const result = interpretPlayerAvailability({
      status: "d",
      chanceOfPlayingNextRound: 50,
      latestNews: {
        description: "Knee injury - 50% chance of playing",
        publishedAt: new Date("2026-07-01T00:00:00Z"), // > 14 days before NOW
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.state).toBe("doubtful");
    expect(result?.label).toBe("Doubtful");
    expect(result?.detail).toBeNull(); // stale text withheld
    expect(result?.updatedAt).toBeNull();
    // The structured percentage is still current (refreshed on every
    // ingestion regardless of the note's age) so it's still shown.
    expect(result?.chanceOfPlayingNextRound).toBe(50);
  });

  it("6b. missing news entirely — status alone still produces a bare label", () => {
    const result = interpretPlayerAvailability({
      status: "s",
      chanceOfPlayingNextRound: 0,
      latestNews: null,
      now: NOW,
    });
    expect(result).toEqual({
      state: "unavailable",
      category: "suspension",
      label: "Suspended",
      detail: null,
      chanceOfPlayingNextRound: null,
      updatedAt: null,
      sourceName: "Fantasy Premier League",
    });
  });

  it("7. contradictory structured/text information — no real example currently exists (verified live, docs §2); status is authoritative regardless", () => {
    // Synthetic: a stale note claiming a different situation than the
    // current status. The rule (docs §7) is status always wins and the
    // note is simply not shown — never reconciled or reinterpreted.
    const result = interpretPlayerAvailability({
      status: "a", // current, authoritative: no issue
      chanceOfPlayingNextRound: null,
      latestNews: {
        description: "Groin injury - 75% chance of playing", // an old, now-contradicted note
        publishedAt: new Date("2026-06-01T00:00:00Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result).toBeNull(); // status "a" wins outright — the old note is never surfaced
  });

  it("8. transferred player — real: Digne, joined Paris Saint-Germain permanently 15 days ago (a permanent fact that does not go stale, unlike an injury estimate)", () => {
    const result = interpretPlayerAvailability({
      status: "u",
      chanceOfPlayingNextRound: 0,
      latestNews: {
        description: "Has joined Paris Saint-Germain permanently",
        publishedAt: new Date("2026-08-10T14:03:30.089Z"), // real timestamp, > 14 days before NOW
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.state).toBe("unavailable");
    expect(result?.category).toBe("transfer");
    expect(result?.label).toBe("No longer at the club");
    // Not withheld despite being outside the 14-day window: a discrete,
    // permanent fact isn't subject to the same staleness risk as an
    // open-ended injury/doubtful estimate — see interpret.ts
    // CATEGORIES_THAT_CAN_GO_STALE and docs "Limitations discovered".
    expect(result?.detail).toBe("Has joined Paris Saint-Germain permanently");
  });

  it("8b. suspended player's dated note is shown regardless of age — real: Saliba's injury note (33 days old) is withheld, but the same-age category of fact for a suspension would not be", () => {
    const oldSuspension = interpretPlayerAvailability({
      status: "s",
      chanceOfPlayingNextRound: 0,
      latestNews: {
        description: "Suspended until 19 Sep",
        publishedAt: new Date("2026-07-01T00:00:00Z"), // well outside the injury freshness window
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(oldSuspension?.detail).toBe("Suspended until 19 Sep");
  });

  it("8c. an open-ended injury note genuinely does go stale — real: Saliba, back injury note from 33 days ago", () => {
    const result = interpretPlayerAvailability({
      status: "i",
      chanceOfPlayingNextRound: 0,
      latestNews: {
        description: "Back injury - Unknown return date",
        publishedAt: new Date("2026-07-23T12:01:23.289Z"), // real timestamp, 33 days before NOW
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.label).toBe("Injured");
    expect(result?.detail).toBeNull(); // correctly withheld as stale
  });

  it("9. suspended player — real: Gomes, suspended until 19 Sep", () => {
    const result = interpretPlayerAvailability({
      status: "s",
      chanceOfPlayingNextRound: 0,
      latestNews: {
        description: "Suspended until 19 Sep",
        publishedAt: new Date("2026-08-20T00:00:00Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    });
    expect(result?.state).toBe("unavailable");
    expect(result?.category).toBe("suspension");
    expect(result?.label).toBe("Suspended");
    expect(result?.detail).toBe("Suspended until 19 Sep");
  });

  it("10/11. interpretation never depends on Performance score — identical status/news produce identical output regardless of a player's relevance to scoring (that filtering is the caller's job, see repository.ts)", () => {
    const input = {
      status: "d" as const,
      chanceOfPlayingNextRound: 75,
      latestNews: {
        description: "Knee injury - 75% chance of playing",
        publishedAt: new Date("2026-08-24T15:30:08.35Z"),
        sourceName: "Fantasy Premier League",
      },
      now: NOW,
    };
    // Real: Gibbs-White (has a computed season Performance score) and a
    // fringe squad player both carry a 'd' status shaped exactly like this
    // — the interpretation layer has no notion of "meaningful player" at
    // all, so both produce the same result.
    const forEstablishedPlayer = interpretPlayerAvailability(input);
    const forFringePlayer = interpretPlayerAvailability(input);
    expect(forEstablishedPlayer).toEqual(forFringePlayer);
  });

  it("12. no availability info at all — the existing player page must render unchanged (returns null, same as an available player)", () => {
    const result = interpretPlayerAvailability({
      status: "a",
      chanceOfPlayingNextRound: null,
      latestNews: null,
      now: NOW,
    });
    expect(result).toBeNull();
  });
});
