import { describe, expect, it } from "vitest";
import { buildTeamStory, computeTeamMomentum } from "../teamStory";
import type { MomentumMetric } from "@/lib/analytics/intelligence/types";

const noMomentum: MomentumMetric = { available: false, direction: "STABLE", magnitude: 0, label: "Not enough matches yet", explanation: "" };

describe("buildTeamStory", () => {
  it("uses early-days language and never claims an identity at Limited confidence", () => {
    const text = buildTeamStory({ name: "Arsenal", overallScore: 7.5, matchesPlayed: 1, confidence: "low", strengths: [], developmentAreas: [], momentum: noMomentum });
    expect(text).toContain("Early days");
    expect(text).toContain("Too early to say");
  });

  it("uses provisional language at Developing confidence", () => {
    const text = buildTeamStory({
      name: "Arsenal",
      overallScore: 7.0,
      matchesPlayed: 4,
      confidence: "moderate",
      strengths: [{ key: "defence", label: "Defensive contribution", score: 8 }],
      developmentAreas: [],
      momentum: noMomentum,
    });
    expect(text).toContain("emerging picture");
  });

  it("makes a confident, comparative claim at Established confidence with two strengths", () => {
    const text = buildTeamStory({
      name: "Arsenal",
      overallScore: 7.5,
      matchesPlayed: 10,
      confidence: "established",
      strengths: [
        { key: "defence", label: "defensive consistency", score: 8 },
        { key: "attack", label: "attacking output", score: 6 },
      ],
      developmentAreas: [],
      momentum: noMomentum,
    });
    expect(text).toContain("driven more by defensive consistency than attacking output");
  });

  it("mentions rising momentum only when available", () => {
    const rising: MomentumMetric = { available: true, direction: "RISING", magnitude: 1, label: "Rising", explanation: "" };
    const text = buildTeamStory({ name: "Arsenal", overallScore: 7.0, matchesPlayed: 10, confidence: "established", strengths: [], developmentAreas: [], momentum: rising });
    expect(text.toLowerCase()).toContain("trending upward");
  });
});

describe("computeTeamMomentum", () => {
  it("reports unavailable with fewer than 4 rated matches", () => {
    const m = computeTeamMomentum([7, 6, 5]);
    expect(m.available).toBe(false);
  });

  it("detects a rising trend when recent ratings are clearly above the season average", () => {
    const m = computeTeamMomentum([9, 9, 9, 3, 3, 3]);
    expect(m.available).toBe(true);
    expect(m.direction).toBe("RISING");
  });

  it("detects a falling trend when recent ratings are clearly below the season average", () => {
    const m = computeTeamMomentum([3, 3, 3, 9, 9, 9]);
    expect(m.direction).toBe("FALLING");
  });

  it("reports stable for consistent ratings", () => {
    const m = computeTeamMomentum([6.5, 6.4, 6.6, 6.5, 6.5]);
    expect(m.direction).toBe("STABLE");
  });
});
