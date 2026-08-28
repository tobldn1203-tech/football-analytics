import { describe, expect, it } from "vitest";
import { describeWorthKnowingVoice } from "../insightVoice";

describe("describeWorthKnowingVoice", () => {
  it("only ever fires for the 'top_performer_multiple' tier", () => {
    const input = { tier: "multiple_strong", teamName: "Hull City", players: [{ name: "A", category: "injury" as const }, { name: "B", category: "injury" as const }] };
    expect(describeWorthKnowingVoice(input)).toBeNull();
  });

  it("fires for 'top_performer_multiple' with eligible categories", () => {
    const result = describeWorthKnowingVoice({
      tier: "top_performer_multiple",
      teamName: "Hull City",
      players: [{ name: "Mendy", category: "availability" }, { name: "Ajayi", category: "injury" }],
    });
    expect(result).not.toBeNull();
    expect(result?.level).toBe(3);
    expect(result?.evidence).toBeTruthy(); // always-present factual line
  });

  it("never fires when a suspension is part of the group — a disciplinary matter, not misfortune", () => {
    const result = describeWorthKnowingVoice({
      tier: "top_performer_multiple",
      teamName: "Hull City",
      players: [{ name: "Mendy", category: "suspension" }, { name: "Ajayi", category: "injury" }],
    });
    expect(result).toBeNull();
  });

  it("is deterministic — same input always returns the same observation", () => {
    const input = { tier: "top_performer_multiple", teamName: "Hull City", players: [{ name: "Mendy", category: "availability" as const }] };
    expect(describeWorthKnowingVoice(input)).toEqual(describeWorthKnowingVoice(input));
  });

  it("returns null for an empty player list", () => {
    expect(describeWorthKnowingVoice({ tier: "top_performer_multiple", teamName: "Hull City", players: [] })).toBeNull();
  });
});
