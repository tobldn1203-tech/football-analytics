# Match Centre — Data Capability Audit

**Date:** 2026-08-25. **Method:** direct inspection of the current schema (`prisma/schema.prisma`),
ingestion code (`lib/ingestion/fpl/`), provider types (`lib/providers/fpl/types.ts`), and the
repository layer (`lib/analytics/scoring/repository.ts`) — cross-checked against fresh live
fetches of the raw FPL `fixtures` and `event/{gw}/live` endpoints to see the *complete* field set
the source offers, not just the subset we've chosen to parse so far. This is a specification, not
an implementation — nothing in the app changed.

Two separate questions are kept distinct throughout, because conflating them is exactly how a
product ends up "designed around imaginary capabilities":

- **AVAILABLE** — does the data exist in a source we already trust (see `docs/DATA_SOURCES.md`)?
- **INGESTED** — do we currently store it? (A field can be Available but not yet Ingested — that's
  a to-do, not a gap. A field that's simply not Available is a real constraint.)

## 1. Current available data (what we already have, end to end)

Already in the database today, per match: fixture identity (gameweek, kickoff, both teams, final
score), a `TeamMatchPerformance` row per side (W/D/L, goals for/against), and a
`PlayerMatchPerformance` row per player who featured (minutes, goals, assists, clean sheets, goals
conceded, yellow/red cards, saves, bonus, `bps`, xG, xA, xGC, defensive actions). This is already
queried per-player, ordered by kickoff, for the player profile page (`PlayerMatchRow` in
`repository.ts`) — the exact same rows, queried by match instead of by player, are most of a
Match Centre's factual layer with zero new ingestion.

## 2. Missing data (confirmed, not assumed)

Verified directly against a live fetch of `/fixtures/?event=1` (full field list: `code`, `event`,
`finished`, `finished_provisional`, `id`, `kickoff_time`, `minutes`, `provisional_start_time`,
`pulse_id`, `started`, `stats`, `team_a`, `team_a_difficulty`, `team_a_score`, `team_h`,
`team_h_difficulty`, `team_h_score` — that's the complete object, nothing trimmed):

- **No venue field, anywhere.** Not in fixtures, not in bootstrap teams.
- **No half-time score.** Only the final score.
- **No lineup, formation, or captain data.** FPL's own "captain" concept is a fantasy-team pick,
  unrelated to the real match captain — worth flagging explicitly so a future implementation
  doesn't accidentally conflate the two.
- **No event timestamps of any kind.** Goals, cards, etc. are match-level *counts* attributed to a
  player, never tied to a minute. Confirmed again on this fetch — same finding as the original
  data-source investigation, holds for Match Centre too.
- **No substitution pairing or timing.** We can infer *that* a player was used as a substitute
  (see §3), never *when* or *for whom*.
- **No team-level shots/possession/passes/corners in FPL at all** — that was never FPL's purpose.
  football-data.co.uk has shots/corners/fouls/cards at team level (confirmed in
  `docs/DATA_SOURCES.md`), but it is not wired into ingestion today and carries no player
  attribution or match-minute detail.
- **No VAR events.**

## 3. Capability table

Legend: 🟢 available & reliable · 🟡 available but incomplete/derived, or available-not-ingested ·
🔴 not currently available.

### Fixture

| Field | Status | Notes |
|---|---|---|
| Fixture ID | 🟢 | `Match.externalId` |
| Gameweek | 🟢 | `Match.gameweek` |
| Date/time | 🟢 | `Match.kickoff` |
| Home/away team | 🟢 | `Match.homeTeam`/`awayTeam` |
| Final score | 🟢 | `Match.homeScore`/`awayScore` |
| Venue | 🔴 | Not in any FPL payload. Could be added as a small **static** reference table (team → home ground) — not provider data, a maintained fact table; cheap, but out of scope here. |
| Half-time score | 🔴 | Not available from FPL. |

### Match events

| Field | Status | Notes |
|---|---|---|
| Goals (attributed) | 🟢 | Via fixture `stats[goals_scored]`. |
| Assists (attributed) | 🟢 | Via fixture `stats[assists]`. |
| Own goals | 🟡 | **Available, not ingested** — `own_goals` identifier exists in the live payload; `PlayerMatchPerformance` has no column for it yet. |
| Penalties missed/saved | 🟡 | **Available, not ingested** — `penalties_missed`/`penalties_saved` identifiers exist; no columns yet. |
| Penalty *goals* distinctly flagged | 🔴 | A scored penalty is just counted inside `goals_scored` — nothing marks it as a penalty. Cannot say "this specific goal was a penalty." |
| Yellow cards | 🟢 | Attributed, count only. |
| Red cards | 🟡 | Attributed, count only — straight red vs. second-yellow red are not distinguished. |
| Substitutions | 🟡 | Inferable (`starts:0` + `minutes>0` from `event/{gw}/live` — see §Lineups) but never as an event with a minute or a replaced-player link. |
| Minutes of any event | 🔴 | The single biggest gap. No goal, card, or substitution carries a minute anywhere in this data. |
| VAR events | 🔴 | Not present. |

### Lineups

| Field | Status | Notes |
|---|---|---|
| Starting XI | 🟡 | **Available, not ingested.** `event/{gw}/live` gives a per-player `starts: 0/1` flag we don't currently parse or store — this is a real, confirmed capability sitting unused. |
| Substitutes used | 🟡 | Derivable as `starts:0 AND minutes>0` once the field above is ingested — tells you *who*, not *when*. |
| Player positions (on-pitch) | 🔴 | We have a player's *general* position (GKP/DEF/MID/FWD from `bootstrap`), not their matchday tactical slot. |
| Captain (real, on-pitch) | 🔴 | Not available — and see the explicit warning in §2 about not confusing this with FPL's fantasy captain. |
| Formation | 🔴 | Not available from FPL in any form. |

### Player match data

| Field | Status | Notes |
|---|---|---|
| Minutes | 🟢 | Ingested. |
| Goals / Assists | 🟢 | Ingested. |
| Bonus / `bps` | 🟢 | Ingested — this is what Impact/Form already use. |
| xG / xA | 🟢 | Ingested. |
| Defensive actions | 🟢 | Ingested (CBI + tackles + recoveries, combined). |
| Creativity (ICT component) | 🟡 | Field exists but reports `0` until FPL finalizes the gameweek (documented lag in `docs/DATA_SOURCES.md`) — same caveat as `ict_index` already noted for Impact/Form. |
| Progression (passes/carries) | 🔴 | Not available from FPL or any currently-confirmed free source. |
| Other stats (saves, clean sheets, goals conceded) | 🟢 | Ingested. |

### Team match data

| Field | Status | Notes |
|---|---|---|
| Shots / shots on target | 🟡 | football-data.co.uk has this at team level, not wired into ingestion. |
| Corners / fouls / cards (team) | 🟡 | Same — available in that source, not ingested, no player attribution. |
| Possession | 🔴 | Not available from any confirmed free source. |
| Passes | 🔴 | Not available. |
| Team xG | 🔴 | Not available from a confirmed free source (Understat was investigated and explicitly deprioritized — see `docs/DATA_SOURCES.md`). |

## 4. Match-level rating feasibility

**Feasible, using the existing methodology pattern, with a specific and important caveat.**

The season engine (`lib/analytics/scoring/provisional.ts`) percentile-ranks each player's per-90
metrics against an eligible pool, position-aware for Defence. Nothing about that method requires
a *season-long* pool — the same computation applied to **one gameweek's worth of
`PlayerMatchPerformance` rows** (instead of season-to-date totals) produces a mathematically valid
"Match Rating" using data we already store, with no new ingestion.

The caveat is exactly what the brief anticipated, and it's larger than it sounds: a single
gameweek's cohort per position is thin (roughly 15–20 defenders across 10 matches, vs. 70+ over a
season), so percentile placement swings hard on small differences — this is the same
small-sample noise the Performance Intelligence audit already documented at the *season* level
during gameweek 1 (`docs/PERFORMANCE_INTELLIGENCE_AUDIT.md`), except a Match Rating would face
that noise **every single week, permanently** — it never grows out of it the way a season score
does. A "9.2 Match Rating" and an "8.6 Season Performance" must never be presented as the same
kind of number. Concretely, whenever this is built:

- Label it distinctly ("Match Rating", not "Performance") with its own visual treatment.
- Apply the same confidence-aware language discipline the season-level fix just established
  (`docs/PERFORMANCE_INTELLIGENCE_AUDIT.md` §3.1) **from day one** — a single match's derived
  "Match Strength" category is exactly as vulnerable to a one-goal/one-tackle spike as the
  season-level strengths were, in fact more so, since there's no larger sample to fall back on.
  This should not need a second audit cycle to discover.
- Do not blend Match Rating into the season Performance calculation — they answer different
  questions and should stay computed independently, feeding into each other only the way
  individual matches already feed Form/Consistency/Momentum today (i.e. as one data point among
  several, never as a replacement).

## 5. Key Moments feasibility

**Still not supportable as qualitative, causal claims — confirmed again, not just assumed
inherited from the earlier finding.**

The distinction the brief draws is the right one and this audit re-confirms it against live data:

- **EVENT DATA we have:** "Player X scored," "Player Y received a yellow card," aggregated to the
  match. Confirmed 🟢 in §3.
- **INTERPRETATION we do NOT have the evidence for:** "90+4 goal" is meaningless without a minute
  (🔴, §3), and even with one, "Hall made a costly defensive error which caused this goal" requires
  an event *sequence* (what happened immediately before the goal, whose action it was, what the
  match state was) that this data simply does not encode. We know a goal happened and who scored
  it. We do not know what led to it.

No amount of clever derivation turns match-level counts into an event timeline. This isn't a
modelling limitation — the underlying data doesn't contain the information. Key Moments remain
correctly deferred pending a genuine minute-level events source (api-football was the candidate
identified and left unverified in `docs/DATA_SOURCES.md`).

## 6. Match Story feasibility

Splitting what a "Match Story" could honestly contain today from what it can't, using the same
event-data-vs-interpretation boundary as §5:

| Component | Status | Why |
|---|---|---|
| Result line ("Newcastle 2–2 Liverpool") | 🟢 | Fully available. |
| Scorers/assisters/cards, attributed | 🟢 | Available (§3), can be stated as plain fact. |
| Best performer | 🟢 (once Match Rating exists) | A defensible, data-backed pick — "highest Match Rating across both sides" — not a fabrication, since it's computed from real per-match stats. |
| Team performance summary (factual) | 🟡 | Can state real counts ("Newcastle scored twice, had two players booked") without claiming *why* — no team-level shots/possession to support anything more. |
| Match character ("Newcastle controlled the first half...") | 🔴 | Requires knowing how the game evolved over time — no minute-level or shot/possession-over-time data exists. This is a claim about *process*, and we only have *outcomes*. |
| Turning point | 🔴 | Same reasoning as Key Moments (§5) — needs event sequence + match state, which doesn't exist in this data. |
| Key moment | 🔴 | See §5. |

**Recommendation:** a Match Story, when built, should be scoped to the 🟢/🟡 rows only — a factual
recap plus a data-backed "best performer," not a narrative arc. Anything claiming how the match
*developed* needs to wait for richer data, exactly as Key Moments does. Do not let "Match Story"
become a backdoor for the same fabrication risk Key Moments was explicitly built to avoid.

## 7. Season linkage

**Already architecturally supported — this is not a gap.** `PlayerMatchPerformance` is already one
row per player per match, and the player profile already queries it ordered by kickoff
(`getPlayerProfile` → `PlayerMatchRow[]`) to feed Form/Consistency/Momentum. A "GW1 — 8.2, GW2 —
8.7..." history is the same query with a Match Rating computed per row (§4) — no schema change,
no new ingestion. The only genuinely new piece of work is the Match Rating computation itself
(§4), which is a read-time calculation, consistent with how season scores already work (nothing
is persisted/cached today — see §8.4).

## 8. Automatic refresh — current state and gaps

Traced end to end through the actual ingestion code:

1. **How does new data enter the app?** `npm run ingest` (`scripts/ingest.ts` →
   `runFplIngestion()`) — a **manual command**. Confirmed: no `vercel.json`, no `.github/workflows`,
   no scheduler of any kind exists in the repo today. This is the most important gap in this
   section — everything downstream of ingestion already works automatically; ingestion itself
   does not trigger automatically.
2. **How are new fixtures/results detected?** Every ingestion run re-fetches all fixtures and
   upserts by `(provider, externalId)`, gated on `finished_provisional` (see
   `docs/DATA_SOURCES.md` for why `finished`, not `finished_provisional`, would be wrong). Safe to
   run repeatedly; correctly picks up newly-finished matches — but only when run.
3. **How are player match performances stored?** Two idempotent passes — `ingestFixtures`
   (event-attribution: goals/assists/cards/bonus/bps) then `ingestGameweekStats`
   (minutes/xG/xA/defensive actions) — both upsert on `(playerId, matchId)`. Works correctly today.
4. **How are season aggregates updated?** They aren't stored at all — `getCurrentSeasonPerformanceInputs()`
   recomputes from raw `PlayerMatchPerformance` rows on every request. This means aggregates are
   *always* correct the moment new rows exist (no separate "recompute" step, no staleness risk),
   at the cost of re-scanning all of a player's matches on every read. Fine at 1 gameweek's scale;
   worth watching as a full season (or multiple seasons) of rows accumulate — a caching/persistence
   layer is a reasonable future addition, not a current problem.
5. **How are Form/Consistency/Momentum recalculated?** Same answer as §8.4 — computed fresh from
   raw data on every request, so they incorporate new matches automatically the moment ingestion
   has run. No explicit recalculation step is needed or exists.
6. **How would Match Centre pages become available?** Trivially, once built — `Match` rows already
   carry `gameweek` and both teams, so a gameweek listing or single-match page is a direct query
   against already-ingested data. The only real dependency is §8.1: someone (or something) has to
   have run ingestion after the gameweek finished.
7. **How would old matches remain accessible?** Yes, indefinitely — rows are only ever upserted,
   never deleted. No gap here.

**What's missing, concretely:** a scheduled trigger for ingestion (Vercel Cron or a GitHub Actions
workflow calling the existing `runFplIngestion()`), matched to the Premier League's own schedule
(no need to poll more than a few times on a matchday and once daily otherwise). This was already
named as a Phase 3 intention in `docs/PROJECT_PROPOSAL.md` and still hasn't been built — worth
doing before Match Centre ships, so match pages don't silently go stale.

## 9. Recommended MVP Match Centre scope

Scoped strictly to 🟢 (and clearly-labelled 🟡) capability from §3:

- Gameweek listing: fixtures, results, kickoff times. (🟢, no new ingestion.)
- Individual match page: final score, both teams, full list of players who featured with their
  real per-match stats (minutes, goals, assists, cards, bonus) — i.e. `PlayerMatchRow`, queried by
  match instead of by player. (🟢.)
- Match Rating per player, computed per §4, **visually and semantically distinct** from Season
  Performance, with the same confidence-aware language discipline applied from the start.
- Best performer(s) per match, derived from Match Rating. (🟢 once Match Rating exists.)
- Links from a match page into each player's season profile. (🟢, `Player.slug` already exists.)
- A factual match summary sentence (result + scorers + cards), deterministic, no LLM. (🟢/🟡, per §6.)
- Starting XI / substitutes-used list, **once `starts` is added to ingestion** (§3 — currently
  available but not stored; a small, contained ingestion change, not a new data source).

Explicitly **not** in MVP scope, because the data doesn't support it honestly: minute-by-minute
timeline, Key Moments, turning points, match "character"/narrative arc, formation, real captain,
venue, half-time score, team shots/possession (until football-data.co.uk is actually wired in).

## 10. Future enhancements requiring richer data

Marked explicitly per the brief's instruction — none of these should be attempted with inferred
or fabricated data:

- **Minute-level Key Moments and match timeline** — needs a genuine events source. Candidate
  (unverified): api-football, ~100 req/day free tier claimed but not confirmed live (see
  `docs/DATA_SOURCES.md`). **Future paid-data capability** if that free tier proves insufficient
  once tested.
- **Match character / turning points / dominant spells** — needs the same events source as above,
  plus ideally shot-location or possession-over-time data, which likely means a paid provider.
  **Future paid-data capability.**
- **Team-level shots/possession/passes** — football-data.co.uk covers shots/corners/fouls/cards at
  team level for free; possession and passes are **future paid-data capability** (no confirmed
  free source).
- **Formation and real (on-pitch) captain** — no confirmed free source identified yet. Would need
  new investigation before assuming a paid provider is required.
- **Venue** — not a provider gap at all; a small static reference table (team → home ground) would
  solve this for free, whenever it's worth the effort. Noted separately from the paid-data items
  above since it needs no new data source, just a short maintained list.

## Bottom line

The Match Centre's factual layer (fixtures, results, per-player match stats, a defensible match
rating and best-performer pick, links into season profiles) is buildable today with **zero new
data sources** — it's the same rows already powering Form/Consistency/Momentum, queried by match
instead of by player, plus one small ingestion addition (`starts`) for lineups. What isn't
buildable — Key Moments, turning points, match narrative arc, formation, real captain, venue,
half-time score — isn't buildable because the data genuinely doesn't exist in any free source
we've confirmed, not because of a missing feature in this codebase. Building the MVP scope in §9
first, and deferring §10 explicitly rather than approximating it, keeps the product honest about
what it actually knows.
