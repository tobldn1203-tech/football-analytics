import { describe, expect, it } from "vitest";
import { buildWorthKnowingInsight } from "../worthKnowing";
import type { PlayerAvailability } from "../types";
import { classifySampleConfidence, qualityLabelFor, type RankedPlayer } from "@/lib/analytics/scoring/types";
import type { NewsCategory } from "@/lib/ingestion/fpl/ingestPlayerNews";

function mkPlayer(id: string, name: string, overall: number, matches = 1): RankedPlayer {
  return {
    playerId: id,
    slug: id,
    name,
    teamShortName: "HUL",
    position: "MID",
    sample: { matches, minutes: matches * 90, confidence: classifySampleConfidence(matches) },
    scores: { overall },
    qualityLabel: qualityLabelFor(overall),
    photoUrl: null,
    teamCrestUrl: null,
  };
}

function mkAvailability(category: NewsCategory, state: "unavailable" | "doubtful" = "unavailable"): PlayerAvailability {
  const label = { injury: "Injured", suspension: "Suspended", transfer: "No longer at the club", availability: "Doubtful", general: "Update" }[category];
  return { state, category, label, detail: null, chanceOfPlayingNextRound: state === "doubtful" ? 75 : null, updatedAt: null, sourceName: "Fantasy Premier League" };
}

const FORBIDDEN_PHRASES = ["because", "caused", "will miss", "ruled out for", "as a result of", "which explains"];

describe("buildWorthKnowingInsight", () => {
  it("no players at all → null", () => {
    expect(buildWorthKnowingInsight("Hull City", [], new Map())).toBeNull();
  });

  it("supported club with no noteworthy availability → null", () => {
    const players = [mkPlayer("a", "Ajayi", 8.2), mkPlayer("b", "Mendy", 8.7)];
    expect(buildWorthKnowingInsight("Hull City", players, new Map())).toBeNull();
  });

  it("one strong performer doubtful (not the club's top) → 'one_strong'", () => {
    const players = [mkPlayer("top", "Best Player", 9.0), mkPlayer("b", "Mendy", 8.7)];
    const map = new Map([["b", mkAvailability("availability", "doubtful")]]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("one_strong");
    expect(insight?.headline).toContain("Mendy");
    expect(insight?.headline).toContain("Hull City");
    expect(insight?.players).toHaveLength(1);
  });

  it("club's highest-rated player unavailable, alone → 'top_performer_single'", () => {
    const players = [mkPlayer("top", "Ajayi", 9.0, 5), mkPlayer("b", "Someone Else", 6.0, 5)];
    const map = new Map([["top", mkAvailability("injury")]]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("top_performer_single");
    expect(insight?.headline).toBe("Hull City's highest-rated performer this season, Ajayi, is currently injured.");
  });

  it("two strong performers doubtful, including the top → 'top_performer_multiple'", () => {
    const players = [mkPlayer("top", "Mendy", 8.7, 5), mkPlayer("b", "Ajayi", 8.2, 5), mkPlayer("c", "Fringe", 5.0, 5)];
    const map = new Map([
      ["top", mkAvailability("availability", "doubtful")],
      ["b", mkAvailability("availability", "doubtful")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("top_performer_multiple");
    expect(insight?.headline).toContain("Two of Hull City's best performers");
    expect(insight?.headline).toContain("Mendy");
    expect(insight?.players.map((p) => p.name).sort()).toEqual(["Ajayi", "Mendy"]);
  });

  it("several (3+) strong performers affected uses 'Several'", () => {
    const players = [
      mkPlayer("a", "A", 6.0, 5),
      mkPlayer("b", "B", 6.5, 5),
      mkPlayer("c", "C", 7.0, 5),
      mkPlayer("d", "D", 5.6, 5),
    ];
    const map = new Map([
      ["a", mkAvailability("injury")],
      ["b", mkAvailability("injury")],
      ["c", mkAvailability("injury")],
      ["d", mkAvailability("injury")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.headline.startsWith("Several of")).toBe(true);
    expect(insight?.players).toHaveLength(4);
  });

  it("affected player with no Performance score (not in the players array at all) is silently ignored", () => {
    const players = [mkPlayer("a", "A", 8.0, 5)];
    const map = new Map([
      ["a", mkAvailability("injury")],
      ["ghost-not-ranked", mkAvailability("injury")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.players.map((p) => p.playerId)).toEqual(["a"]);
  });

  it("fringe player with news but no meaningful intelligence (below 'Good' AND low confidence) does not surface", () => {
    const players = [mkPlayer("a", "Fringe", 4.5, 1)]; // below 5.5, only 1 match => confidence "low"
    const map = new Map([["a", mkAvailability("injury")]]);
    expect(buildWorthKnowingInsight("Hull City", players, map)).toBeNull();
  });

  it("a meaningful (but not 'strong') player with an established sample DOES surface, softly", () => {
    const players = [mkPlayer("a", "Squad Player", 4.5, 5)]; // below 5.5, but confidence !== low
    const map = new Map([["a", mkAvailability("injury")]]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("meaningful_player");
    expect(insight?.headline).toBe("Squad Player, who has featured for Hull City this season, is currently injured.");
    // Deliberately no superlative/"best"/"top" language for this tier.
    expect(insight?.headline).not.toMatch(/best|highest-rated|standout|star/i);
  });

  it("suspended player — factual, no superlative language forced onto it", () => {
    const players = [mkPlayer("top", "Gomes", 8.0, 5), mkPlayer("b", "Other", 6.0, 5)];
    const map = new Map([["top", mkAvailability("suspension")]]);
    const insight = buildWorthKnowingInsight("Aston Villa", players, map);
    expect(insight?.headline).toBe("Aston Villa's highest-rated performer this season, Gomes, is currently suspended.");
  });

  it("transferred player — 'no longer at the club', never implies injury/suspension", () => {
    const players = [mkPlayer("top", "Digne", 7.0, 5), mkPlayer("b", "Other", 6.0, 5)];
    const map = new Map([["top", mkAvailability("transfer")]]);
    const insight = buildWorthKnowingInsight("Aston Villa", players, map);
    expect(insight?.headline).toContain("no longer at the club");
  });

  it("multiple statuses at once — mixed categories fall back to a neutral shared phrase, never a wrong specific one", () => {
    const players = [mkPlayer("top", "A", 8.0, 5), mkPlayer("b", "B", 7.5, 5)];
    const map = new Map([
      ["top", mkAvailability("injury")],
      ["b", mkAvailability("suspension")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.headline).toContain("fitness or availability concerns");
    expect(insight?.headline).not.toContain("injured"); // doesn't wrongly claim uniform injury
    expect(insight?.headline).not.toContain("suspended"); // doesn't wrongly claim uniform suspension
  });

  it("low-confidence / very early season — a technical #1 by a tiny one-match margin is NOT called 'highest-rated'", () => {
    // Mirrors the real GW1 scenario this feature was built for: single-match
    // sample, technically ranked #1, but not confidently "the" best player yet.
    const players = [mkPlayer("top", "Mendy", 8.7, 1), mkPlayer("b", "Ajayi", 8.2, 1)];
    const map = new Map([
      ["top", mkAvailability("availability", "doubtful")],
      ["b", mkAvailability("availability", "doubtful")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    // Still surfaces (both clear the "strong" bar) but without a superlative claim.
    expect(insight?.tier).toBe("multiple_strong");
    expect(insight?.headline).not.toMatch(/highest-rated|their best|star/i);
    expect(insight?.headline).toContain("Two of Hull City's strongest performers");
  });

  it("single low-confidence top performer alone → downgraded to 'one_strong', no superlative claim", () => {
    const players = [mkPlayer("top", "Mendy", 8.7, 1), mkPlayer("b", "Ajayi", 6.0, 1)];
    const map = new Map([["top", mkAvailability("availability", "doubtful")]]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("one_strong");
    expect(insight?.headline).not.toContain("highest-rated");
  });

  it("deterministic output — identical input produces an identical result, including any voice line", () => {
    const players = [mkPlayer("top", "Mendy", 8.7, 5), mkPlayer("b", "Ajayi", 8.2, 5)];
    const map = new Map([
      ["top", mkAvailability("availability", "doubtful")],
      ["b", mkAvailability("availability", "doubtful")],
    ]);
    const first = buildWorthKnowingInsight("Hull City", players, map);
    const second = buildWorthKnowingInsight("Hull City", players, map);
    expect(first).toEqual(second);
  });

  it("no unsupported causal/certainty claims in any generated headline", () => {
    const scenarios: Array<[RankedPlayer[], Map<string, PlayerAvailability>]> = [
      [[mkPlayer("a", "A", 8.0, 5)], new Map([["a", mkAvailability("injury")]])],
      [
        [mkPlayer("a", "A", 8.0, 5), mkPlayer("b", "B", 7.5, 5)],
        new Map([
          ["a", mkAvailability("availability", "doubtful")],
          ["b", mkAvailability("suspension")],
        ]),
      ],
      [[mkPlayer("a", "A", 7.0, 5)], new Map([["a", mkAvailability("transfer")]])],
    ];
    for (const [players, map] of scenarios) {
      const insight = buildWorthKnowingInsight("Hull City", players, map);
      if (!insight) continue;
      const lower = insight.headline.toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(lower).not.toContain(phrase);
      }
    }
  });

  it("never references a specific past match, opponent, or date — this is current context, not Match Centre history", () => {
    const players = [mkPlayer("top", "Mendy", 8.7, 5), mkPlayer("b", "Ajayi", 8.2, 5)];
    const map = new Map([
      ["top", mkAvailability("availability", "doubtful")],
      ["b", mkAvailability("availability", "doubtful")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.headline).not.toMatch(/\bvs\b|\bwhen\b|played against/i);
  });

  it("voice line never fires for a suspension-only affected group", () => {
    const players = [mkPlayer("top", "A", 8.0, 5), mkPlayer("b", "B", 7.5, 5)];
    const map = new Map([
      ["top", mkAvailability("suspension")],
      ["b", mkAvailability("suspension")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("top_performer_multiple");
    expect(insight?.voice).toBeNull();
  });

  it("voice line CAN fire for the strongest tier when categories are eligible (injury/doubtful/transfer)", () => {
    const players = [mkPlayer("top", "A", 8.0, 5), mkPlayer("b", "B", 7.5, 5)];
    const map = new Map([
      ["top", mkAvailability("availability", "doubtful")],
      ["b", mkAvailability("injury")],
    ]);
    const insight = buildWorthKnowingInsight("Hull City", players, map);
    expect(insight?.tier).toBe("top_performer_multiple");
    expect(insight?.voice).not.toBeNull();
    expect(insight?.voice?.evidence).toBeTruthy(); // always-present factual evidence alongside any humour
  });
});
