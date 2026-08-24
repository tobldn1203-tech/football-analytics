import {
  FplBootstrapSchema,
  FplFixtureSchema,
  FplEventLiveSchema,
  type FplBootstrap,
  type FplFixture,
  type FplEventLive,
} from "./types";

const BASE_URL = "https://fantasy.premierleague.com/api";

/**
 * This is an unofficial, undocumented public API (see docs/DATA_SOURCES.md)
 * — there is no SLA. Every response is validated with Zod so a breaking
 * upstream change fails loudly at the provider boundary instead of silently
 * corrupting ingested data.
 */
async function fplFetch<T>(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FPL request failed (${path}): HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchFplBootstrap(): Promise<FplBootstrap> {
  const json = await fplFetch("/bootstrap-static/");
  return FplBootstrapSchema.parse(json);
}

/** All fixtures for the season — finished ones include per-fixture event attribution. */
export async function fetchFplFixtures(): Promise<FplFixture[]> {
  const json = await fplFetch("/fixtures/");
  return FplFixtureSchema.array().parse(json);
}

/** Every player's stat line for a single gameweek (minutes, xG/xA, defensive actions). */
export async function fetchFplEventLive(eventId: number): Promise<FplEventLive> {
  const json = await fplFetch(`/event/${eventId}/live/`);
  return FplEventLiveSchema.parse(json);
}
