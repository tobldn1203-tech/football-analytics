/**
 * A thin client over Wikidata's public SPARQL endpoint — used only by the
 * nationality enrichment script (scripts/enrich-nationality.ts), never at
 * request time. Wikidata's content is CC0 (public domain) — see
 * https://www.wikidata.org/wiki/Wikidata:Licensing — so there's no
 * licensing ambiguity, unlike the football data APIs considered and
 * rejected for this feature (see that script's header comment for why).
 */

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
// Wikidata's own usage guidance asks for a descriptive User-Agent
// identifying the project — see https://meta.wikimedia.org/wiki/User-Agent_policy.
const USER_AGENT = "football-analytics-nationality-enrichment/1.0 (personal, non-commercial project)";

export interface WikidataFootballerCandidate {
  id: string;
  label: string;
  altLabels: string[];
  /** Wikidata P1532 "country for sport" — the country a player represents
   *  internationally, which is what football fans mean by "nationality"
   *  (distinct from P27 legal citizenship — see the module comment in
   *  match.ts for why citizenship alone isn't used). */
  countryForSport: string | null;
  /** ISO 3166-1 alpha-2 code of the country-for-sport entity, when it has
   *  one (sovereign states only — England/Scotland/Wales/Northern Ireland
   *  don't, see match.ts's HOME_NATION_CODES). */
  countryForSportIso2: string | null;
}

/**
 * All Wikidata people with occupation "association football player"
 * (Q937857) born on an exact date. Birth date is an unusually strong
 * filter for this purpose — see the module comment in match.ts for why
 * this, rather than name matching, is the primary key.
 */
export async function fetchFootballersByBirthDate(
  birthDate: string
): Promise<WikidataFootballerCandidate[]> {
  const query = `
    SELECT ?person ?personLabel ?altLabel ?countryForSportLabel ?countryForSportIso2 WHERE {
      ?person wdt:P106 wd:Q937857;
              wdt:P569 "${birthDate}T00:00:00Z"^^xsd:dateTime.
      OPTIONAL {
        ?person wdt:P1532 ?countryForSport.
        OPTIONAL { ?countryForSport wdt:P297 ?countryForSportIso2. }
      }
      OPTIONAL { ?person skos:altLabel ?altLabel. FILTER(LANG(?altLabel) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) {
    throw new Error(`Wikidata query failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    results: {
      bindings: Array<{
        person: { value: string };
        personLabel?: { value: string };
        altLabel?: { value: string };
        countryForSportLabel?: { value: string };
        countryForSportIso2?: { value: string };
      }>;
    };
  };

  const byPerson = new Map<string, WikidataFootballerCandidate>();
  for (const b of data.results.bindings) {
    const id = b.person.value;
    let candidate = byPerson.get(id);
    if (!candidate) {
      candidate = {
        id,
        label: b.personLabel?.value ?? "",
        altLabels: [],
        countryForSport: b.countryForSportLabel?.value ?? null,
        countryForSportIso2: b.countryForSportIso2?.value ?? null,
      };
      byPerson.set(id, candidate);
    }
    if (b.altLabel && !candidate.altLabels.includes(b.altLabel.value)) {
      candidate.altLabels.push(b.altLabel.value);
    }
  }
  return [...byPerson.values()];
}
