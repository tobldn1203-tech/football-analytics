import { describe, expect, it } from "vitest";
import { pickBestMatch } from "../match";
import type { WikidataFootballerCandidate } from "../wikidataClient";

function candidate(overrides: Partial<WikidataFootballerCandidate>): WikidataFootballerCandidate {
  return {
    id: "https://www.wikidata.org/entity/Q0",
    label: "",
    altLabels: [],
    countryForSport: null,
    countryForSportIso2: null,
    ...overrides,
  };
}

describe("pickBestMatch", () => {
  it("matches on a strong name overlap and returns the sport nationality", () => {
    const result = pickBestMatch(
      { firstName: "Bukayo", lastName: "Saka", webName: "Saka" },
      [candidate({ label: "Bukayo Saka", countryForSport: "England", countryForSportIso2: null })]
    );
    expect(result).toEqual({ country: "England", code: "gb-eng" });
  });

  it("matches a shorter public name against FPL's longer legal name via token overlap", () => {
    const result = pickBestMatch(
      { firstName: "David", lastName: "Raya Martín", webName: "Raya" },
      [candidate({ label: "David Raya", countryForSport: "Spain", countryForSportIso2: "ES" })]
    );
    expect(result).toEqual({ country: "Spain", code: "es" });
  });

  it("resolves ISO 3166-1 codes for sovereign countries", () => {
    const result = pickBestMatch(
      { firstName: "Erling", lastName: "Haaland", webName: "Haaland" },
      [candidate({ label: "Erling Haaland", countryForSport: "Norway", countryForSportIso2: "NO" })]
    );
    expect(result?.code).toBe("no");
  });

  it("resolves the fixed home-nation codes when there is no ISO code", () => {
    for (const [country, code] of [
      ["England", "gb-eng"],
      ["Scotland", "gb-sct"],
      ["Wales", "gb-wls"],
      ["Northern Ireland", "gb-nir"],
      // Not a UK nation, but a confirmed real gap in Wikidata's own data —
      // see the KNOWN_COUNTRY_CODES comment in match.ts.
      ["Netherlands", "nl"],
    ] as const) {
      const result = pickBestMatch(
        { firstName: "Test", lastName: "Player", webName: "Player" },
        [candidate({ label: "Test Player", countryForSport: country, countryForSportIso2: null })]
      );
      expect(result?.code).toBe(code);
    }
  });

  it("returns null when no candidate shares the player's name at all", () => {
    const result = pickBestMatch(
      { firstName: "Chris", lastName: "Wood", webName: "Wood" },
      [
        candidate({ label: "Someone Else", countryForSport: "France", countryForSportIso2: "FR" }),
        candidate({ label: "Another Person", countryForSport: "Germany", countryForSportIso2: "DE" }),
      ]
    );
    expect(result).toBeNull();
  });

  it("returns null when multiple different people match the name equally well (ambiguous)", () => {
    const result = pickBestMatch(
      { firstName: "Chris", lastName: "Wood", webName: "Wood" },
      [
        candidate({ label: "Chris Wood", countryForSport: "New Zealand", countryForSportIso2: "NZ" }),
        candidate({ id: "https://www.wikidata.org/entity/Q1", label: "Chris Wood", countryForSport: "England", countryForSportIso2: null }),
      ]
    );
    expect(result).toBeNull();
  });

  it("returns null when the best-matching candidate has no country-for-sport value", () => {
    const result = pickBestMatch(
      { firstName: "Bukayo", lastName: "Saka", webName: "Saka" },
      [candidate({ label: "Bukayo Saka", countryForSport: null })]
    );
    expect(result).toBeNull();
  });

  it("returns null when the country has neither an ISO code nor a known home-nation code", () => {
    const result = pickBestMatch(
      { firstName: "Test", lastName: "Player", webName: "Player" },
      [candidate({ label: "Test Player", countryForSport: "Kosovo", countryForSportIso2: null })]
    );
    expect(result).toBeNull();
  });

  it("returns null when there are no candidates at all", () => {
    expect(pickBestMatch({ firstName: "Nobody", lastName: "Here", webName: "Here" }, [])).toBeNull();
  });

  it("matches accented names correctly (diacritic-insensitive)", () => {
    const result = pickBestMatch(
      { firstName: "Martin", lastName: "Ødegaard", webName: "Ødegaard" },
      [candidate({ label: "Martin Ødegaard", countryForSport: "Norway", countryForSportIso2: "NO" })]
    );
    expect(result?.country).toBe("Norway");
  });
});
