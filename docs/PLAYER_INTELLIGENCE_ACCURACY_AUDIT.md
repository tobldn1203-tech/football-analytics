# Player Intelligence Accuracy Audit — the Lacroix Case

**Status:** Investigation only. No production code, formulas, weights, thresholds, UI, or schema were changed. Verified at the end (see "Verification") that `tsc --noEmit`, `vitest run`, and `next build` all pass unchanged.

> **Update — §9's data-enrichment finding has since been implemented.** `tackles`, `clearancesBlocksInterceptions`, and `recoveries` are now ingested from the same FPL live-gameweek endpoint and stored as three new nullable `PlayerMatchPerformance` columns, alongside the existing (unchanged) combined `defensiveActions` field. All 310 GW1 performance rows, including Lacroix's, were backfilled with real values through the existing idempotent ingestion — no fabrication, no new data source. Confirmed via re-run: Lacroix's `defensiveActions=12` is unchanged, and his Match Rating (Attack 3.3 / Creation 8.8 / Defence 6.2 / Impact 7.4 / Overall 6.4) is byte-for-byte identical before and after — this was a pure data-enrichment change, nothing in §2–§11's scoring analysis or conclusions has changed, and no formula has been touched. The Defence methodology question this audit raised (§4, §10, §11) remains open and is the recommended next investigation, now with richer raw data available to inform it.

**Subject:** Maxence Lacroix (`lacroix-200`), Chelsea centre-back, vs Fulham (away), Gameweek 1, 2026/27 — the only Chelsea match played so far this season. Final score: Fulham 2–3 Chelsea.

Every number in this document was produced by calling the app's real, unmodified scoring functions (`computeProvisionalRankings`, `getGameweekRatings`, `percentileRank`, `intelligenceFromProfile`, `buildSeasonStory`, `classifyArchetype`, `explainPlayer`) against the live production database, via throwaway scripts that were deleted afterward. Nothing here is hand-calculated or approximated.

---

## Executive Summary

Lacroix played the full 90 minutes, registered an assist (xA 0.2), and made 12 defensive actions — which turns out to be the **2nd-highest defensive-action count among Chelsea's own defenders that match**, and **88th percentile among all 87 eligible Premier League defenders in Gameweek 1**. By the numbers a knowledgeable fan can't see (raw per-90 defensive workrate), this genuinely was one of the more defensively active performances by a defender in the league that week — corroborating the fan's live impression.

Yet the app's Match Rating for Lacroix is **6.4 / "Good"**, and his Defence category score specifically is **6.2 / "Good"** — solidly mid-table among defenders, not a standout. This is a real, evidence-based discrepancy, not a misreading of the product.

**Root cause is a combination of three things, not one:**

1. **A genuine (small, fixable) data gap.** FPL's own live-gameweek feed — the exact endpoint we already call — separately reports `tackles`, `clearances_blocks_interceptions`, and `recoveries` for every player. We only ingest their sum (`defensive_contribution`) and discard the breakdown. This isn't a case of "the data doesn't exist"; it's a case of "we already have it and aren't using it."
2. **A scoring formula effect.** For outfield defenders, the Defence score is an unweighted 50/50 average of (a) percentile of individual defensive actions and (b) whether the *team* kept a clean sheet. Chelsea conceded twice, so Lacroix's clean-sheet term sits at the 35th percentile (tied with every other defender on a team that conceded) regardless of what he personally did — and that team-level binary drags an individually-88th-percentile game down to a blended 62nd percentile. This is not a bug in the sense of broken code; it is the formula behaving exactly as designed, doing something a fan wouldn't expect: crediting a defender's line for a scoreline he may not be personally responsible for.
3. **An interpretation/narrative gap.** Match Centre's "match strength" logic surfaces only the single *highest* qualifying category per player — for Lacroix that's Creation (8.8), so "Defending" (6.2, which also clears the bar) is never mentioned at all. Season Story and Strengths are correctly silent this early (only 1 match played — that's deliberate, documented, confidence-gating, and correct), but that leaves genuinely no generated sentence anywhere that says "he also defended soundly" — only a bare 6.2 number, next to an assist-driven 8.8.

This is **not** an isolated Lacroix anomaly. Section 7 shows the same clean-sheet-driven pattern affecting Virgil van Dijk (4.8, "Average"), Harry Maguire (4.3, "Average") and Luke Shaw (3.8, "Below average") in the same gameweek — all on teams that conceded, none of whom the data suggests personally "defended badly."

**Bottom line, answering the brief's closing questions directly:**

> *Can our current data and intelligence system accurately recognise an excellent individual defensive performance when the team concedes?* **Not reliably, no.** The individual signal (defensive actions) is captured correctly and would rank him near the top of the league that week — but it's blended 50/50 with a team-result binary that can override it, and nothing downstream currently rescues that with narrative context.

> *What's the smallest realistic change, using legitimate free data, that moves this materially forward?* **Ingest the three defensive sub-fields (`tackles`, `clearances_blocks_interceptions`, `recoveries`) that FPL's live-gameweek endpoint already returns in the exact payload we already fetch.** No new API, no new licensing question, no scraping — just parsing three fields we're currently throwing away. That alone doesn't fix the clean-sheet weighting (a separate, deliberate formula decision the team should make with more than one gameweek of evidence), but it's the necessary, low-risk first step, and it's real, not speculative — confirmed present in a live fetch during this investigation (see §9).

---

## 1. Raw Data Audit

Lacroix's stored `PlayerMatchPerformance` row for FUL 2–3 CHE (GW1):

| Field | Value |
|---|---|
| Minutes | 90 (started) |
| Goals | 0 |
| Assists | **1** |
| Clean sheet | 0 (Chelsea conceded 2) |
| Goals conceded | 2 |
| Yellow/red cards | 0 / 0 |
| Saves | 0 (n/a, outfield) |
| Bonus | 0 |
| BPS | 25 |
| Expected goals (xG) | 0.00 |
| Expected assists (xA) | 0.20 |
| Expected goals conceded (xGC) | 1.33 |
| Defensive actions | **12** |
| ICT index (stored) | 0 — see note below |

**Note on ICT index:** every player in the database currently shows `ictIndex: 0`, not just Lacroix. This is not a new bug — `provisional.ts` already documents that FPL reports ICT index as 0 until a gameweek is "finalized," and the engine deliberately uses BPS instead for exactly this reason (see §5 and §12). A fresh fetch of FPL's live endpoint during this investigation shows Lacroix's ICT index is now `5.7` — the underlying data has since been finalized upstream, but our stored copy is stale because we haven't re-run ingestion since. This has **zero effect on scoring** (ICT index isn't used by any formula), but it is a minor, easily-fixed data-freshness gap worth a mention.

### Comparison — other Chelsea players in the same match (sorted by BPS)

| Team | Pos | Player | Min | G | A | BPS | Def. actions | xG | xA | xGC |
|---|---|---|---|---|---|---|---|---|---|---|
| CHE | MID | Palmer | 82 | 1 | 1 | 60 | 9 | 0.28 | 0.19 | 1.24 |
| CHE | FWD | João Pedro | 90 | 1 | 1 | 45 | 3 | 0.63 | 0.06 | 1.33 |
| CHE | MID | Rogers | 81 | 1 | 0 | 37 | 7 | 0.96 | 0.10 | 1.24 |
| **CHE** | **DEF** | **Lacroix** | **90** | **0** | **1** | **25** | **12** | **0** | **0.20** | **1.33** |
| CHE | DEF | Acheampong | 90 | 0 | 0 | 13 | 15 | 0 | 0.01 | 1.33 |
| CHE | GKP | Sánchez | 90 | 0 | 0 | 6 | 0 | 0 | 0.01 | 1.33 |
| CHE | DEF | Colwill | 90 | 0 | 0 | 6 | 4 | 0.01 | 0.03 | 1.33 |
| CHE | DEF | James | 90 | 0 | 0 | 5 | 6 | 0.10 | 0.07 | 1.33 |
| CHE | DEF | Hato | 64 | 0 | 0 | 5 | 3 | 0.01 | 0.03 | 1.05 |
| CHE | DEF | Gusto | 75 | 0 | 0 | 2 | 3 | 0 | 0.03 | 1.11 |
| CHE | DEF | Chavarria | 25 | 0 | 0 | 3 | 1 | 0 | 0 | 0.28 |

**Lacroix was Chelsea's highest-BPS defender in this match**, and had the 2nd-most defensive actions among Chelsea's back line (Acheampong's 15 in the same 90 minutes edges him out).

### Comparison — all 108 defenders who featured in GW1, leaguewide

Full table generated and reviewed (108 rows); headline figures: defensive-action counts ranged from 0 to 21 (Egan, Hull, highest), BPS from −14 to 46. Lacroix's `defensiveActions=12` sits solidly in the upper third of that full distribution — see §3 for the exact percentile.

**Conclusion for this section:** the raw data does **not** show a discrepancy at the input level. Lacroix's assist, minutes, and defensive-action count are all captured correctly and are genuinely good numbers relative to his peers. The discrepancy originates further down the pipeline (§2–§6).

---

## 2. Scoring Pipeline — the trace

### Step 1: Per-90 normalisation

`defensiveActions` and `cleanSheets` are normalised to per-90 rates. With 90 minutes played, Lacroix's raw and per-90 values are identical:

```
defensiveActions per90 = (12 / 90) * 90 = 12.0
cleanSheets     per90 = (0  / 90) * 90 = 0.0
```

### Step 2: Percentile rank within the position-relative cohort

Defence is computed **position-relative** (see `provisional.ts`, `defenceMetricsForPosition`): for a `DEF`, the metrics are `["defensiveActions", "cleanSheets"]`, percentile-ranked against every other eligible defender in the same cohort (here: every DEF who played ≥45 minutes in GW1, leaguewide — 87 players).

```
defensiveActions percentile (12.0 per90, among 87 defenders) = 88.4
cleanSheets     percentile (0.0 per90, among 87 defenders)   = 35.5
```

The clean-sheet percentile of 35.5 is not a low individual score — it is the **average rank of the entire block of defenders whose team conceded**, which this gameweek was roughly half the cohort. Every non-clean-sheet defender gets exactly this same 35.5, regardless of how they defended.

### Step 3: Average the two percentiles, scale to 0–10

```
Defence score = ((88.4 + 35.5) / 2) / 10 = 6.19 → rounds to 6.2
```

This exactly matches the app's real, live output (`defence: 6.2`).

### Step 4: Attack, Creation, Impact (league-wide cohorts)

These use the same percentile mechanism but against **all eligible players regardless of position** (the metric means the same thing for everyone):

| Category | Metrics (per-90) | Lacroix's percentile(s) | Score |
|---|---|---|---|
| Attack | goals, xG | 0th, ~30th | **3.3** |
| Creation | assists, xA | ~90th (1 assist per90), ~85th (0.2 xA per90) | **8.8** |
| Impact | bps | ~74th | **7.4** |
| Form | recency-weighted bps | (identical to Impact — only 1 match exists) | **7.4** |

The assist is captured and rewarded generously and correctly — Creation is his highest category by a wide margin.

### Step 5: Position-weighted Overall

`OVERALL_WEIGHTS.DEF = { attack: 0.15, creation: 0.15, defence: 0.45, impact: 0.25 }`:

```
Overall = 3.3×0.15 + 8.8×0.15 + 6.2×0.45 + 7.4×0.25
        = 0.495 + 1.32 + 2.79 + 1.85
        = 6.455 → rounds to 6.4
```

This exactly matches the app's real, live Match Rating output (`overall: 6.4`, label "Good").

**The formula is executing exactly as designed at every step.** There is no bug in the arithmetic. The issue is entirely in what the Defence formula's two inputs *mean* (§4) and how the result is *communicated* (§6).

---

## 3. Cohort / Percentile Audit

**Cohort used:** every player who played ≥45 minutes in **Gameweek 1** (Attack/Creation/Impact/Form: leaguewide, n≈250+; Defence: position-relative, n=87 defenders). This is the correct, intended cohort per `matchRating.ts`'s own documentation — a full gameweek, not just the two teams in the fixture (too thin — "maybe 4 centre-backs across both sides").

**Important caveat specific to right now:** because Chelsea (and the whole league) has played exactly one gameweek this season, "this gameweek's cohort" and "this season's cohort" are currently identical. This is a temporary artefact of season age, not a flaw — it will resolve naturally as more gameweeks accumulate and a player's *season* Performance becomes a genuine multi-match aggregate distinct from any one match's Rating. It does mean that right now, every "Performance" score in the app is exactly as volatile as its single Match Rating — worth remembering when reading any current score as if it were a stable season judgement.

**Cohort size (87 eligible defenders) is statistically reasonable** — large enough that a single outlier doesn't swing the percentile distribution, and large enough that ties (many defenders sharing `cleanSheets=0`) get averaged fairly via `percentileRank`'s fractional-rank tie handling.

**Does an attacking return (goal/assist) distort the Defence percentile itself?** No — verified directly: `defenceMetricsForPosition("DEF")` only reads `defensiveActions` and `cleanSheets`. A defender's goal or assist has zero direct effect on his own or anyone else's Defence percentile. It does correctly raise their **Overall** score (via Attack/Creation), which is by design, not a distortion.

**Conclusion:** the system is behaving statistically correctly on a cohort that is appropriately chosen and reasonably sized. The unintuitive result is not a cohort/percentile problem — it's what's being percentile-ranked (§4).

---

## 4. Position Weighting Audit

`OVERALL_WEIGHTS` by position:

| Position | Attack | Creation | Defence | Impact |
|---|---|---|---|---|
| GKP | 0 | 0 | 0.60 | 0.40 |
| **DEF** | **0.15** | **0.15** | **0.45** | **0.25** |
| MID | 0.30 | 0.30 | 0.15 | 0.25 |
| FWD | 0.45 | 0.20 | 0.05 | 0.30 |

For defenders, Defence correctly carries by far the largest single weight (45%) — the intent ("does Defence dominate a defender's score the way it should") is sound and working as designed. **The weighting between categories is not the problem.**

**The problem is one level down: what "Defence" is made of for a DEF.** It's an unweighted 50/50 split between:
- an *individual* stat (defensive actions), and
- a *team-result* stat (clean sheet) that a lone good defender cannot fully control when conceded goals stem from elsewhere on the pitch (a goalkeeping error, a different defender's mistake, a wonder-strike, a set piece marking failure by someone else).

Giving that binary team outcome the same 50% weight as the player's own measured activity is a defensible starting hypothesis (clean sheets obviously correlate with good defending on average), but this case shows it can materially suppress a genuinely strong individual showing. This is squarely a **scoring** finding, not a weighting-between-categories finding.

**Does the assist get handled sensibly?** Yes. It flows into Creation (never Defence), Creation correctly carries only 15% of a defender's Overall (appropriately modest — a single created chance shouldn't outweigh a defender's primary job), and nothing dilutes or double-counts it elsewhere. This part of the system is working as intended.

---

## 5. BPS Influence

Traced precisely, BPS (FPL's own match-contribution score) currently feeds:

| Downstream metric | How much of it is BPS? |
|---|---|
| Impact | 100% (single input: percentile of bps per-90) |
| Form | 100% (single input: percentile of *recency-weighted* bps per-90 — currently identical to Impact, since only 1 match exists) |
| Defence | **0%** — not used at all |
| Attack / Creation | **0%** — not used at all (goals/xG and assists/xA only) |
| Overall (DEF) | 25% (via Impact's weight) |
| Consistency / Momentum | Currently **not computable for anyone** — see below |

**BPS is not the cause of Lacroix's result.** His BPS-driven Impact score (7.4, "Very good") is one of his *better* categories, not a drag on his rating. The shortfall is entirely in the non-BPS Defence formula (§2–§4).

**Consistency and Momentum:** `consistency.ts` requires ≥3 qualifying matches, `momentum.ts` requires ≥4. With only one gameweek played leaguewide, **both are currently unavailable for every single player in the app**, confirmed directly on Lacroix's own Player Intelligence object (`"consistency": { "available": false, ... }`, `"momentum": { "available": false, ... }`). This is correct, deliberate gating — not a Lacroix-specific issue — but it means BPS's influence on those two layers is currently moot and can't yet be assessed either way.

---

## 6. Intelligence Interpretation

Generated live, for real, from Lacroix's actual current data:

**Season Story** (shown on his player page):
> "Early signs for Lacroix this season are good, based on just 1 match so far. Too early to draw firm conclusions about Lacroix's identity as a player — that picture will get clearer over the coming weeks."

Appropriately cautious for a 1-match sample (this is deliberate, documented confidence-gating consistent with the rest of the product — not a bug) — but it says nothing about defending, creation, or the assist specifically. It's the same generic sentence any low-confidence player would get.

**`explainPlayer()` strengths list** (the more granular breakdown):
```
🎯 Early creative impact — "Based on 1 match so far — an early signal, not yet a proven strength."
💥 Early match impact   — "Based on 1 match so far — an early signal, not yet a proven strength."
📈 Early form signal     — "Based on 1 match so far — an early signal, not yet a proven strength."
🛡️ Early defensive impact — "Based on 1 match so far — an early signal, not yet a proven strength."
```
Defending **is** mentioned here — but every category gets byte-for-byte identical boilerplate text regardless of the actual number behind it (8.8 Creation reads exactly the same as 6.2 Defence). There's no differentiation communicating that Creation was exceptional and Defence was solid-but-unremarkable.

**Archetype:** `"Attacking Defender"` — *"A defender who gets involved in attack and chance creation more than most, without giving up defensive output."* This is a genuinely accurate, well-fitting label given his actual dimensions (Attack 3.3, Creation 8.8, Defence 6.2, Impact 7.4), correctly tagged "Limited confidence / Early profile." **This part of the system is working well.**

**`detectStrengths` (Season "What's working"):** returns nothing at all (`primaryStrengths: []`) — by design, `detectStrengths` refuses to name a season "strength" below "low" sample confidence (< 3 matches), regardless of the category score. Correct, deliberate, not Lacroix-specific.

**Match Centre "Match Strength" tag** (`pickMatchStrength` in `matchRepository.ts`): picks the single *highest*-scoring category above 5.5. Lacroix qualifies on **two** categories (Creation 8.8, Defence 6.2) but the function can only ever return one — Creation wins, so his squad-list tag reads **"Creation"**, and "Defending" is never surfaced anywhere in Match Centre for him, despite clearing the same bar. This is a real, mechanical, concrete interpretation gap: the UI has a genuinely qualifying defensive trait and structurally cannot display it alongside another qualifying trait.

**Match Centre "Strongest Defence" leader** (per-team, via `computeLeaders`): compares Chelsea's own players' Defence scores. Acheampong (6.5) narrowly beats Lacroix (6.2) for that specific slot — so even within his own team's leader board, Lacroix would not be tagged "strongest defence" for this match, by a margin of 0.3.

**Match Standout:** the single highest-Match-Rating player across the whole fixture — Palmer (2 direct goal involvements, easily the match's highest BPS) is the correct, uncontroversial pick. This isn't a flaw; Palmer likely was the standout. But it does mean the *only* prose-generating mechanism in Match Centre is spoken for, leaving Lacroix's solid-but-not-headline day represented by nothing but a bare 6.4 number.

**Summary of this section:** two genuine interpretation gaps (Match Strength can only show one trait; there's no per-player match narrative below the single Standout slot), one working-as-intended gate (Season Story/Strengths confidence gating), and one component that's actually working well (Archetype).

---

## 7. Comparison Players

Real Match Ratings, GW1, via the same production function:

| Player | Team | Attack | Creation | Defence | Impact | **Overall** | Label |
|---|---|---|---|---|---|---|---|
| Mendy | HUL | 9.4 | 2.8 | 9.9 | 9.8 | **8.7** | Excellent |
| White | ARS | 6.1 | 8.9 | 5.7 | 9.2 | **7.1** | Very good |
| Egan | HUL | 3.3 | 2.8 | 9.1 | 7.6 | **6.9** | Good |
| **Lacroix** | **CHE** | **3.3** | **8.8** | **6.2** | **7.4** | **6.4** | **Good** |
| Guéhi (scored) | MCI | 9.3 | 6.9 | 2.7 | 8.5 | **5.8** | Good |
| Castagne (2 assists) | FUL | 5.5 | 9.1 | 3.8 | 6.7 | **5.6** | Good |
| Acheampong | CHE | 3.3 | 3.6 | 6.5 | 4.5 | **5.1** | Average |
| Virgil van Dijk | LIV | 6.3 | 3.6 | 6.0 | 2.6 | **4.8** | Average |
| Maguire | MUN | 4.9 | 7.1 | 2.7 | 5.2 | **4.3** | Average |
| Shaw | MUN | 3.3 | 6.7 | 2.7 | 4.5 | **3.8** | Below average |

Notes:
- **Mendy and Egan** (both Hull, both clean sheets) show what a "genuinely excellent, correctly-recognised" defensive Match Rating looks like — the formula works well *when* the team also keeps a clean sheet.
- **Guéhi and Castagne** both had strong attacking returns (a goal, two assists respectively) on teams that didn't concede a clean sheet — their Defence scores (2.7, 3.8) are actually *lower* than Lacroix's, dragging their Overall down despite a flashier scoreline contribution. This confirms the clean-sheet effect isn't unique to Lacroix's case.
- **Van Dijk, Maguire, Shaw** — three well-established, generally well-regarded defenders — all land in "Average" or worse this gameweek, each on a team that conceded. Nothing in the available data suggests these three individually "defended badly"; it's the same mechanism at work.

**Conclusion: this is a systemic pattern affecting any defender whose team concedes, not a Lacroix-specific anomaly.** Roughly half the defenders in any given gameweek will have their Defence score capped by this same effect.

---

## 8. Missing Football Information

What a knowledgeable fan sees, cross-checked against what FPL's data (our only current source) can and cannot represent:

| Fan-visible defensive quality | Can our data detect it? |
|---|---|
| Tackles won | **Available, not currently ingested** (see §9) |
| Interceptions | Partially — bundled into `clearances_blocks_interceptions`, not broken out further; that field itself **available, not currently ingested** |
| Clearances | Same as above — bundled, available, not ingested |
| Blocks (shots/crosses) | Bundled into the same combined field; not separable even if ingested |
| Possession recoveries | **Available, not currently ingested** (`recoveries`) |
| Aerial duels (won/lost) | **Not available from FPL at all** |
| Ground/defensive duels (won/lost) | **Not available from FPL at all** |
| Dispossessions | **Not available from FPL at all** |
| Individual errors leading to a shot/goal | **Not available from FPL at all** |
| Fouls committed | **Not available from FPL at all** |
| Goals prevented (shot-stopping quality, outfield equivalent) | **Not available from FPL at all** |
| Defensive positioning / covering space | **Not available from any free source at this scope** — requires tracking/event data (Opta/StatsBomb-tier) |
| Progressive defensive actions (carrying out of press, etc.) | **Not available from FPL at all** |
| Clean sheet (team result) | Available — currently the *sole* team-level defensive signal used |

This confirms two distinct categories the brief asked us to separate:

- **A (data problem):** tackles, clearances_blocks_interceptions, and recoveries are genuinely available in a source we already use — this is fixable now, with no new integration.
- **D (fundamental data limitation):** aerial duels, defensive positioning, individual errors, and true event-level context (which pass, which run, which block actually prevented a goal) are not obtainable from FPL, and no free, legitimately-licensed source currently available to this project provides them at Premier League scope (this echoes the same conclusion already reached and documented for "Key Moments" — see the player page's existing `ComingSoonPanel` explanation).

**Honest assessment:** in Lacroix's specific case, the primary failure is **not** category D. His actual defensive activity (12 actions) was captured and would have ranked him near the top of the league that week on that metric alone — the system had good evidence and didn't use it well, rather than lacking evidence entirely. Category D is real and worth acknowledging, but it is not the main explanation here, and it would be a mistake to let it become the default answer.

---

## 9. Free Data Opportunities

**Immediately available, zero new integration, verified live during this investigation:**

FPL's per-gameweek live endpoint (`/api/event/{id}/live/` — the exact endpoint `fetchFplEventLive` already calls every day) returns, per player, in addition to the combined `defensive_contribution` we currently store:

```json
"clearances_blocks_interceptions": 7,
"recoveries": 2,
"tackles": 5,
```

Our own `FplEventLiveElementSchema` (Zod) currently only declares `defensive_contribution`, `expected_goals`, `expected_assists`, `expected_goals_conceded`, `ict_index`, `minutes`, `starts` — Zod silently strips any field not listed, so these three are fetched over the wire and then discarded on every ingestion run today. **This is the single most concrete, lowest-risk improvement identified in this audit.** No new API, no new terms of service to evaluate, no fabrication risk — just widening a schema we already control to keep three fields we already receive.

FPL's season-aggregate `bootstrap-static` endpoint (also already in use, via `fetchFplBootstrap`) exposes the *same three fields as season totals* per player, which could seed a season-level defensive baseline even before enough gameweeks exist for a proper aggregate.

**Considered and explicitly rejected sources** (documented for the record, not because they weren't investigated):
- **API-Football / API-Sports** — free tier does expose more granular stats, but their own terms of service explicitly disclaim providing any licence to *publish* the data and note that mass/product distribution "may require additional licensing from relevant rights holders." Too ambiguous to build product features on.
- **football-data.org** — clear non-commercial terms, but player-level detail (including any defensive breakdown) appears gated behind a paid tier; free tier is fixtures/results/tables only.
- **TheSportsDB** — usable terms for development, murkier for a live deployed product; also not confirmed to carry Opta/StatsBomb-depth defensive event data at this league's scope.
- **True event-level data (StatsBomb, Opta, Wyscout)** — the kind of data that would answer category D fully (duels, pressures, positioning) is not available for free at Premier League scope from any source with clear usage rights for this project. This matches the conclusion already on record for Key Moments.

**Not evaluated as a "data" question, but worth flagging for the eventual formula discussion:** once tackles/CBI/recoveries are ingested as separate fields, the Defence formula for outfield players could treat them as 2–3 independent percentile inputs (rather than one pre-summed number) alongside clean sheets, naturally diluting any single team-result binary's influence without removing it. That is a **scoring** change, not a data change, and is listed as a follow-on recommendation below rather than something to do now.

---

## 10. Root Cause

**A combination, not a single cause:**

| Category | Applies here? | Evidence |
|---|---|---|
| **A. Data problem** | **Yes, partially** | `tackles`, `clearances_blocks_interceptions`, `recoveries` exist in the exact FPL payload already fetched and are silently dropped by our Zod schema (§9). |
| **B. Scoring problem** | **Yes, primary driver** | Defence = unweighted 50/50 average of individual defensive-action percentile and team-level clean-sheet binary. Chelsea conceding twice caps a genuinely 88th-percentile individual showing at a blended 62nd percentile (§2–§4). |
| **C. Interpretation problem** | **Yes, compounding** | Match Centre's single-highest-category "match strength" mechanism hides Lacroix's qualifying Defence trait behind his higher Creation trait; no per-player match narrative exists below the single Match Standout slot (§6). |
| **D. Fundamental data limitation** | **Present, but secondary here** | Aerial duels, positioning, individual errors, and true event context aren't available from any legitimate free source — real, but not the main explanation for *this* case, since the actually-captured `defensiveActions=12` was already a strong, usable signal (§8). |

The Lacroix case is best explained as: **a real defensive signal (A, mostly fine, could be richer) → correctly percentile-ranked (§3, no bug) → blended with a team-result binary that happened to work against him (B, the primary issue) → and then never narratively rescued because the interpretation layer can only spotlight one trait per player per match (C, compounding).**

---

## 11. Recommended Next Steps

*(Not implemented — for prioritisation discussion.)*

1. **[Data, low effort, low risk] Ingest `tackles`, `clearances_blocks_interceptions`, `recoveries`.** Widen `FplEventLiveElementSchema`, add three nullable columns to `PlayerMatchPerformance` via an additive migration, populate them in `ingestGameweekStats.ts` alongside the existing `defensive_contribution`. Purely additive — no existing field, formula, or score changes. This is prerequisite groundwork for #2, and useful for future display (e.g. Match Centre defensive detail) even before any formula change.
2. **[Scoring, needs deliberate review with real data, not a snap fix] Revisit the Defence formula's 50/50 clean-sheet weighting for outfield players.** Once #1 lands, evaluate splitting `defensiveActions` into its components as separate percentile inputs, and/or reducing clean sheet's weight relative to individual activity. This should be validated against several gameweeks of real data, not decided from one match — the team should own this decision explicitly rather than have it default from an anecdote.
3. **[Interpretation, low effort] Let Match Centre's "match strength" surface more than one qualifying trait.** A player clearing the 5.5 bar in two categories (Lacroix: Creation *and* Defence) arguably deserves both mentioned, not just the higher one.
4. **[Interpretation, moderate effort] Consider a lightweight per-player match narrative for solid-but-not-standout performances**, so a 6–7/10 Match Rating isn't represented by a bare number alone in every case — currently only the single match-wide Standout gets generated prose.
5. **[Process] Re-validate all of the above once more gameweeks exist.** Section 3's cohort caveat (GW1 cohort = season cohort right now) means some of today's apparent patterns will naturally resolve as the season lengthens — don't over-correct based on gameweek 1 alone.
6. **Do not change the Defence formula based on this single case.** The evidence supports that a real formula effect exists and is systemic (§7), but the specific reweighting deserves its own historical-data-backed decision, not a reactive fix scoped to make one match's number look better.

---

## Final Answers

> **"If an avid football fan watches Lacroix play a genuinely excellent defensive game, can our current data and intelligence system recognise that performance accurately?"**

**Not reliably — specifically not when his team concedes.** The underlying individual signal (his defensive-action count) is captured correctly and was genuinely strong (88th percentile leaguewide). But it's blended 50/50 with a team-level clean-sheet binary that has nothing to do with his individual quality, and nothing downstream currently rescues that with narrative nuance. This is corroborated, not contradicted, by looking at other well-regarded defenders in the same gameweek (Van Dijk, Maguire, Shaw) who show the identical pattern.

> **"What is the smallest realistic change that would move us materially closer to that goal using legitimate, freely available data?"**

**Ingest `tackles`, `clearances_blocks_interceptions`, and `recoveries` from FPL's live-gameweek endpoint — data we already fetch and currently discard.** This requires no new data source, no licensing evaluation, and no fabrication — just widening one Zod schema and adding one additive migration. It is the necessary foundation for any responsible reweighting of the Defence formula (recommendation #2), which should follow as its own deliberate, data-backed decision rather than a reactive change made from a single match.

---

## Verification

Confirming this investigation changed nothing in production:

```
git status --short          → clean (no tracked files modified)
npx tsc --noEmit             → clean, no errors
npx vitest run                → 18 test files, 177 tests, all passing
npm run build                 → clean production build, unchanged route table
```

All throwaway investigation scripts used to query the database and call the real scoring functions were deleted after use; nothing from this investigation was committed except this document.
