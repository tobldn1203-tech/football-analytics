# Key Moments — Data Ecosystem Research

**Date:** 2026-08-24. **Method:** live web research into free/open football data sources —
official pricing/docs pages, terms-of-service pages, GitHub source repositories, and independent
comparison sources — cross-checked against each other rather than taken from a single vendor's
own marketing. This is research only: **nothing in the app changed**, the FPL ingestion pipeline
is untouched, and the Match Centre built in the previous session is unmodified.

A note on verification, in the spirit of §0 of `docs/MATCH_CENTRE_DATA_AUDIT.md`'s
confirmed-vs-claimed discipline: `api-football.com`'s own pricing/terms/docs pages returned
HTTP 403 to this session's automated fetch tool (bot-blocking, not a content issue — the pages
are reachable in a browser). Everything below sourced from those pages is therefore marked
**claimed, not directly verified this session** and corroborated instead via independent
comparison articles, third-party API wrapper documentation, and this session's own general
technical knowledge of a schema that has been publicly documented and stable for years. Where a
claim matters enough to change the recommendation, it's flagged explicitly and a first
implementation step is proposed specifically to verify it with a real free key before any
further commitment — do not skip that step.

---

## 1. Free sources investigated

| Source | Verdict | Why |
|---|---|---|
| **API-Football** (`api-football.com` / `api-sports.io`, also mirrored on RapidAPI) | 🟢 **Recommended** | Genuine event-level data (goal minute, scorer, assist, cards, subs, VAR) + per-player match statistics, free tier realistically sized for weekly PL ingestion. See §2–§5. |
| **football-data.org** | 🟡 Considered, not chosen for events | Solid for fixtures/standings/scorers across a curated 12-competition list including the Premier League, but the free tier is thin on event-level detail (see §3) — good corroboration/backup source, not a Key Moments source on its own. |
| **football-data.co.uk** | 🔴 Ruled out for Key Moments | CSV downloads of team/match-level stats (shots, corners, fouls, cards *counts*) and betting odds, back to 1993 — no player names on events, no assists, no minutes. Useful (if ever wired in) for team-level context, not player key moments. Also carries only a bare "All Rights Reserved" copyright notice with no stated redistribution license — see §5. |
| **StatsBomb Open Data** (GitHub) | 🔴 Ruled out — wrong seasons | The richest event schema investigated (full 360° event stream, shot freeze-frames, xG) but its free Premier League coverage is exactly two seasons: **2003/04 and 2015/16**. Nothing from 2020 onward. Cannot power a *current-season* Key Moments feature. Worth remembering only if a future "on this day in PL history" feature is ever considered. |
| **Sportmonks free plan** | 🔴 Ruled out — wrong leagues | Permanently free, but the free tier covers only the **Danish Superliga and Scottish Premiership** — no Premier League at all on the free plan. Sportmonks' paid plans do cover the Premier League with rich event/coordinate data, worth a future look if budget ever opens up, but out of scope for "free." |
| **TheSportsDB** | 🔴 Ruled out — data quality/depth | Crowd-sourced, genuinely free, generous for team/league metadata and artwork. Match-event depth for detail (cards, subs, assists) is inconsistent match-to-match because it depends on volunteer contributors, and its own docs describe hard per-endpoint search caps on the free tier. Not reliable enough to hang factual Key Moments claims on. |
| **live-score-api.com** | 🔴 Ruled out — trial only | 14-day free trial, then paid. Not a durable free tier for an ongoing hobby project. |
| **FBref / Sports-Reference** | 🔴 Ruled out — ToS explicitly prohibits this use | Extremely rich data (shots, xG, progressive passes, defensive actions) available as manual CSV downloads, but their Terms of Use explicitly state users must not "create websites or tools based on data... scraped from Sports Reference... without permission," and rate-limits automated access to 10 requests/minute with a ban ("jail") for violators. Building automated ingestion against FBref without written permission from Sports Reference would violate their terms — not a legitimate free source for this use case as-is. |
| **Understat** | 🔴 Ruled out — no public API, ToS unclear | Popular source for shot-level xG, but there is no official public API — all access is via reverse-engineering JSON embedded in page `<script>` tags. No terms-of-service or licensing statement was found stating this is permitted. Absent an explicit license, this isn't a "legitimate" source per the brief's own instruction, however technically easy it is to scrape. |
| **Opta / Stats Perform, Wyscout** | 🔴 Not investigated further — no free tier | Industry-standard providers behind the paid data most broadcasters and clubs use. Enterprise-only, no free tier exists. Named here only so it's clear they were considered and excluded for the obvious reason, not overlooked. |
| **openfootball** (GitHub, various maintainers) | 🔴 Ruled out — wrong data shape | Open-source fixtures/results project (team names, dates, final scores only). No event data of any kind. Solved problem this app already has via FPL; adds nothing for Key Moments. |

---

## 2. Recommended source(s)

**Primary recommendation: API-Football, as a *secondary* provider used only for match events and
player match statistics — FPL stays the source of truth for everything it already powers
(fixtures, scores, season stats, `starts`).**

This matches the brief's framing exactly: "we are NOT necessarily looking for a replacement... a
secondary provider specifically for match events is acceptable." Nothing about the existing
ingestion, scoring, or Match Centre needs to change — API-Football would add a new, narrower
ingestion path (`ingestMatchEvents`, conceptually) that enriches existing `Match` rows with a new
`MatchEvent` table, without touching how `PlayerMatchPerformance` or the scoring engine works.

**Secondary/backup: football-data.org**, purely as corroboration for scorer/assist facts if
API-Football's free tier ever proves too thin week to week (§4) — not as a primary events source,
because its own free-tier documentation is explicit that lineups, substitutions, and cards are
not part of the free plan (§3).

**Not recommended at all for this use case:** football-data.co.uk, StatsBomb open data, Sportmonks
free plan, TheSportsDB, FBref, Understat, live-score-api.com — each ruled out above for a specific,
stated reason (wrong data shape, wrong seasons, wrong league, ToS prohibition, no durable free
tier, or unverifiable licensing).

---

## 3. Exact data available (API-Football)

API-Football exposes a REST API (identical product, two front doors: `api-football.com` direct
and the RapidAPI-hosted mirror) with, among others, `/fixtures`, `/fixtures/events`,
`/fixtures/lineups`, and `/fixtures/players` endpoints. Field names below reflect the API's
long-standing, publicly documented schema, corroborated via independent comparison articles;
flagged **[unverified this session]** where this session could not fetch the vendor's own docs
page directly (§0).

### `/fixtures/events` — the actual Key Moments substrate

Per goal/card/substitution/VAR event in a fixture:

| Field | Description |
|---|---|
| `time.elapsed` | Minute of the event (e.g. `90`). |
| `time.extra` | Added/stoppage time within that minute (e.g. `4`, for a 90+4' event). |
| `team` | Which side the event belongs to. |
| `player` | The player the event is attributed to (scorer, carded player, player subbed off). |
| `assist` | The assisting player, present on goal events where applicable. |
| `type` | One of `Goal`, `Card`, `subst`, `Var`. |
| `detail` | Sub-classification: `Normal Goal`, `Own Goal`, `Penalty`, `Missed Penalty` (under `Goal`); `Yellow Card`, `Red Card` (under `Card`); `Substitution 1` etc. (under `subst`). |
| `comments` | Occasionally populated free-text context, not reliable enough to depend on. |

This is precisely Level 1 data (§6) — a minute, an event type, and the player(s) involved,
structured rather than inferred.

### `/fixtures/players` — per-player match statistics

Per player, per fixture: minutes played, position, captain/substitute flags, star rating (their
own proprietary match rating — **not** something to adopt; the app already has its own Match
Rating methodology and must not import a second, unrelated one), shots (total/on target), goals
(total/conceded/assists/saves), passes (total/key/accuracy%), tackles (total/blocks/
interceptions), duels (total/won), dribbles (attempts/success/times dribbled past), fouls
(drawn/committed), cards (yellow/red), penalties (won/committed/scored/missed/saved).

This is genuinely richer than what FPL provides today for defensive/creative involvement
(tackles, interceptions, key passes, duels won) — useful raw material for Level 2 interpretation
(§6), independent of Key Moments specifically.

### Shot coordinates / xG

**Not confirmed available on API-Football's free tier.** Shot `x, y` pitch coordinates and
structured xG-per-shot are features associated with Sportmonks (paid) and StatsBomb, not
API-Football's documented schema. Do not assume API-Football gives shot maps — nothing found in
this research confirms it does, on any plan. If per-shot xG is wanted later, it stays an
unresolved gap, not something this source silently covers.

### football-data.org, for comparison

| Field | Free tier? |
|---|---|
| Fixtures, results, standings, top scorers | 🟢 Yes, across 12 competitions including the Premier League. |
| Live/in-play scores | 🔴 No — delayed on free tier. |
| Lineups, substitutions, cards | 🔴 **Explicitly excluded from the free tier** per its own documentation. |
| Unauthenticated (no registration) access | 🔴 Restricted to just the area/competition list resources; everything else needs a free registered API key, capped at 10 requests/minute. |

This confirms football-data.org cannot itself power Key Moments — it's a good fixtures/standings
corroboration source, nothing more, on the free tier.

### football-data.co.uk, for comparison

CSV columns confirmed from the source's own field notes: match date/time, teams, full-time and
half-time score/result, referee, attendance, and **team-level** shots/shots-on-target/
woodwork/corners — plus historical betting odds columns. No scorer names, no assists, no cards
*with names attached* (some historical files carry team-level card *counts*, not player
attribution), no event minutes. Confirms the existing audit's classification: useful only for
team-level context, never player-level Key Moments.

---

## 4. API limits

| Source | Daily cap | Per-minute cap | Verified how |
|---|---|---|---|
| API-Football free plan | **100 requests/day** | 10 requests/minute | Corroborated across api-football's own rate-limit explainer page and multiple independent comparison sources; consistent everywhere checked. |
| football-data.org free (registered) | Not daily-capped in what was found | 10 requests/minute | Confirmed via official docs (`docs.football-data.org/general/v4/policies.html`), fetched directly this session. |
| football-data.org free (unauthenticated) | 100 requests/24h, but restricted to area/competition-list resources only | — | Same source. |

**Is 100 requests/day actually enough?** Yes, comfortably, for the ingestion pattern this app
needs — a single batch run shortly after each gameweek's matches finish, not continuous polling:

- 1 call: fixtures for the gameweek round (or 1 call per fixture, if the free plan doesn't expose
  a round-level fixture list — worst case, 10 calls for a full PL gameweek).
- 10 calls: `/fixtures/events` for each of the 10 PL fixtures that gameweek.
- 10 calls: `/fixtures/players` for each fixture, if per-player match stats are wanted too.

That's roughly **20–30 requests per gameweek**, run once, well inside a 100/day budget with
headroom for a retry or two. The daily cap is not the risk here — see the real, unresolved risk
flagged below.

**The one important unresolved unknown [unverified this session, flagged per §0]:** whether the
free plan's "seasons are limited" restriction (stated in multiple independent comparison sources,
but never with a precise cutoff year) excludes the **current, live 2026/27 Premier League season**
specifically, or only restricts *older historical* seasons while leaving the current one free.
Different sources hint at different things and none could be confirmed by direct fetch this
session (§0). **This must be the very first thing checked with a real free API key — a single
`/fixtures?league=39&season=2026` call — before any further implementation work is planned
around this source.** If the free plan turns out to exclude the current season, API-Football is
not viable as-is and the fallback is football-data.org's scorer-only data plus continuing to defer
Key Moments, not silently substituting a different unverified source.

---

## 5. Licensing / usage concerns

- **API-Football grants no redistribution license.** Its own terms state it does not license the
  underlying competition data for publication — any commercial rights around competitions
  (broadcasting, betting products, mass distribution) require separate authorization from the
  relevant rights holders, and the user is responsible for verifying that. For a small, personal,
  non-commercial analytics project displaying factual match events (goals, cards, minutes) — the
  same category of information newspapers and score apps report as fact — this is a materially
  lower-risk use than, say, betting products or broadcast use, but it is **not a zero-risk
  guarantee**, and this project should stay non-commercial and clearly attribute API-Football as a
  data source if this is ever built.
- **football-data.co.uk** carries a bare "© Football-Data. All Rights Reserved" notice with no
  stated permission to reuse the data in an application, confirmed by direct fetch this session.
  Since it isn't being recommended for Key Moments anyway (§1), this is moot for this feature, but
  worth remembering if it's ever revisited for team-level shots/corners.
- **StatsBomb open data** has a clear, permissive attribution license (must credit StatsBomb, use
  their logo) — but is disqualified on coverage grounds regardless (§1).
- **FBref/Sports-Reference** explicitly prohibits building tools from their data without written
  permission — ruled out on licensing grounds alone, independent of how good the data is.
- **Understat** has no stated license at all for its data — absent an explicit grant, treat as not
  legitimately usable for an ingested, redistributed feature, regardless of how easy the scrape is.
- **General principle applied throughout this research:** "technically scrapeable" and "free to
  call without hitting a paywall" were both explicitly treated as insufficient on their own — a
  source needed either an explicit API terms-of-service that permits this kind of use, or a
  stated open-data license, to be recommended. That's why FBref and Understat are excluded despite
  being commonly used in hobby football-analytics projects online.

---

## 6. What we can safely derive

Using the three-level framework from the brief:

### LEVEL 1 — Factual events (safe, if API-Football's current-season access is confirmed, §4)

Directly structured fields, no interpretation required:
- Goal scored, by whom, what minute (incl. stoppage time), which team.
- Assist provider, when present in the source data.
- Own goal (via `detail: "Own Goal"`).
- Penalty scored / penalty missed (via `detail`).
- Yellow card / red card, by whom, what minute.
- Substitution — player off, player on, what minute (subject to confirming both legs of the swap
  are present in the event pair, not just one side — verify against a real fixture during the
  implementation spike).
- VAR review occurred (via `type: "Var"`) — but see the Level 2 caveat below; the *outcome* of a
  VAR review is not always cleanly re-stated in a second event, so "VAR overturned a goal" needs
  per-fixture verification before it's asserted as fact.

### LEVEL 2 — Data-backed interpretation (safe, but only via a stated, deterministic rule)

These are safe **only** when each phrase is backed by an explicit, checkable rule against Level 1
data — the same discipline already applied to Match Strength/Performance labels
(`docs/PERFORMANCE_INTELLIGENCE_AUDIT.md`). Examples with the rule that would justify them:

| Phrase | Rule |
|---|---|
| "Late equaliser" | Goal event where `time.elapsed >= 80` (or in added time) AND the resulting score is level, AND it's not the match's final goal margin-widening move — i.e., the score was *not* level before this goal for the trailing side. |
| "Penalty scored" / "Penalty missed" | Directly from `detail`. |
| "Second yellow" (implying a red via two bookings) | Two `Card` events for the same player in the same fixture, second one `Red Card`, distinguishable from a straight red only if API-Football's `detail` field actually distinguishes them — **must verify this during the spike; if it doesn't, "second yellow" cannot be safely claimed and only "red card" can.** |
| "Match-winning goal" | The single goal, from the eventual winning team, that took them from level-or-behind to a lead they never relinquished for the rest of the match — fully computable from the ordered event list + final score. |
| "Brace" / "Hat-trick" | Count of `Goal` events for one player in one fixture ≥ 2 / ≥ 3. |
| "Off the bench impact" | Player entered via `subst` AND recorded a goal or assist event later in the same fixture with a later minute. |
| "Full 90 minutes" | Player's `/fixtures/players` minutes == 90 (or matched the added-time total) and no substitution event removed them. |

### LEVEL 3 — Qualitative football description

**Not derivable from this data, full stop — and this needs restating plainly because it's the
part most likely to get quietly fudged under deadline pressure.** "Top bins," "banger,"
"brilliant save," "outrageous stop," "shut down his wing," "completely dominated his flank" are
all claims about **quality of execution or spatial/tactical control**, not **that something
happened**. API-Football's events and match-stats endpoints tell you a save occurred (if it's
even a captured event type — saves are not confirmed as a distinct event type in `/fixtures/
events`, only inferable from a goalkeeper's aggregate `saves` count in `/fixtures/players`, with
no minute or shot quality attached) — they do not tell you the save was spectacular, that a shot
was placed in the top corner, or that a full-back nullified a winger's every touch. See §7 for
exactly what additional data each Level 3 phrase would require.

---

## 7. What we cannot safely derive — and what would be needed

| Level 3 phrase | What it actually claims | Data that would be required | Available in any source investigated? |
|---|---|---|---|
| "Top bins" / "banger" | Shot placement (corner of goal) and/or a strike from distance/difficulty | Shot coordinates (start location, end location/placement) | 🔴 Not confirmed on any free source. Sportmonks (paid) and StatsBomb (free but wrong seasons, §1) have this. |
| "Clinical finish" | Low-xG chance converted, or minimal touches to score | Per-shot xG + shot context (first-time, angle) | 🔴 Not available free for the current season. |
| "Brilliant save" / "outrageous stop" | Save difficulty (shot xG faced, placement, reaction) | Post-shot xG / shot-stopping model, goalkeeper positioning data | 🔴 Not available in any free source found. |
| "Massive defensive intervention" | A specific tackle/block/clearance that prevented a high-probability goal | Possession-value or "danger level" model tied to the specific defensive action's moment | 🔴 Not available free. `/fixtures/players` gives *counts* of tackles/blocks for the match, not which one mattered or when. |
| "Costly error" | A turnover/mistake directly leading to a goal against, causally linked | Event sequence immediately preceding a goal, with attribution of the losing possession action to a specific player | 🔴 Not available in any free source — this is the same gap the original Match Centre audit already identified and it holds here too. |
| "Ran the wing all game" / "completely dominated his flank" | Sustained positional/spatial control over 90 minutes | Tracking data (player positions over time) or heat-map-equivalent touch locations | 🔴 Tracking data is not offered free by any source investigated — this is genuinely elite/broadcast-tier data (ChyronHego, Second Spectrum, Opta tracking). |
| "Match-winning contribution" | Causal claim that a player's actions decided the result | Defensible as **Level 2** only in the narrow "scored the goal that proved decisive" sense (§6) — the broader claim ("his pressing forced the turnover that led to...") is Level 3 and not derivable. |
| "Late heartbreak" | Emotional framing of a late concession | This is language/tone applied *on top of* a Level 1 fact (late goal against) — safe as a **phrasing choice**, not as a new data requirement, provided it's only ever applied where the underlying minute+scoreline fact is real. |

**Bottom line for Level 3:** none of it is derivable from API-Football, football-data.org, or any
other free source investigated. It requires either (a) tracking/positional data, which is
consistently a paid, broadcast-tier product across every provider checked, or (b) a genuine
shot-quality/xG-per-shot model tied to coordinates, which is likewise not free for the current PL
season anywhere found. Do not build a Level 3 vocabulary against inferred/guessed signals — the
"late heartbreak" row above is the one legitimate escape hatch: **tone and phrasing can dress up a
real Level 1/2 fact without requiring new data**, but that's a copywriting decision applied to
real facts, not a new capability.

---

## 8. Proposed Key Moment data model

Additive only — no change to `Match`, `PlayerMatchPerformance`, or the scoring engine. New tables,
provider-namespaced exactly like existing ones (`(provider, externalId)` upsert, matching the
pattern in `lib/ingestion/fpl/`):

```prisma
/// One structured event within a match, from a secondary events provider
/// (e.g. API-Football). Deliberately separate from PlayerMatchPerformance —
/// that table stays FPL's aggregate-per-match truth; this table is a
/// provider-namespaced, minute-level EVENT STREAM that can exist, be
/// partially populated, or be entirely absent for a given match without
/// affecting anything FPL-derived.
model MatchEvent {
  id          String   @id @default(cuid())
  matchId     String
  match       Match    @relation(fields: [matchId], references: [id])

  provider    String   // "api-football" — future events providers get their own rows, never overwrite another provider's
  externalId  String   // provider's own event id, for idempotent upserts

  minute      Int      // time.elapsed
  minuteAddedTime Int? // time.extra — null when not stoppage time

  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])

  playerId    String?  // nullable: some event types may not resolve to a known Player row (name-matching miss — see §10 risk)
  player      Player?  @relation("EventPlayer", fields: [playerId], references: [id])

  assistPlayerId String?
  assistPlayer   Player? @relation("EventAssist", fields: [assistPlayerId], references: [id])

  type        String   // "goal" | "card" | "substitution" | "var"
  detail      String   // "normal_goal" | "own_goal" | "penalty" | "missed_penalty" | "yellow_card" | "red_card" | "sub_on" | "sub_off" | ...

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([provider, externalId])
  @@index([matchId, minute])
}

/// A derived, labelled highlight for one player in one match — the output
/// of applying the Level 2 rules in §6 to the raw MatchEvent stream (plus,
/// where relevant, existing Match Rating / PlayerMatchPerformance data).
/// Always traceable back to the MatchEvent row(s) and/or stat(s) that
/// justified it — never freestanding text. This is the row that would
/// eventually back a player's "Key Moments" timeline (§ Player Page below)
/// and feed into a future Season Story.
model PlayerKeyMoment {
  id            String   @id @default(cuid())
  playerId      String
  player        Player   @relation(fields: [playerId], references: [id])
  matchId       String
  match         Match    @relation(fields: [matchId], references: [id])

  minute        Int?     // null for match-level (not minute-tied) moments, e.g. "Man of the Match" derived from Match Rating
  minuteAddedTime Int?

  vocabularyKey String   // stable key into the controlled vocabulary in §9, e.g. "costly_error", "match_winner", "clean_sheet_shield" — NEVER free text generated per-instance
  severity      String   // "notable" | "significant" | "standout" — controls visual prominence, not sentiment

  // Traceability — a PlayerKeyMoment must always be able to point back to
  // what justified it. At least one of these should be set.
  sourceEventId   String?  // FK to MatchEvent, if minute-tied
  sourceEvent     MatchEvent? @relation(fields: [sourceEventId], references: [id])
  sourceStatNote  String?  // short machine note for non-event-tied derivations, e.g. "matchRating=8.2, rank=1/22" — for debugging/audit, not for display

  createdAt     DateTime @default(now())

  @@index([playerId, matchId])
}
```

Design choices worth calling out explicitly:

- **`vocabularyKey`, not free text.** A moment is always a reference into the controlled
  vocabulary (§9), computed by a deterministic rule (§6), never an LLM-generated sentence per
  instance. The display copy for a given `vocabularyKey` lives in code (or a small lookup table),
  so the *set* of phrases the app can ever say stays reviewable and finite — exactly the same
  discipline already applied to confidence-gated language in `lib/analytics/intelligence/`.
- **Every `PlayerKeyMoment` is traceable.** Nothing gets displayed that can't be traced back to a
  real `MatchEvent` or a real stat. This directly enforces the brief's "do not overstate what data
  proves" instruction at the schema level, not just as a coding convention.
- **`MatchEvent` is provider-namespaced and additive.** If API-Football's free plan turns out not
  to cover the current season (§4's open risk) or coverage is patchy for some fixtures, the table
  is simply sparse — `PlayerMatchPerformance` (FPL) keeps working exactly as it does today, and
  Match Centre / Season Performance are entirely unaffected. This is the same
  available-vs-ingested discipline as the original data audit, extended to a second provider.
- **`playerId` is nullable on `MatchEvent`.** API-Football players are matched to this app's
  existing `Player` rows by name+team+date heuristics (no shared ID space with FPL) — see the
  cross-provider identity risk in §10. A small number of unresolved matches (nicknames, transfer
  timing edge cases) should degrade to "event exists but isn't linked to a Key Moment," never to
  a silently wrong player.

---

## 9. Proposed football-language vocabulary

Every phrase below is a fixed `vocabularyKey` → display string, gated by a specific, checkable
Level 1/2 signal from §6 — no phrase is included here without a stated rule. Nothing from Level 3
(§7) appears in this list.

| `vocabularyKey` | Display phrase | Data signal required |
|---|---|---|
| `match_winner` | "Match-winning contribution" | Scored the goal that gave their team a lead never relinquished (§6 rule). |
| `late_equaliser` | "Late equaliser" | Goal, `minute >= 80` (or stoppage), levelled the score. |
| `late_winner` | "Late winner" | Goal, `minute >= 80` (or stoppage), took the lead, and it held. |
| `penalty_scored` | "Scored from the spot" | `detail: penalty`, goal outcome. |
| `penalty_missed` | "Missed from the spot" | `detail: missed_penalty`. |
| `own_goal` | "Own goal" | `detail: own_goal`. Stated plainly, no editorializing — this is a fact, not a moment to dramatize. |
| `brace` | "Two goals" (brace) | 2 `Goal` events, same player, same match. |
| `hat_trick` | "Hat-trick" | 3+ `Goal` events, same player, same match. |
| `assist_creator` | "Created the goal" | `assist` attribution on a `Goal` event. |
| `off_bench_impact` | "Impact off the bench" | Entered via `subst` event, recorded a goal/assist afterward in the same match. |
| `second_booking` | "Sent off — second booking" | Two `Card` events, same player, second is red **[only if API-Football's `detail` distinguishes straight-red vs. second-yellow — verify in spike, §4]**. |
| `red_card` | "Sent off" | `detail: red_card`, used alone if the above distinction can't be confirmed. |
| `full_ninety` | "Played the full match" | Minutes played == full match duration, no `subst` event removing them. |
| `clean_sheet_shield` | "Clean sheet" | `PlayerMatchPerformance.cleanSheets > 0` for a defender/goalkeeper who played ≥60 minutes — already-ingested FPL data, no new provider needed for this one. |
| `standout_rating` | "Standout performance" | Already exists — this is the existing Match Standout logic (`matchRating.ts`), included here only so the vocabulary table is complete, not a new derivation. |
| `high_defensive_output` | "Big defensive shift" | `/fixtures/players` tackles+interceptions+blocks combined ≥ a stated threshold (to be calibrated against real data during implementation, the same way `MATCH_STRENGTH_MIN` was calibrated for Match Strength) — Level 2, backed by counts, explicitly **not** claiming any specific tackle "saved" the match (that would be Level 3, §7). |
| `costly_error` | *(deliberately not included)* | Requires event-sequence causal attribution ("this player's specific action led to the goal against") — confirmed unavailable in §7. **Do not add this key until a source that supports it is found.** Included here as a negative example, not a real vocabulary entry — the brief's own example phrase is exactly the kind of claim this research found no free source can support. |

Tone: every included phrase reads as plain football reporting language ("Late winner," "Hat-trick,"
"Sent off") rather than statistical-software language ("90th-minute go-ahead goal event,
p=0.02") — matching the brief's stated goal — while staying strictly inside what §6 showed is
actually derivable. The vocabulary is deliberately short and will grow only as new, verifiable
signals are added, never by loosening the traceability rule in §8.

---

## 10. Recommended implementation approach

**Not being implemented now — this is the roadmap for a future task, and the required first step
is verification, not building.**

1. **Verification spike (a few hours, not a full task):** register a free API-Football key, and
   make a handful of real calls — `/fixtures?league=39&season=2026` (does the free plan actually
   return the *current* season, resolving §4's open risk), `/fixtures/events` for one real recent
   PL fixture (confirm the exact field names/values this session couldn't fetch directly, §0,
   especially whether card `detail` distinguishes straight-red from second-yellow), and
   `/fixtures/players` for the same fixture. Write the raw responses into
   `docs/DATA_SOURCES.md` the same way the FPL investigation did, so the schema claims in this
   document move from "corroborated via secondary sources" to "confirmed live," exactly as
   `MATCH_CENTRE_DATA_AUDIT.md` did for FPL.
2. **Cross-provider identity matching (the real engineering risk, not the API itself):**
   API-Football has its own team/player IDs, unrelated to FPL's. A `Player`/`Team` row must be
   matched by name + team + season heuristics (already-solved problem in football-data tooling
   generally, but needs building here) — with a small, logged "unresolved matches" list rather
   than a silent best-guess, matching the `playerId String?` nullability decision in §8. Do this
   matching **once**, store the resolved `(externalId → internal id)` mapping, don't re-match on
   every ingestion run.
3. **Additive ingestion module** (`lib/ingestion/apiFootball/`, mirroring the existing
   `lib/ingestion/fpl/` structure): a new, independent ingestion path writing only to `MatchEvent`
   — never touching `PlayerMatchPerformance`, `Match`, or any FPL-sourced table. If this ingestion
   fails entirely (rate limit exhausted, season not covered, provider down), the rest of the app
   is completely unaffected — this isolation is the main reason to keep it a separate table and
   module rather than merging fields into existing FPL-sourced rows.
4. **Level 2 rule engine** (`lib/analytics/keyMoments/`, alongside the existing
   `lib/analytics/scoring/` and `lib/analytics/intelligence/` directories): pure functions, one
   per `vocabularyKey` in §9, each taking `MatchEvent[]` (+ existing `PlayerMatchPerformance`/
   `MatchRating` data where relevant) and returning `PlayerKeyMoment[]` candidates. Deterministic,
   testable with Vitest exactly like the existing scoring engine — this is the same "confirmed
   rule, not a model" discipline the season Performance Intelligence work already established.
5. **Player page reprioritization — data model implication only, no UI build (per the brief):**
   the requested new information order (Performance → Performance Story → Key Moments → Season
   Performance → Analytical breakdown) requires `getPlayerProfile()` to also return a
   `keyMoments: PlayerKeyMomentRow[]` collection ordered by match kickoff, sourced from
   `PlayerKeyMoment` (§8) — additive to the existing `PlayerProfile` return shape, no change to
   any existing field. This is achievable with the schema above; actually reordering the page and
   building the timeline UI is explicitly future work.
6. **Season Story pipeline, sketched for later:** `MatchEvent` → `PlayerKeyMoment` (this doc) →
   existing `MatchRating`/`PlayerMatchPerformance` → a season-level aggregation step (not designed
   here) that would select which `PlayerKeyMoment`s are significant enough to include in a
   generated Season Story, still governed by the same vocabulary/traceability rules — i.e. a
   Season Story would be a *selection and ordering* of already-real moments, never new prose
   invented at the season level. Full design deferred to when Key Moments itself is built and
   real data exists to design against.

**What this explicitly does not do:** replace FPL, modify the scoring engine, modify the Match
Centre built last session, or commit to API-Football before its current-season coverage is
confirmed live (step 1). If step 1 fails (free plan doesn't cover the live season), the
recommendation collapses to: keep Key Moments deferred, exactly as it is today, and revisit this
research if API-Football's plans change or a new source appears — not silently fall back to a
weaker, unverified source.

---

## 11. Verification spike results (2026-08-24) — step 1 completed, outcome: BLOCKED

The step-1 spike proposed in §10 was run against the live API using a real free-tier key
(registered to this project's account). Nothing else in §10 was started — no ingestion module, no
schema, no matching logic. Full raw responses saved outside the repo
(session scratchpad, not committed) for anyone who wants to inspect them directly.

### The critical finding: current season is NOT accessible on the free plan

The `/leagues?id=39` endpoint's coverage metadata lists the 2026/27 season (`year: 2026,
"current": true`) as having full coverage (`events`, `lineups`, `statistics_fixtures`,
`statistics_players` all `true`) — this is what made the question genuinely ambiguous going in,
and it's misleading on its own: **coverage metadata describes what the provider has, not what a
given plan is allowed to query.**

A real call to `/fixtures?league=39&season=2026&status=FT` returns zero results with an explicit
error:

> `"plan":"Free plans do not have access to this season, try from 2022 to 2024."`

This resolves §4's open risk definitively, in the negative. **The free plan's accessible window is
seasons 2022, 2023, and 2024 only** — i.e. three specific past Premier League seasons, not
"current minus a lag," not "most recent N seasons" on a rolling basis, and explicitly not 2025/26
or 2026/27. This is a hard plan restriction, not a data gap, and it is not something ingestion
logic can work around.

### Everything else about the schema is confirmed real (tested against season 2023, Arsenal 2–1
Nottingham Forest, 12 Aug 2023, fixture id 1035038, plus 6 further fixtures scanned for rarer event
types)

| Field from the brief's checklist | Confirmed? | Evidence |
|---|---|---|
| Fixture, teams, final score | 🟢 | `/fixtures?league=39&season=2023&round=Regular Season - 1` returned all 10 real fixtures for one gameweek in a single call, correct scores (e.g. "Newcastle 5 - 1 Aston Villa"). |
| Event minute (incl. stoppage) | 🟢 | `time.elapsed`/`time.extra` populated correctly, e.g. a 90+2' yellow card. |
| Goal scorer | 🟢 | e.g. `player: {"name": "B. Saka"}` on a `type: Goal` event. |
| Assist | 🟢 | e.g. Saka's goal carries `assist: {"name": "W. Saliba"}`. |
| Own goal | 🟢 | Directly observed: `detail: "Own Goal"`, C. Romero, 26', real match. |
| Penalty (scored) | 🟢 | Directly observed multiple times: `detail: "Penalty"` (Ødegaard, Saka, Havertz across different matches). |
| Missed penalty | 🟡 | Not observed in this session's sample (small sample, no missed penalty happened to occur in the ~7 fixtures checked) — the `detail: "Missed Penalty"` enum value is part of the same documented schema as the confirmed values above, but wasn't literally witnessed live this session. Low risk, but re-verify the first time it matters. |
| Cards (yellow/red) | 🟢 | Both observed directly, including a straight `detail: "Red Card"` (Calvin Bassey, Fulham). Whether a second-yellow red is distinguished from a straight red in `detail` was **not** resolved — both red cards observed this session were straight reds; this remains an open question for the `second_booking` vocabulary entry in §9. |
| Substitutions | 🟢, with a schema nuance worth recording | `type: "subst"` events reuse the `player`/`assist` fields: `player` is the one going **off**, `assist` is the one coming **on** — confirmed by cross-checking against the lineup's `startXI`/`substitutes` lists. Any future ingestion code must not treat `assist` on a `subst` event as a real assist. |
| Player match statistics | 🟢 | `/fixtures/players` returned full per-player rows: minutes, position, rating, shots, passes (incl. accuracy%), tackles, duels, dribbles, fouls, cards, penalties — for every player who featured, both teams. |
| Starting XI / lineup | 🟢, and genuinely richer than expected | `/fixtures/lineups` returned formation (`4-3-3` vs `3-4-3`), starting XI with pitch-grid position, **and the full unused bench** (something FPL cannot give us at all — FPL only shows players with some involvement, never an unused substitute). |

**Two data-quality caveats worth recording**, both observed directly in the real response rather
than hypothesized: (1) many per-player statistic fields are `null`, not `0`, when not tracked for
that player/match (e.g. a nominal defensive midfielder with no logged shots) — any consumer must
treat `null` as "not recorded" and never coerce it to zero; (2) at least one pass-accuracy value in
the sample read `"127"` (a percentage over 100), an evident data-quality quirk in the source that
any Level 2 derivation touching pass accuracy should defend against, not trust blindly.

### Rate limits — confirmed via live response headers, not just docs

```
x-ratelimit-limit: 10                    (per-minute cap)
x-ratelimit-remaining: 9
x-ratelimit-requests-limit: 100          (daily cap)
x-ratelimit-requests-remaining: 98
```

Matches §4 exactly. After roughly 15 real, distinct data-returning calls in this spike (status
checks, a league lookup, a full round of fixtures, events for 7 fixtures, one players call, one
lineups call), 98 of 100 daily requests remained — direct empirical confirmation that §4's
per-gameweek estimate is realistic, not just arithmetic on paper. Confirmed exact per-gameweek
cost: **1 call** for the whole round's fixtures (not 10 — `round=` returns all fixtures for a
gameweek in one call, better than §4's worst-case assumption) **+ 10** `/fixtures/events` **+ 10**
`/fixtures/players` **+ 10** `/fixtures/lineups` (optional, for formation/bench) **= 21–31 requests
per gameweek**, comfortably inside the 100/day budget with room to spare for retries — if the
season-access blocker above didn't make the whole question moot.

### Answering the brief's six questions directly

1. **Is 2026/27 Premier League data actually accessible on the free tier? — No.** Confirmed live,
   not inferred: the free plan is hard-restricted to seasons 2022–2024. The current, live season
   this app tracks is completely inaccessible on this plan, regardless of daily request budget.
2. **Which fields are confirmed working?** All of them, for an *accessible* season (2022–2024):
   fixture/teams/score, event minute, scorer, assist, own goal, penalty (scored), cards,
   substitutions, full player match statistics, and starting XI/lineup with formation and full
   bench. Only "missed penalty" wasn't directly witnessed (sample-size gap, not a schema doubt) and
   whether second-yellow reds are distinguishable from straight reds in `detail` is still open.
3. **Exact request count for one gameweek:** confirmed **21 requests** for fixtures + events +
   player stats (1 + 10 + 10), or **31** if lineups/formations are also wanted (+10).
4. **Is the 100/day limit sufficient?** Yes, decisively — under half the daily budget for a full
   gameweek including lineups, empirically demonstrated, not just estimated. This was never the
   real constraint.
5. **Any licensing/usage concern that changes the decision?** No new one beyond §5 — the season
   restriction is a *plan* limitation, not a licensing one, and doesn't change the earlier
   assessment of API-Football's terms (non-commercial personal use of factual match events being
   comparatively low-risk, still not a zero-risk redistribution license).
6. **Recommend proceeding with API-Football as a secondary event provider? — Not on the free
   plan, not for this app's actual need.** The schema, richness, and rate limit are all genuinely
   good — better than this research's earlier best-effort documentation review suggested in a few
   places (round-level fixture batching, a full unused bench in lineups). But a source that
   cannot see the current season cannot power live Key Moments for live matches, which is the
   entire point. Recommendation: **do not proceed with API-Football's free plan for this feature.**
   Options worth a future decision (not started here): (a) revisit if API-Football ever changes
   the free plan's season window; (b) evaluate whether a paid API-Football tier (pricing not
   investigated in this spike) is worth the cost once/if the product's value justifies it;
   (c) treat this as confirmation that Key Moments stays correctly deferred, exactly as
   `docs/MATCH_CENTRE_DATA_AUDIT.md` already concluded, until a free source that covers the
   *current* season is found. Nothing evaluated in §1 changes this — the other free sources were
   already ruled out for independent reasons unrelated to season coverage.

---

## 12. SofaScore & ESPN investigation (2026-08-24, continued)

**Read this paragraph before the rest of this section.** Both sources were investigated
thoroughly, as requested. For both, the very first thing checked — before any technical
verification — was whether the provider's own published terms actually permit this kind of use.
For both, the answer came back as an **explicit, unambiguous prohibition**, not an "unclear" grey
area. Per this document's own standing rule (§5: "technically scrapeable... was explicitly treated
as insufficient on its own — a source needed either an explicit API terms-of-service that permits
this kind of use, or a stated open-data license, to be recommended"), that finding alone settles
the recommendation for both sources (§12.13) regardless of how good the underlying data turns out
to be. **Because of this, live verification calls against either source's endpoints were
deliberately NOT executed in this session** — making repeated programmatic requests against
endpoints whose owner's terms explicitly forbid exactly that would itself be the prohibited
conduct, and would contradict the brief's own instruction not to bypass restrictions. Technical
capability below is therefore assessed from already-published, independent third-party
documentation (open-source wrapper projects' own docs, which necessarily had to make real calls
to write that documentation, and public forum/community reporting) — not confirmed live by this
session against an actual current 2026/27 fixture. This is flagged explicitly per §3's
current-season-verification requirement, and is a materially weaker form of evidence than the
live-tested findings in §11 — treat everything technical below as "credibly documented,
independently corroborated, not independently re-verified here," never as confirmed fact.

### 12.1 SofaScore findings

SofaScore's main site/app is backed by an unauthenticated JSON API
(conventionally `api.sofascore.com/api/v1/...`) that a substantial community of open-source
wrapper projects has reverse-engineered and documented (`apdmatos/sofascore-api`,
`victorstdev/sofascore-api-stats`, the Python `ScraperFC` library, others). No API key, signup, or
authentication of any kind is involved — which is precisely why the community documentation exists
in the first place, and precisely why SofaScore's terms address it directly (§12.7).

### 12.2 ESPN findings

ESPN's public-facing endpoints (`site.api.espn.com/apis/site/v2/sports/soccer/eng.1/...`, plus a
separate `sports.core.api.espn.com` surface for deeper data) are the same unauthenticated JSON
APIs that power espn.com and the ESPN app. ESPN retired its formal, registration-based developer
API program in 2014; everything now documented by the community (`pseudo-r/Public-ESPN-API` and
others) is the same category of reverse-engineered, undocumented-by-the-vendor surface as
SofaScore, just without a key requirement. One independent, current signal worth weighting
seriously: community discussion found during this research explicitly reports **ESPN actively
tightening access to these endpoints recently**, with some users needing to switch hosts
(`site.api.espn.com` → `site.web.api.espn.com`) after hitting permission errors — i.e. this isn't
a hypothetical future risk, it's already happening.

### 12.3 Current-season verification

**Not performed, deliberately, per the explanation above.** Neither source's current-2026/27-season
coverage was confirmed live this session. Community documentation for both projects is written
against whatever season was current when each doc/library was last updated, which is not a
substitute for a live check — but a live check was the wrong thing to run here given §12.7.

### 12.4 Exact fields available (as documented by third parties, not live-verified — see header)

**SofaScore**, per `apdmatos/sofascore-api` and `ScraperFC`'s own documentation:

| Data | Endpoint (documented) | Notes |
|---|---|---|
| Tournament/season discovery | `/unique-tournament/{id}/seasons` | Standard discovery pattern. |
| Events by round | `/unique-tournament/{id}/season/{id}/events/round/{n}` | |
| Match incidents (goals, cards, subs) | `/event/{id}/incidents` | Documented fields: `minute`, `incidentType` (e.g. `"card"`), `incidentClass` (e.g. `"red"`), `player`, `reason`. Structurally similar in shape to API-Football's event schema (§3), independently corroborated. |
| Momentum/graph | `/event/{id}/graph` | `minute` + `value` points — a genuinely distinctive signal not found in any other source investigated across both research sessions; closest thing to a "flow of the game" proxy. |
| Shot data (incl. locations) | Wrapped by `scrape_match_shots()` in ScraperFC | If field-accurate, this would be the **first shot-coordinate source found in this entire research effort** — significant, if it could legitimately be used (it can't, §12.7). |
| Player/team match statistics | `scrape_player_match_stats()`, `scrape_team_match_stats()` | Documented as comprehensive; exact field list not independently confirmed here. |
| Heatmaps | `scrape_heatmaps()` — "x-y coordinates to create a player heatmap" | Real positional data, per third-party documentation. |
| Average positions | `scrape_player_average_positions()` | |
| Lineups/formation | Not found as a dedicated documented endpoint in the primary doc checked, though the event payload reportedly carries `hasEventPlayerStatistics`/`hasEventPlayerHeatMap` flags implying the data exists elsewhere in the response tree. |
| xG | Not confirmed by any source checked. |

**ESPN**, per `pseudo-r/Public-ESPN-API` and community gists:

| Data | Endpoint (documented) | Notes |
|---|---|---|
| Scoreboard/fixtures | `/apis/site/v2/sports/soccer/eng.1/scoreboard` | Confirmed pattern, `?dates=YYYYMMDD` filter. |
| Match summary | `/summary?event={id}` | Described as a "full match report" — exact field breakdown not confirmed. |
| Play-by-play (goals, cards, subs) | `/events/{id}/competitions/{id}/plays?limit=300` (Core API host) | Documented as covering "goals, cards, subs" — field-level detail (timestamp format, player attribution) not independently confirmed by this research. |
| Live context | `/situation` (possession, in-game state), `/probabilities` (win probability) | |
| Rosters | `/teams/{id}/roster` | |
| Individual player match statistics | Explicitly flagged as a **gap** by the community documentation itself: soccer player `/stats` and `/gamelog` endpoints reportedly return errors — ESPN's hidden API's soccer coverage is weaker here than its American-sports coverage. |
| Commentary | Not confirmed as a distinct field in soccer specifically. |
| Shots / xG | Not confirmed by any source checked. |

### 12.5 API accessibility

Both are **unauthenticated, no-key, no-signup HTTP JSON APIs** — reachable with a plain GET
request, which is exactly why both are popular reverse-engineering targets and exactly why both
providers felt the need to write explicit prohibition clauses (§12.7). Neither offers an
account-based free tier, a developer portal, or an API key — there is no "free plan" to speak of
in the API-Football/football-data.org sense; there is only an undocumented surface that happens to
be publicly reachable.

### 12.6 Rate limits

**Neither source publishes any rate limit, quota, or usage policy for these endpoints** —
unsurprising, since neither officially acknowledges the endpoints as an API product at all.
Community documentation for both explicitly warns to "keep request volume reasonable and cache
responses" as an informal courtesy, not a stated contractual allowance. This is a meaningfully
different risk shape from API-Football's 100/day (a real, published, enforced number you can plan
around) — here, there is no number, which in practice means **the provider can rate-limit, block,
or change the response shape at any time with no notice and no recourse**, and the earlier ESPN
"tightening access" report (§12.2) shows this already happening in the wild.

### 12.7 Usage/licensing considerations — the decisive finding

**SofaScore** — directly confirmed from their published Terms of Service: *"You must not use any
automated means to use the Platform, such as the use of robots or scripts, scraping, crawling,
simulation or automated browsing techniques"* and separately, the granted license *"does not
include any resale or commercial use of the Platform or its contents... or any use of data mining,
robots, or similar data gathering and extraction tools."* This is categorical and leaves no
reasonable interpretation under which calling their JSON API programmatically — for any purpose,
commercial or not — is permitted.

**ESPN** — governed by Disney's Terms of Use (ESPN's own terms page routes there). Directly
confirmed: *"[Users may not] access, monitor, copy or extract the Disney Products using a robot,
spider, script, or other automated means, including... for the purposes of creating or developing
any AI Tool, data mining or web scraping or otherwise compiling, building, creating or
contributing to any collection of data, data set or database"* — with a narrow, explicitly stated
exception only for public search-engine indexing crawlers respecting `robots.txt`. Building a
database of match events by calling ESPN's hidden endpoints is precisely the conduct this clause
describes and prohibits.

Both, in other words, are **not** "usage rights unclear" — the brief's fallback framing for a
genuinely ambiguous case. Both are **explicit, direct prohibitions**, discovered by reading each
provider's own published terms, not inferred or assumed.

### 12.8 Level 1 (factual) capability

**Technically plausible per third-party documentation** — SofaScore's `incidents` endpoint and
ESPN's `plays` endpoint both appear structurally capable of "67' — Goal — Player X" style facts,
in the same shape as API-Football's confirmed schema (§3, §11). **Not usable regardless**, per
§12.7 — a Level 1 fact is exactly as unusable as a Level 3 one when the source itself is
off-limits; the data-richness ladder in this document has never been a substitute for the
legality gate, and this is the clearest case yet of why that gate has to be checked first.

### 12.9 Level 2 (derived interpretation) capability

Same answer as §12.8 — if the Level 1 event stream were usable, the same deterministic-rule
approach from §6 of this document would apply unchanged (a rule engine doesn't care which source
fed it a compliant event stream). Moot for SofaScore/ESPN specifically, for the same reason.

### 12.10 Level 3 (qualitative) capability

This is the one place SofaScore's documented capability genuinely changes the technical picture
from every other source investigated across both research sessions — **if** momentum/graph data,
shot locations, and heatmaps are as real as the third-party documentation suggests, several Level
3-adjacent phrases move from "impossible, no source has this" to "technically constructible, from
a source we cannot legitimately use":

| Level 3 phrase | Newly plausible with, e.g., shot-location + heatmap data? |
|---|---|
| "Top bins" / "banger" | Closer — shot coordinates could support placement-based language, still short of confirming *contact quality*. |
| "Dominated his wing" / "pocketed the striker" | Closer — average-position and heatmap data is exactly the positional signal §7 of this document identified as missing everywhere else. |
| "Brilliant save" / "outrageous stop" | Still likely short — would need shot-difficulty/post-shot-xG modelling on top of raw coordinates, not confirmed present. |
| "Costly error" | Still short — still requires causal event-sequence attribution, not confirmed present in the incidents feed. |

**This finding should not be read as an argument for using SofaScore.** It's recorded because it's
genuinely informative for future source evaluation: it demonstrates that shot-location/heatmap/
momentum-shaped data is the specific missing ingredient for Level 3, and that this shape of data
does exist somewhere in the free-adjacent ecosystem — which makes it worth continuing to look for
a **legitimately licensed** provider offering the same *shape* of data, rather than concluding
Level 3 is permanently and categorically impossible for this app. It remains categorically
impossible **from this source**, today, per §12.7.

### 12.11 Match Narrative capability

Answering the brief's general analytical question — what would be needed for a
"Newcastle looked in control... Liverpool rescued a point with a late equaliser" style
narrative — independent of which source might one day supply it, since the specific sources here
are disqualified:

| Narrative component | Requires |
|---|---|
| "Liverpool rescued a point with a late equaliser" | Level 1 event (goal, minute, scoreline context) + Level 2 rule (§6's `late_equaliser`) — **buildable from an event stream alone**, exactly as already scoped in §6/§9 of this document. |
| "Newcastle looked in control for long periods" | A claim about **sustained match state over time**, not a single event — needs either a possession/territory time-series (SofaScore's `graph`/momentum endpoint is structurally the right *shape* of data for this, notably) or shot-frequency-over-time as a proxy. Not available from any source this document has found a legitimate way to use. |
| "...and appeared to have done enough for the win" | A framing/expectation claim layered on top of the above — a phrasing choice once the underlying "who was on top, when" fact exists, not a new data requirement by itself. |

**Conclusion:** the *scoreline-and-key-events* half of a Match Narrative is already buildable
today from a compliant Level 1/2 source (§6 of this document, once such a source exists). The
*"who controlled the match and when"* half specifically wants time-series match-state data — the
one genuinely new category this SofaScore/ESPN investigation surfaced as existing at all in the
free-adjacent ecosystem, momentum/graph endpoints — which sharpens exactly what a *future*
legitimate source needs to offer, without recommending either investigated source to supply it.

### 12.12 Player Narrative capability

Same structure as §12.11, applied to the brief's Hall example: *"Hall produced one of his
strongest defensive performances of the season, repeatedly disrupting Liverpool's attack, but a
late mistake contributed to the equaliser."*

- **"one of his strongest defensive performances of the season"** — this clause is not a Key
  Moments question at all; it's a Performance Intelligence question already answered by this
  app's existing architecture (`lib/analytics/intelligence/`, Match Rating from the previous
  session) — a season-relative defensive-category comparison, buildable **today**, no new data
  source needed. Worth stating plainly since it's easy to conflate "narrative" with "needs new
  event data" when part of the sentence never needed it.
- **"repeatedly disrupting Liverpool's attack"** — a Level 2-shaped claim (count of tackles/
  interceptions/blocks, already available even from FPL-adjacent stats in some form, richer from
  API-Football's schema per §3) — buildable from a compliant event/stats source, not from FPL
  alone at this granularity.
- **"a late mistake contributed to the equaliser"** — this is the exact `costly_error` case §9 of
  this document already declined to add to the vocabulary, for the same reason repeated there:
  causal event-sequence attribution isn't confirmed present in *any* source investigated across
  either research session, including SofaScore/ESPN's documented incident feeds. Still not
  derivable from data, categorically, regardless of source legality.

### 12.13 Recommended source

**Neither.** This is not a close call or a "usable with caveats" situation — both SofaScore and
ESPN carry direct, explicit, unambiguous contractual prohibitions on the exact conduct required to
use them as a data source (§12.7), independent of and prior to any technical capability question.
Per this document's own established rule (§5), that alone is disqualifying. No source recommended
by this section of the research.

### 12.14 Risks

- **Legal/contractual risk** — both providers explicitly reserve enforcement rights (account
  termination for SofaScore-branded properties; Disney's terms carry the same general reservation
  across its portfolio). Building product infrastructure on a source whose owner has explicitly
  prohibited that exact use is a directly stated risk, not a speculative one.
- **Operational risk** — no published rate limit or stability guarantee for either; ESPN is
  independently reported to be actively tightening access right now (§12.2). An ingestion pipeline
  built on either could break or get blocked with zero notice, at any time, for reasons entirely
  outside this project's control.
- **Credibility risk, specific to this project** — this app's own stated design principle,
  repeated throughout `docs/MATCH_CENTRE_DATA_AUDIT.md` and this document, is "credibility over
  feature completeness." Building the richest part of the product on a data source obtained in
  violation of its provider's terms is in direct tension with that principle, independent of
  whether the legal risk ever materializes in practice.

### 12.15 Recommended next step

**Do not implement against either source.** Key Moments and Match Narrative stay deferred, exactly
as `docs/MATCH_CENTRE_DATA_AUDIT.md` and §10/§11 of this document already concluded — this
investigation adds detail and forecloses two more candidates, it does not change the bottom line.
If this capability continues to matter enough to keep pursuing, the legitimate paths worth a
future, narrower look are: (a) directly contacting a provider (API-Football, Sportmonks, or even
SofaScore/ESPN/Opta) about a licensed arrangement rather than an unauthenticated endpoint — some of
these vendors do sell exactly this kind of access, just not for free; (b) periodically re-checking
whether API-Football's free-plan season window ever changes (§11); (c) checking whether the
Premier League or its data partners run any developer/media program with a free or low-cost tier
not yet investigated. None of these are started here — this remains a research-only conclusion,
not a task to pick up next.
