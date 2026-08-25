# Player Availability Intelligence — Implementation

Phase B of `docs/NEWS_CONTEXT_PRODUCT_DESIGN.md`. Delivers a single, factual
availability indicator on the player page, backed by a reusable repository
primitive. No scoring, Player Intelligence, Match Rating, Team Intelligence,
or Archetype code was touched.

## 1. What FPL actually provides

Verified against the live 2026/27 API on 2026-08-25 (612 players):

| Field | What it actually is |
|---|---|
| `status` | `a` (494 players) / `i` injured (55) / `d` doubtful (21) / `u` left the club (41) / `s` suspended (1). Refreshed on every ingestion — always "as of now". |
| `chance_of_playing_next_round` | A number FPL itself sets. Distribution: `null` (454), `0` (97), `25` (1), `50` (3), `75` (17), `100` (40). |
| `news` | FPL's own short editorial note. Empty for available players; always populated for the 118 non-available players checked. |
| `news_added` | Timestamp the note was last set/changed. |

## 2. How `chance_of_playing_next_round` works

Investigated by cross-tabulating every live value against `status`, and by
comparing every doubtful player's structured percentage against their free
text, before writing any interpretation code:

- **`status: i` (injured) → `chance` is always exactly 0.** 55/55, no exceptions.
- **`status: u` (left the club) → `chance` is always exactly 0.** 41/41.
- **`status: s` (suspended) → `chance` is always exactly 0.** 1/1.
- **`status: a` (available) → `chance` is either `null` (the vast majority) or exactly `100`** (40 players — apparently a residual value lingering after a recent return, since FPL doesn't always clear it back to null). Functionally identical either way: "no concern on file."
- **`status: d` (doubtful) → the only status where `chance` is graded: 25, 50, or 75.** This is the one place the field carries information `status` alone doesn't.
- **Text vs. structured field: checked all 21 doubtful players — 21/21 exact matches** between the percentage in FPL's own `news` text (e.g. "Thigh injury - 75% chance of playing") and the `chance_of_playing_next_round` value. Zero disagreements found anywhere in the dataset (also checked: no available player has non-empty news; no injured player's text mentions a percentage despite `chance=0`).

**Conclusion: `chance_of_playing_next_round` is reliable and used directly** — never re-derived by parsing the `news` string, never independently estimated. Its only real product value is refining "doubtful" into a graded percentage; for every other status it is fully redundant with `status` and is not surfaced (showing "0% chance of playing" next to "Injured" would be noise, not information).

It is now persisted on `Player.chanceOfPlayingNextRound` (new nullable `Int?` column, additive migration `20260825191139_add_chance_of_playing_next_round`) and written by `ingestPlayers.ts` alongside `status`, reusing the same already-fetched bootstrap payload — no new API call.

## 3. How availability is interpreted

`lib/analytics/availability/interpret.ts` — a small, pure function,
`interpretPlayerAvailability()`, fully covered by
`lib/analytics/availability/__tests__/interpret.test.ts` (15 tests, mostly
built from real current-season values rather than synthetic ones).

Only two visible states exist — **`unavailable`** (`status` ∈ {i, s, u}) and
**`doubtful`** (`status: d`). There is no "available" or "likely available"
state to render (see §5). The category (injury/suspension/transfer/
availability) is reused directly from the existing News Layer's
`classifyPlayerNews()` — no separate taxonomy was invented. Labels:

| Status | Label | Detail source |
|---|---|---|
| `i` | Injured | FPL's `news` text, verbatim, if fresh |
| `s` | Suspended | FPL's `news` text, verbatim (dated facts don't go stale — see §4) |
| `u` | No longer at the club | FPL's `news` text, verbatim (permanent fact — doesn't go stale) |
| `d` | Doubtful | FPL's `news` text if fresh, else "Doubtful — N% chance of playing next match" built from the structured field |

FPL's free text is never parsed, paraphrased, or used to derive a medical
interpretation — it's shown exactly as FPL wrote it, or not shown at all.

## 4. How freshness is handled

`status`/`chance_of_playing_next_round` are never freshness-gated — they're
overwritten on every ingestion run, so they're authoritative for "now" by
construction. Only the **free-text explanation** can go stale, and only for
categories that describe an evolving, open-ended fitness estimate:

- **`injury` and `availability` (doubtful) categories: a 14-day window.** Chosen as a safety margin comfortably exceeding FPL's normal update cadence, since a "75% chance of playing" note genuinely can become outdated. Beyond 14 days, the bare label is still shown (the player is still marked injured/doubtful by FPL, which is current) but the specific old text is withheld rather than presented as if current.
- **`suspension` and `transfer` categories: never gated.** Discovered against real data while implementing this, not decided in the abstract: the initial universal 14-day rule incorrectly hid Digne's still-completely-true "Has joined Paris Saint-Germain permanently" note (written 15 days earlier) — a permanent, one-time fact doesn't decay the way an injury estimate does. A suspension's note similarly states a hard end date ("Suspended until 19 Sep") that stays accurate and useful for as long as it's the latest note on file. So freshness gating now applies only where the underlying real-data problem it's solving actually exists.
- **Real confirmation the rule matters both ways:** Saliba's `news_added` is 33 days old ("Back injury - Unknown return date") — correctly withheld as stale, showing only "Injured". Digne's 15-day-old transfer note is correctly still shown in full.
- **Multiple/superseding updates:** always take the single latest `NewsItem` by `publishedAt` for a player — older rows remain in the database as history but are never shown here.
- **Contradictory structured vs. text info:** not observed anywhere in live data (checked explicitly, see §2). The rule for if it ever occurs: `status` always wins outright; a stale, contradicted note is never surfaced at all (covered by test 7).

## 5. When the UI appears — and when it deliberately doesn't

Appears only when `status !== "a"` **and** the status code is one this app
recognises (`i`/`s`/`u`/`d`). For everyone else — the ~80% of players who are
simply available, and the rare unrecognised future status code — nothing
renders. No "Available ✓" badge was built: absence of a concern is
communicated by rendering nothing, never by asserting fitness the data
doesn't actually assert. "No information" and "available" are kept
genuinely indistinguishable in the UI on purpose — both simply show nothing,
because the app has no stronger claim to make in either case.

**Not gated by Performance-score relevance on the player page**, unlike the
future squad-level view (§8). The 6-of-119 "only a few unavailable players
have a computed score" finding from the design doc is a filter for
*aggregating across many players* — it doesn't apply to a page the user
already navigated to for one specific player. Hiding a fringe player's own
injury status on their own page would make "no information" and "available"
indistinguishable in exactly the case where a visitor most wants to know —
so every player's own page always shows what's on file for them, if
anything is.

## 6. Why this does not affect Player Intelligence

Verified directly, not just asserted:

- `getPlayerAvailability()` never reads or writes `RankedPlayer`, `scores.*`, `PlayerIntelligence`, `MatchRating`, or `Archetype` — its only inputs are `Player.status`, `Player.chanceOfPlayingNextRound`, and `NewsItem`.
- The player page computes `ranking`/`intel`/`archetype` and `availability` as two entirely independent calls (`app/players/[slug]/page.tsx`); `PlayerAvailabilityLine` renders unconditionally regardless of whether a ranking exists at all — confirmed in the browser with Saliba and Digne, both unranked ("Not yet ranked — needs at least 45 minutes...") yet both display their correct availability line above that panel.
- No file under `lib/analytics/scoring/`, `lib/analytics/intelligence/`, `lib/analytics/archetypes/`, or `lib/analytics/story/` was modified.

## 7. How the repository primitive supports Team Intelligence/My Football later

`lib/analytics/availability/repository.ts` exposes:

- `getPlayerAvailability(playerId)` — single-player lookup, used by the player page today.
- `getPlayerAvailabilityMap(playerIds)` — a batched variant (2 queries regardless of squad size) not called anywhere yet, added specifically so a future squad/club view can fetch a whole team's availability in one call rather than re-deriving the interpretation rules.

Deliberately, neither function knows anything about Performance scores. When
Team Intelligence or My Football is eventually built (§3/§6 of the design
doc — the "Ajayi/Mendy, Hull's two best performers, are both doubtful" case),
that surface will already have its own `RankedPlayer[]` list with
`scores.overall` and can zip it against `getPlayerAvailabilityMap()`'s
result to apply the relevance filter *there* — composing this primitive,
not modifying it. This is the same reason the interpretation function is
proven (test 10/11) to produce identical output regardless of whether the
player has a Performance score at all.

## What was deliberately NOT built

- No general news feed, article list, or ticker anywhere.
- No "Available" badge shown for the ~80% of players with no concern.
- No Match Centre, Team Intelligence, My Football, or Discover integration (design doc explicitly deferred these; only the shared primitive was built now).
- No parsing of FPL's free text into a diagnosis or injury taxonomy — `news` is shown verbatim or not at all.
- No new external API, no scraping, no new licensing question — `chance_of_playing_next_round` came from the same `bootstrap-static` payload already in use.
- No relabeling of FPL's percentage into confidence language ("likely available") — the literal number is shown as FPL states it.
- No forced humour — the availability line uses plain factual language only; the Football Voice system was not touched or consulted for this feature.

## Limitations discovered

- **A permanent transfer's team affiliation isn't updated.** Digne's page still shows him under "Aston Villa" (his last Premier League club) even though the availability line correctly says he's joined PSG. This is a pre-existing identity/team-assignment behaviour unrelated to this feature — not something this phase changes or should change, but worth noting for whoever eventually revisits player identity data.
- **The 14-day freshness window is a judgement call, not a measured constant** — chosen conservatively since real staleness has only been observed once so far (Saliba, 33 days). Worth revisiting once more of the season's data accumulates.
- **`status` can theoretically lag real-world recovery** if FPL itself is slow to update it — this app trusts FPL's `status` as ground truth by design (see design doc §7) rather than independently inferring recovery from silence; there is no evidence in current data that this happens, but it's an inherent dependency on the source being timely.

## Tests / type-check / build

- **Tests:** 214 passed (14 new, in `lib/analytics/availability/__tests__/interpret.test.ts`), 0 failed.
- **Type-check:** `npx tsc --noEmit` — clean, no errors.
- **Production build:** `npm run build` — succeeded (Next.js 16.3.2, Turbopack).
- **Browser verification (Playwright, desktop 1280×900 and mobile 390×844):** checked an injured player with no Performance score (Saliba), a doubtful player with a Performance score (Anderson, 5.7 Overall, "Doubtful — Knock - 75% chance of playing"), a suspended player (Gomes, "Suspended until 19 Sep"), a transferred player (Digne, full detail shown), and a fully available player (Calafiori, no availability line at all). Zero console errors on every page. Performance score remained visually primary in every case where one existed; no layout regressions on mobile or desktop.
