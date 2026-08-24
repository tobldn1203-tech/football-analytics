import { fetchFootballersByBirthDate, type WikidataFootballerCandidate } from "./wikidataClient";

/**
 * NATIONALITY MATCHING — reliability-first by design
 * ==========================================================================
 * Why not FPL's own `region` field? FPL's bootstrap payload includes an
 * undocumented integer `region` per player, but there is no official,
 * published mapping from that integer to a country — any mapping we could
 * build would be guesswork (a handful of players we happen to recognise,
 * extrapolated). We deliberately do not use it. See docs and the PR/commit
 * introducing this feature for the fuller investigation.
 *
 * Why Wikidata? Its content is CC0/public domain — no licensing ambiguity,
 * unlike football-specific data APIs (football-data.org gates player
 * detail behind a paid plan; API-Football/API-Sports explicitly disclaim
 * providing any licence to publish the data — see
 * https://www.api-football.com/terms). TheSportsDB's terms are usable but
 * murkier than Wikidata's unambiguous public-domain dedication.
 * https://www.wikidata.org/wiki/Wikidata:Licensing
 *
 * Why P1532 ("country for sport") and not P27 ("country of citizenship")?
 * Football nationality and legal citizenship are different things for a
 * large fraction of Premier League players. Most visibly: an English
 * player's citizenship is "United Kingdom", not "England" — P27 would
 * therefore show the wrong flag (or an ambiguous one) for every English,
 * Scottish, Welsh and Northern Irish player, which is a lot of players in
 * this league. P1532 exists on Wikidata specifically to capture "the
 * country an athlete represents in competition" and correctly resolves
 * to England/Scotland/Wales/Northern Ireland where applicable, and to a
 * player's chosen international side for dual-citizenship cases. Verified
 * directly against real Premier League players before building this (see
 * commit history) — not assumed from documentation alone.
 *
 * Matching strategy: birth date is the primary filter, not name. Two
 * different real footballers can easily share a name ("Chris Wood" turned
 * up 3 unrelated Wikidata people during testing); almost none share an
 * exact birth date AND occupation "association football player". We query
 * Wikidata for every footballer born on the player's exact FPL birth date,
 * then require the FPL name to token-overlap meaningfully with that
 * candidate's label or English aliases before accepting a match — this
 * catches the (empirically confirmed) cases where Wikidata uses a shorter
 * public name (e.g. "Gabriel Magalhães") than FPL's full legal name
 * ("Gabriel dos Santos Magalhães").
 *
 * Every rejection path below results in `null` — no nationality set, no
 * flag shown — rather than a best-effort guess. That's intentional: the
 * brief for this feature is explicit that a missing flag is preferred over
 * a wrong one.
 */

/** Minimum overlapping name tokens (case/accent-insensitive) to accept a candidate. Chosen from real
 *  matches during development, which consistently had 2+ overlapping tokens; every non-match had 0. */
const MIN_TOKEN_OVERLAP = 2;

/** England/Scotland/Wales/Northern Ireland aren't sovereign states, so they have no ISO 3166-1 code
 *  (Wikidata's P297 is empty for them) — this is the complete, fixed set of UK football nations that
 *  can appear as a P1532 "country for sport" value; codes match the flag-icons npm package.
 *  Also covers a small number of confirmed cases where a sovereign state's Wikidata item is
 *  simply missing P297 (ISO 3166-1 alpha-2) even though the code itself is not in doubt at all
 *  — found empirically (e.g. Jurriën Timber's "Netherlands" P1532 target had no P297 set) rather
 *  than added speculatively; extend only when a real, confirmed gap like this turns up. */
const KNOWN_COUNTRY_CODES: Record<string, string> = {
  England: "gb-eng",
  Scotland: "gb-sct",
  Wales: "gb-wls",
  "Northern Ireland": "gb-nir",
  Netherlands: "nl",
};

function normalizeTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1)
  );
}

export interface NationalityMatch {
  /** Display name, e.g. "England", "Spain" — as returned by Wikidata's English label. */
  country: string;
  /** flag-icons code, e.g. "gb-eng", "es". */
  code: string;
}

/** Resolves a flag-icons code for a P1532 "country for sport" candidate — ISO code when the
 *  country has one, the fixed home-nation lookup when it doesn't, or null if neither resolves
 *  (e.g. a non-ISO territory outside the four UK nations — rare, and we don't guess codes). */
function resolveCode(countryForSport: string, iso2: string | null): string | null {
  if (iso2) return iso2.toLowerCase();
  return KNOWN_COUNTRY_CODES[countryForSport] ?? null;
}

/**
 * Attempts to find this player's football nationality. Returns null on any
 * kind of uncertainty: no candidates, no candidate names the player
 * strongly enough, multiple candidates match equally well, or the best
 * candidate has no `country for sport` value on Wikidata at all.
 */
export async function matchNationality(player: {
  firstName: string;
  lastName: string;
  webName: string;
  birthDate: string;
}): Promise<NationalityMatch | null> {
  const candidates = await fetchFootballersByBirthDate(player.birthDate);
  return pickBestMatch(player, candidates);
}

/**
 * The pure decision logic, separated from the network call so it can be
 * unit-tested against fabricated candidate lists — see __tests__/match.test.ts.
 */
export function pickBestMatch(
  player: { firstName: string; lastName: string; webName: string },
  candidates: WikidataFootballerCandidate[]
): NationalityMatch | null {
  if (candidates.length === 0) return null;

  const nameTokens = new Set([
    ...normalizeTokens(player.firstName),
    ...normalizeTokens(player.lastName),
    ...normalizeTokens(player.webName),
  ]);

  const scored = candidates
    .map((c) => ({ candidate: c, overlap: overlapCount(nameTokens, c) }))
    .filter((s) => s.overlap >= MIN_TOKEN_OVERLAP)
    .sort((a, b) => b.overlap - a.overlap);

  if (scored.length === 0) return null;
  // Ambiguous: more than one distinct person matches equally well — refuse
  // to guess which one is the real player rather than pick arbitrarily.
  if (scored.length > 1 && scored[1].overlap === scored[0].overlap) return null;

  const best = scored[0].candidate;
  if (!best.countryForSport) return null;

  const code = resolveCode(best.countryForSport, best.countryForSportIso2);
  if (!code) return null;

  return { country: best.countryForSport, code };
}

function overlapCount(nameTokens: Set<string>, candidate: WikidataFootballerCandidate): number {
  const candidateTokens = new Set([
    ...normalizeTokens(candidate.label),
    ...candidate.altLabels.flatMap((a) => [...normalizeTokens(a)]),
  ]);
  let count = 0;
  for (const t of nameTokens) if (candidateTokens.has(t)) count++;
  return count;
}
