import { describe, expect, it } from "vitest";
import { pickDefaultGameweek, type GameweekWindow } from "../currentGameweek";

// Real gameweek date shape observed against the live 2026/27 fixture list —
// a Sat/Sun/Mon-ish spread per gameweek, several days' gap to the next one.
const GW1: GameweekWindow = {
  gameweek: 1,
  earliestKickoff: new Date("2026-08-21T19:00:00Z"),
  latestKickoff: new Date("2026-08-24T19:00:00Z"),
};
const GW2: GameweekWindow = {
  gameweek: 2,
  earliestKickoff: new Date("2026-08-28T19:00:00Z"),
  latestKickoff: new Date("2026-08-31T19:00:00Z"),
};
const GW3: GameweekWindow = {
  gameweek: 3,
  earliestKickoff: new Date("2026-09-04T19:00:00Z"),
  latestKickoff: new Date("2026-09-06T15:30:00Z"),
};

describe("pickDefaultGameweek", () => {
  it("1. current/in-progress gameweek — now falls inside its kickoff window", () => {
    // Real case this was built to fix: GW2's opener kicked off 19:00 UTC
    // on 2026-08-28; checked live at 23:20 UTC the same day, still well
    // inside GW2's window (its last kickoff isn't until the 31st).
    const now = new Date("2026-08-28T23:20:00Z");
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(2);
  });

  it("1b. in-progress allowance — now is just after the gameweek's LAST kickoff, that match is presumably still being played", () => {
    // GW3's last kickoff is 2026-09-06T15:30Z; checked 1 hour later, well
    // within a match's realistic playing time.
    const now = new Date("2026-09-06T16:30:00Z");
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(3);
  });

  it("2. nearest upcoming gameweek — no gameweek in progress, the next one is closer than the last completed one", () => {
    // Between GW2 (ended 31 Aug + allowance ≈ 22:00) and GW3 (starts 4
    // Sep), but much closer to GW3's start.
    const now = new Date("2026-09-04T10:00:00Z");
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(3);
  });

  it("3. nearest completed gameweek — closer to the one that just finished than to the next one", () => {
    const now = new Date("2026-09-01T00:00:00Z"); // just after GW2 ended, days before GW3 starts
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(2);
  });

  it("4. exactly/effectively between two gameweeks — ties resolve to the upcoming one", () => {
    // Midpoint between GW2's last kickoff and GW3's first — distance for a
    // completed gameweek is measured from its raw last kickoff (by the
    // time a gameweek falls into this branch at all, `now` is already
    // guaranteed past its in-progress allowance, so the two never conflict).
    const midpoint = new Date((GW2.latestKickoff.getTime() + GW3.earliestKickoff.getTime()) / 2);
    // A tick before the midpoint should still favour the (barely) nearer
    // completed gameweek...
    expect(pickDefaultGameweek([GW1, GW2, GW3], new Date(midpoint.getTime() - 1))).toBe(2);
    // ...and a tick after should favour the (barely) nearer upcoming one.
    expect(pickDefaultGameweek([GW1, GW2, GW3], new Date(midpoint.getTime() + 1))).toBe(3);
    // An exact tie explicitly prefers upcoming.
    const tiedNow = new Date(
      GW2.latestKickoff.getTime() + ((GW3.earliestKickoff.getTime() - GW2.latestKickoff.getTime()) / 2)
    );
    const distanceToGw2 = tiedNow.getTime() - GW2.latestKickoff.getTime();
    const distanceToGw3 = GW3.earliestKickoff.getTime() - tiedNow.getTime();
    expect(distanceToGw2).toBe(distanceToGw3); // sanity: genuinely tied
    expect(pickDefaultGameweek([GW1, GW2, GW3], tiedNow)).toBe(3);
  });

  it("5. a gameweek with only postponed/unplayed fixtures is still eligible purely on its dates — the picker never looks at status", () => {
    // pickDefaultGameweek's input has no status field at all: a gameweek
    // that's 0% finished is exactly as eligible as one that's 100%
    // finished, provided its dates are the closest to now. Demonstrated
    // here by GW3 being selected purely because `now` sits inside its
    // window — nothing about "finished" ever enters the calculation.
    const now = new Date("2026-09-05T12:00:00Z");
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(3);
  });

  it("5b. a stale, still-unfinished old gameweek never hijacks selection from a date-current one", () => {
    // GW1 here stands in for a gameweek with a postponed fixture that
    // still hasn't been played weeks later — its dates are what matter,
    // not whether every fixture in it has a final score.
    const now = new Date("2026-08-29T12:00:00Z"); // inside GW2's window
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(2);
  });

  it("7. season-start behaviour — before a ball has been kicked, the only/first gameweek is the default", () => {
    const now = new Date("2026-08-15T00:00:00Z"); // a week before GW1 begins
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(1);
  });

  it("8. end-of-season behaviour — after the last gameweek, it remains the default (nothing further to be nearer to)", () => {
    const now = new Date("2026-09-10T00:00:00Z"); // well after GW3, no GW4 in this fixture set
    expect(pickDefaultGameweek([GW1, GW2, GW3], now)).toBe(3);
  });

  it("returns null when there are no gameweeks at all", () => {
    expect(pickDefaultGameweek([], new Date())).toBeNull();
  });

  it("a single-fixture gameweek (min and max kickoff identical) still works", () => {
    const single: GameweekWindow = {
      gameweek: 10,
      earliestKickoff: new Date("2026-11-07T15:00:00Z"),
      latestKickoff: new Date("2026-11-07T15:00:00Z"),
    };
    expect(pickDefaultGameweek([single], new Date("2026-11-07T16:00:00Z"))).toBe(10);
  });
});
