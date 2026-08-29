import { describe, expect, it } from "vitest";
import { explainPlayer } from "../explain";
import type { RankedPlayer } from "../types";

function makePlayer(
  scores: Partial<RankedPlayer["scores"]>,
  overrides: Partial<RankedPlayer> = {}
): RankedPlayer {
  return {
    playerId: "1",
    slug: "player",
    name: "Player",
    teamId: "team-tma",
    teamShortName: "TMA",
    position: "DEF",
    sample: { matches: 10, minutes: 900, confidence: "established" },
    scores,
    qualityLabel: "Very good",
    photoUrl: null,
    teamCrestUrl: null,
    ...overrides,
  };
}

const STRONG_ALL_ROUND = { attack: 9.6, creation: 9.2, defence: 6.0, impact: 9.8, form: 8.0 };

describe("explainPlayer — confidence-gated strength language", () => {
  it("never uses strong categorical claims (Elite/Excellent/Strong/Solid) at Limited confidence", () => {
    // De Cuyper-shaped case from the audit: a defender, one match, a goal + assist.
    const player = makePlayer(STRONG_ALL_ROUND, {
      sample: { matches: 1, minutes: 77, confidence: "low" },
    });
    const { headline, strengths } = explainPlayer(player);

    expect(strengths.length).toBeGreaterThan(0);
    for (const s of strengths) {
      expect(s.title).not.toMatch(/elite|excellent|strong|solid/i);
      expect(s.description).not.toMatch(/elite|excellent|strong|solid/i);
      expect(s.title).toMatch(/^Early /);
    }
    expect(headline).not.toMatch(/driven mainly by/i);
    expect(headline).toMatch(/early days/i);
  });

  it("acknowledges the match count in the softened strength description", () => {
    const player = makePlayer(STRONG_ALL_ROUND, {
      sample: { matches: 1, minutes: 45, confidence: "low" },
    });
    const { strengths } = explainPlayer(player);
    for (const s of strengths) {
      expect(s.description).toMatch(/1 match/i);
      expect(s.description).toMatch(/not yet/i);
    }
  });

  it("allows normal strength language once confidence reaches Developing", () => {
    const player = makePlayer(STRONG_ALL_ROUND, {
      sample: { matches: 4, minutes: 360, confidence: "moderate" },
    });
    const { strengths } = explainPlayer(player);
    expect(strengths.some((s) => /elite|excellent/i.test(s.description))).toBe(true);
    expect(strengths.every((s) => !s.title.startsWith("Early"))).toBe(true);
  });

  it("gives Established players full-confidence strength language and a causal headline", () => {
    const player = makePlayer(STRONG_ALL_ROUND, {
      sample: { matches: 12, minutes: 1000, confidence: "established" },
    });
    const { headline, strengths } = explainPlayer(player);
    expect(headline).toMatch(/driven mainly by/i);
    expect(strengths.some((s) => /elite/i.test(s.description))).toBe(true);
  });

  it("does not mutate the player's underlying category scores", () => {
    const scores = { ...STRONG_ALL_ROUND };
    const player = makePlayer(scores, { sample: { matches: 1, minutes: 45, confidence: "low" } });
    explainPlayer(player);
    expect(player.scores).toEqual(STRONG_ALL_ROUND);
  });

  it("stays safe with missing category scores at Limited confidence", () => {
    const player = makePlayer(
      { attack: undefined, creation: undefined, defence: undefined, impact: undefined },
      { sample: { matches: 1, minutes: 20, confidence: "low" } }
    );
    expect(() => explainPlayer(player)).not.toThrow();
    const { strengths } = explainPlayer(player);
    expect(strengths).toHaveLength(0);
  });
});
