/**
 * A club's primary shirt colour, for very restrained UI accents only (a
 * thin border, a small dot) — never a substitute for the crest, and never
 * allowed to dominate a component. Real public brand colours, not derived
 * from any data source; approximate where a club's identity isn't a single
 * clean hex (e.g. clubs playing in black or white get a dark neutral
 * instead of literal #000, so the accent stays visible on the canvas).
 *
 * Deliberately over-covers plausible Premier League/Championship clubs,
 * not just this season's 20, so promotion/relegation doesn't leave a team
 * with no accent. Anything still missing falls back to a neutral tone.
 */
const TEAM_COLOR: Record<string, string> = {
  ARS: "#EF0107",
  AVL: "#670E36",
  BHA: "#0057B8",
  BOU: "#DA291C",
  BRE: "#E30613",
  CHE: "#034694",
  COV: "#78D0F7",
  CRY: "#1B458F",
  EVE: "#003399",
  FUL: "#1A1A1A",
  HUL: "#F5A623",
  IPS: "#0044A9",
  LEE: "#1D428A",
  LEI: "#003090",
  LIV: "#C8102E",
  MCI: "#6CABDD",
  MUN: "#DA291C",
  NEW: "#1A1A1A",
  NFO: "#DD0000",
  NOR: "#FFF200",
  SOU: "#D71920",
  SUN: "#EB172B",
  TOT: "#132257",
  WAT: "#FBEE23",
  WBA: "#122F67",
  WHU: "#7A263A",
  WOL: "#FDB913",
};

const FALLBACK_COLOR = "#8B8A7F";

export function getTeamColor(shortName: string): string {
  return TEAM_COLOR[shortName] ?? FALLBACK_COLOR;
}
