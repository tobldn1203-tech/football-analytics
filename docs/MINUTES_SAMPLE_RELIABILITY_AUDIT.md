# Player Intelligence — Minutes & Sample Reliability Audit

**Status:** Investigation only. No production code, formulas, weights, thresholds, UI, or schema were changed. Every throwaway script used to query the database and call the real scoring functions was deleted after use — confirmed clean: `git status --short` shows nothing tracked modified, `tsc --noEmit` clean, `vitest run` 275/275 passing, both before and after this investigation.

**Data:** real, current-season production data, 5 gameweeks played (317 eligible/ranked players out of 659 total in the database). Every number below came from calling the app's real, unmodified functions (`getCurrentSeasonPerformanceInputs`, `computeProvisionalRankings`) against the live database, then cross-checked live in the browser against the actual rendered pages.

**Companion documents:** `docs/PERFORMANCE_INTELLIGENCE_AUDIT.md` (2026-08-25, 1 gameweek) already found and fixed a related but narrower problem — strength-detection language wasn't confidence-gated. That fix, and its own explicit "Data limitations" note, are the starting point for this audit, not something to re-litigate. `docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md` and `_2.md` cover a different question (the Defence formula's clean-sheet weighting) and are not directly relevant here except as house-style precedent.

---

## Executive summary

**The suspected problem is real, confirmed with real production data, and traced to an exact mechanism — but it is narrower and more specific than "minutes don't matter."** Minutes *do* enter the calculation, in exactly one place: as the denominator of a per-90 rate conversion. That is precisely the mechanism that causes the problem. A player with one real moment (a goal, an assist) inside a short substitute cameo gets that moment extrapolated to a per-90 rate as if it were sustained across 90 minutes, and nothing downstream ever re-applies the fact that it wasn't.

Real examples, live in the app today:
- **Isidor** (Sunderland, FWD): season Performance **8.6 "Excellent"** — 4th-highest in the entire league — built on **95 total minutes** across 4 substitute cameos (20-26 minutes each), containing exactly 1 goal and 1 assist. His own page currently states, unqualified: *"Elite threat in front of goal this season," "Elite overall influence on matches," "Elite performances in recent matches."* His team's own Team Intelligence page lists him first under "Players driving the team" as *"Standout performer this season · In red-hot form · Leading the attack"* — for a team sitting 14th with a negative goal difference.
- **Merino** (Arsenal, MID): **6.4 "Good"** built on **51 total minutes** across 4 cameos (5-19 minutes each) with **zero goals, zero assists, and near-zero contribution in every single one** (match BPS of 5, 7, 0, 3). His page nonetheless states *"Elite overall influence on matches"* and *"Excellent defensive contribution for the position."* This is the cleanest example in the dataset: there is no standout moment behind this score at all — a merely non-negative accumulation of minor activity, extrapolated over a tiny denominator, is enough on its own.
- **J.Ramsey** (Newcastle, MID): **8.4 "Very good"** on **69 minutes**, one goal, and — while also shown as currently injured and unavailable — still carries three unqualified "Elite" claims.

These aren't edge cases in an otherwise-clean distribution: **7 of the current top 20 Performance scores in the entire league belong to players with under 100 total minutes on the season**, ranking above established starters like Ødegaard (305 min, 7.6), Palmer (352 min, 7.9), Isak (333 min, 7.7), and Saka (336 min, 7.7).

**The existing confidence system does not catch this, and the reason is specific and previously undocumented:** `classifySampleConfidence` counts *matches*, not *minutes*. A player needs only 3 appearances — of any length — to leave the "low" confidence bucket that gates language softening. Isidor and Merino both have exactly 4 appearances, so both are "moderate" confidence, and at "moderate" confidence, `explainPlayer()` (the function that actually renders "Elite"/"Excellent" claims) applies **zero** softening — it is written to soften only below the "low" threshold, full-strength above it. The one part of the page that *does* still hedge — the archetype's "Emerging profile" qualifier — does so because it's tied to the same confidence bucket by a different rule (only clears at "established," 8+ matches), which is why Isidor's page currently shows one part of itself (the archetype tag) appropriately hedged and three other parts of itself (Season Story, What Stands Out, Team Intelligence) making unqualified superlative claims — about the same 95 minutes.

**This is not "more appearances should automatically mean a better score."** The data itself disproves that reading: several goalkeepers and defenders with full 4-match, 360-minute samples score at the very bottom of the entire ranking (Rushworth 0.9, Petrović 1.8, Smith 2.0) — the model does not inflate consistent players, and it does not suppress genuinely poor ones. The problem is specifically and only about **how much evidence backs a score**, not whether more games automatically means more quality.

---

## 1. The complete Performance pipeline, traced

### 1.1 Raw data → season input

`lib/analytics/scoring/seasonInputs.ts` — `getCurrentSeasonPerformanceInputs()` — the only place database rows become the scoring engine's input shape:

```ts
season: {
  minutes: sum(p => p.minutes),        // raw total across all finished matches
  matches: appearances.length,          // count of matches with minutes > 0
  goals: sum(p => p.goals),
  assists: sum(p => p.assists),
  // ...cleanSheets, saves, xg, xa, defensiveActions, bps — all raw totals
}
```

Both `minutes` (total) and `matches` (count) are captured faithfully here. Nothing is lost at this stage. **This is the last point in the pipeline where "how much football did this player actually play" exists as an unambiguous, human-readable number** — everything past this point converts it into a rate.

### 1.2 Season input → percentile scores (`lib/analytics/scoring/provisional.ts`, `computeProvisionalRankings`)

**Step A — the only hard minutes gate in the whole system:**
```ts
const MIN_MINUTES = 45;
const eligible = inputs.filter((p) => p.season.minutes >= MIN_MINUTES);
```
Below 45 total minutes, a player is excluded from ranking entirely (no score, doesn't appear anywhere as a ranked player). This is binary — 44 minutes gets nothing, 45 minutes gets the exact same treatment as 900 minutes from this point on.

**Step B — where minutes actually enter the calculation, and the only other place they do:**
```ts
function per90(total: number, minutes: number): number {
  return minutes > 0 ? (total / minutes) * 90 : 0;
}
```
Every metric (goals, assists, xG, xA, defensive actions, bps) is converted to a per-90 rate before anything else happens to it. **This is the direct answer to the task's central question: minutes enter the calculation exactly once, as the denominator of a rate, and never again.** A player with 45 minutes and 1 goal (per-90 = 2.0) and a player with 900 minutes and 20 goals (per-90 = 2.0) produce an *identical* per-90 goals rate — the engine cannot tell them apart from this point forward. There is no additional weighting, shrinkage, or discount applied for the size of the denominator that produced the rate.

**Step C — percentile ranking on the rate, not the raw total:**
```ts
percentileRank(eligible.map((p) => per90ByPlayer.get(p.id)!.goals))
```
Attack/Creation/Impact/Form are ranked league-wide on these per-90 rates; Defence is ranked position-relative on the same principle. **Percentile ranking is itself a second amplifier of the same problem**: a rate built from a tiny sample has much higher variance than one built from a large sample (basic statistics — the variance of a per-90 extrapolation shrinks as minutes grow), so small-sample players are *structurally* more likely to land at the extremes of any percentile distribution, in both directions, independent of true skill. Nothing in `percentileRank` (`lib/analytics/scoring/percentile.ts`) or `computeProvisionalRankings` corrects for this — there is no empirical-Bayes shrinkage toward a league-average prior, no minimum-sample discount beyond the flat 45-minute gate, no confidence interval.

**Step D — blend into Overall:**
```ts
overall = attackScores[i] * weights.attack + creationScores[i] * weights.creation
        + defence * weights.defence + impactScores[i] * weights.impact;
```
Position-specific weights (verified in `OVERALL_WEIGHTS`) blend the four category scores. This blending step is the *only* thing in the formula that dilutes a single extreme category — and it dilutes across *categories*, not across *time/sample size*. It's why Isidor's Attack (9.8) and Impact (9.8) don't simply average to a 9.8 Overall — but it does nothing to discount the fact that both of those category scores individually come from 95 minutes.

**Step E — sample metadata attached, but not fed back into the score:**
```ts
sample: {
  matches: p.season.matches,
  minutes: p.season.minutes,
  confidence: classifySampleConfidence(p.season.matches),   // matches-based, not minutes
},
scores,
qualityLabel: qualityLabelFor(scores.overall ?? 0),          // reads ONLY the score
```
`qualityLabelFor` — the function that produces "Excellent"/"Very good"/"Good" — takes only `scores.overall` as its argument. It has no access to `sample.matches` or `sample.minutes` at all. **A player can have Excellent quality label and low/moderate confidence simultaneously — confirmed structurally in the type signature, not just inferred, and confirmed with real data (Isidor: Excellent + moderate; Flemming: Very good + low).**

### 1.3 Confidence classification (`lib/analytics/scoring/types.ts`)

```ts
export function classifySampleConfidence(matches: number): SampleConfidence {
  if (matches < 3) return "low";
  if (matches < 8) return "moderate";
  return "established";
}
```

The function's own comment: *"Sensible, un-fancy thresholds — no statistical shrinkage yet, just an honest label so small samples aren't presented with false confidence."* This is an explicit, documented acknowledgment that confidence is a **label only**, never a score adjustment — confirmed by the fact that `classifySampleConfidence` is called nowhere inside `computeProvisionalRankings`'s score-building logic, only when constructing the `sample` field attached alongside the finished scores.

**Critical, previously undocumented gap: this function takes `matches`, never `minutes`.** A player with 4 appearances of 90 minutes each (360 minutes, four full matches of real evidence) and a player with 4 appearances of 13-26 minutes each (51-95 minutes, barely one full match's worth) both classify identically as "moderate." The function cannot distinguish them, by construction — it never sees minutes at all.

### 1.4 How confidence is actually used downstream — every consumer traced

| Consumer | File | What it does with confidence | Softens the score itself? |
|---|---|---|---|
| `detectStrengths` | `lib/analytics/intelligence/strengths.ts` | Returns `primaryStrengths: []` at "low" confidence only; unchanged at "moderate"/"established" | No — never touches `scores` |
| `explainPlayer` | `lib/analytics/scoring/explain.ts` | `isLimited = confidence === "low"`; softens prose to "early signal" phrasing **only** at "low" | No — `explainPlayer`'s own comment states explicitly: *"the number itself is never softened"* |
| Archetype qualifier | `lib/analytics/archetypes/archetypes.ts` | `qualifierFor`: "Early profile" at low, **"Emerging profile" at moderate**, no qualifier at established | No — the archetype *shape* (which category combination) is unaffected; only the text tag changes |
| Season Story | `lib/analytics/story/seasonStory.ts` | Deterministic sentence softens at low confidence (per the Aug 25 audit's own verified finding) | No |
| `pickMatchStrength` / Match Centre tags | `lib/analytics/scoring/matchRepository.ts` | Not confidence-gated at all — a single qualifying category (≥5.5) is surfaced regardless of sample | No |
| Top Performers table | `components/home/top-performers.tsx` | A small "●" marker shown when `confidence !== "established"`, tooltip only | No — purely a UI marker, doesn't affect rank position or the number shown |
| `qualityLabelFor` | `lib/analytics/scoring/types.ts` | Doesn't accept confidence as an input at all | N/A — structurally cannot |

**Direct answer to the task's Section 4 question:** the confidence mechanism exists, is real, and is used in multiple places — but **every single one of its effects is on downstream language or UI markers, never on `scores.overall`, `scores[category]`, or `qualityLabel`.** A player can and currently does have high Performance and low/moderate confidence simultaneously, with nothing in the numeric pipeline reflecting that gap. The one exception worth naming precisely: the archetype qualifier is the *only* place where "moderate" confidence produces any visible difference at all (an "Emerging profile" tag) — every other consumer treats "moderate" identically to "established," which is the specific, previously-undocumented gap this audit adds to the Aug 25 audit's finding (that one was about the "low" bucket only).

### 1.5 Downstream feature map (as requested)

- **Player Intelligence** (`lib/analytics/intelligence/summary.ts` and friends) — reads `RankedPlayer.scores`/`sample` directly; inherits the gap unchanged.
- **Archetypes** — reads `scores` for shape classification, `sample.confidence` only for the qualifier text (see above). The archetype *label itself* (e.g. "Complete Forward") is unaffected by sample size — Isidor's shape genuinely matches "Complete Forward" given his per-90 rates, however thin the sample behind them.
- **Team Intelligence** (`lib/analytics/scoring/teamRepository.ts`, `components/teams/team-players-driving.tsx`) — "Players driving the team" ranks by the same `scores.overall`/category scores, with the same "why" slots (standout/inForm/attackingThreat/creativeLeader/defensiveStandout) computed by simple top-of-team comparison. **Confirmed live**: Isidor tops Sunderland's list, described as "Standout performer this season · In red-hot form · Leading the attack" — three slots, all won on the strength of 95 minutes.
- **Worth Knowing** (`lib/analytics/availability/worthKnowing.ts`) — cross-references availability against the same `scores.overall`/`qualityLabel`; would treat a thin-sample high scorer exactly like a genuinely established one if that player's availability changed (not directly observed with a live example this pass, but confirmed by reading the function's inputs — it takes the same `RankedPlayer` objects, no separate sample check).
- **Player rankings / Top Performers table** — sorts by `scores[activeCategory]` directly; Isidor's rank (top ~4 of 317 by Overall) is a direct, unmediated consequence of everything above.

---

## 2. Does the suspected problem actually exist? (real data)

**Yes — confirmed directly, not inferred.** Ran the real production ranking function against the live database (317 eligible players, 5 gameweeks).

### Distribution of appearance counts among ranked players
```
1 match:  19 players
2 matches: 32 players
3 matches: 58 players
4 matches: 207 players
6 matches: 1 player   (a fixture-rescheduling artifact, not relevant to this audit)
```

### Top 20 Performance scores in the entire league, with minutes shown
Of the current top 20, **7 have under 100 total minutes on the season**: Isidor (95), J.Ramsey (69), Flemming (51), Šeško (76), Nmecha (50), Akpom (69), Bruno G. (64) — interleaved with, and in several cases ranked above, players with 300-360 minutes (Mendy 249, Saka 336, Isak 333, Ødegaard 305, Palmer 352).

### Per-position breakdown: thin-sample (<100 total minutes) vs. consistent (≥4 matches, ≥300 minutes)

| Position | Best thin-sample score | Worst consistent score | Best *consistent* score (for comparison) |
|---|---|---|---|
| FWD | Isidor 8.6 (95 min) | Brobbey 3.6 (309 min) | Isak 7.7 (333 min) — **outranked by 5 different thin-sample players** |
| MID | J.Ramsey 8.4 (69 min) | Rayan 3.1 (347 min) | Palmer 7.9 (352 min) — **outranked by Bruno G. (7.8, 64 min) and J.Ramsey** |
| DEF | Costinha 6.9 (54 min) | Smith 2.0 (360 min) | (52 consistent defenders total; Costinha's 6.9 sits well above the median) |
| GKP | Sánchez 4.5 (90 min, 1 full match) | Rushworth 0.9 (360 min) | Raya 5.4 (360 min) — no thin-sample GKP outranks the top consistent goalkeepers; see §2.1 below |

### 2.1 An important nuance the data itself revealed: the effect is about *minutes*, not *appearance count*, and specifically about *short, partial* appearances

Goalkeepers with exactly 1 appearance but a **full 90 minutes** (Sánchez, Benitez, M.Bizot — each one complete match) scored 4.5, 2.8, 2.7 — unremarkable, spread across the normal range, **not** pushed to an extreme. Compare to midfielders/forwards with 1-2 appearances of **partial** minutes (Jensen: 1 match, 66 min, 7.4; Osula: 1 match, 55 min, 7.3) or several tiny cameos (Merino: 4 matches, 51 min total, 6.4). The pattern is not "1 appearance = inflated" — it's specifically **"low total minutes, usually from short substitute cameos" = inflated when a positive event (a goal, an assist) lands inside that short window.** A full single match, even though it's still officially "1 match" of season evidence, tends to land in a believable range, because 90 minutes is enough for the per-90 rate to reflect something closer to a real workload rather than being dominated by one moment.

This directly answers the task's Section 5 framework: **raw appearance count (5A) is the least reliable signal — Merino has 4 "appearances" (the same count as most of the league) built from 51 real minutes.** Total minutes (5B) is a better, more honest signal, but still incomplete on its own, since it doesn't distinguish "51 minutes of doing nothing" (Merino) from "51 minutes with one clinically-taken chance" (Flemming) — both would be flagged as thin by a minutes threshold, appropriately, but for different underlying reasons. A concept closer to **effective/weighted minutes** (5C) — one that also looks at how concentrated a player's output is within their total minutes — would be the more complete signal, but this audit did not attempt to design or validate one; that's a decision for the fix phase, not this one.

### 2.2 The reverse cases, as requested

**Players with multiple full-length appearances whose underlying performance is genuinely worse, correctly scored low — confirming the model isn't simply "generous to everyone":** Rushworth (GKP, 4 matches, 360 min, 0.9 "Below average"), Petrović (4 matches, 360 min, 1.8), Kamara (MID, 4 matches, 360 min, 3.8), Brobbey (FWD, 4 matches, 309 min, 3.6), Smith (DEF, 4 matches, 360 min, 2.0). All of these have a completely legitimate, meaningful sample and score at the bottom of the entire league — the formula does not inflate poor performances just because they're backed by lots of minutes, and it does not need a "sample size fix" to get these right; it already does.

**A single full match that legitimately deserved an unremarkable rating, not an inflated one:** Senesi (1 match, 90 min, 4.9 "Average") — a real, full appearance, correctly landing in the middle of the distribution rather than at an extreme. This is direct evidence that the extrapolation mechanism isn't inherently broken for every small sample — it specifically misbehaves when a short, partial cameo happens to contain a disproportionately good moment.

**A short cameo whose underlying moment plausibly deserved a high individual match rating, distinct from whether the season number should inherit it:** Isidor's Fulham cameo — 26 minutes, 1 goal, xG 1.39 (he converted a high-probability chance he was brought on for). Taken as a single Match Rating, an 8-9/10 for that specific 26 minutes is a defensible football judgement — this is exactly the "a substitute who scores 9.0 in 20 minutes may genuinely have had an exceptional impact" case the brief itself named as legitimate. The problem, confirmed precisely in §3 below, is that this one moment's rate is what the *season* Performance score is built from too, with nothing marking the difference.

---

## 3. Match Rating vs. season Performance — does the product currently distinguish them?

**No — not numerically, and this is worth stating precisely rather than assumed.**

Both use the *exact same engine* (`computeMatchRatings` in `lib/analytics/scoring/matchRating.ts` calls `computeProvisionalRankings` directly, feeding it one gameweek's stats "as if they were the season" — confirmed by reading the function, which literally sets `season: { minutes: r.minutes, matches: 1, ... }` for each player for that one gameweek). The code's own doc comment for this file states the intended distinction explicitly:

> *"The `overall` score from this pool is 'Match Performance' — visually and semantically distinct from season 'Performance' wherever it's shown... Same 0–10 scale, same category weights, same position-aware Defence split; different (much smaller, single-gameweek) comparison pool, which is why it is far more volatile week to week than a season score and **must never be presented as interchangeable with one**."**

This confirms the product's own stated intent: Match Rating being volatile and occasionally extreme (an 8.8 for a 20-minute cameo) is *by design and correct* — `matches: 1` guarantees every Match Rating is always "low" confidence, which the code calls "exactly correct" since a match rating genuinely is always a one-match sample.

**The gap is specifically that season Performance does not currently behave any differently from a Match Rating once a player has accumulated a handful of matches, if those matches are short.** The distinction the code draws is real and correctly implemented for *labeling* ("Match Performance" vs. "Performance," different wording used consistently) — but there is no corresponding numeric distinction for a season score that happens to be built from a similarly small amount of real evidence. Isidor's season Performance (8.6, 95 minutes) is exactly as volatile, mechanically, as any single Match Rating — it just isn't *labeled* or *treated* that way once he's played more than 2 matches, because nothing currently asks "how much of a season is this, really" beyond the flat 45-minute floor and the matches-based confidence bucket.

**Where the distinction should conceptually live**, based on this trace (recommendation only, not attempted here): the natural seam is inside `computeProvisionalRankings` itself, or in a wrapper around it — something that knows the difference between "a rate that's been observed for 51 minutes" and "a rate that's been observed for 350 minutes" and treats the confidence of the *rate itself* (not just a match-count label) as a first-class part of what gets computed, not just what gets reported afterward.

---

## 4. Summary answer to "is this a genuine methodological problem?"

Yes, with three distinct, precisely-located components:

1. **A structural fact, not a bug**: per-90 extrapolation is, by definition, most volatile exactly when minutes are fewest. This is documented already (§4 of the Aug 25 audit flagged it explicitly) and isn't something "more code" accidentally missed — it's an inherent property of any rate-based metric that nothing in the current formula compensates for.
2. **A genuine gap, newly confirmed with real data this pass**: nothing downstream — not the score, not the quality label, not most of the generated language — currently treats a thin-minutes, moderate-confidence player any differently from an established one. The sole partial exception (the archetype qualifier) only proves the rest of the system *could* differentiate and mostly doesn't.
3. **A specific, previously undocumented mechanism**: `classifySampleConfidence` counts matches, not minutes, so a player can clear the "low confidence" gate — and thereby lose every softening safeguard that gate provides — by accumulating enough short cameos, without ever accumulating a meaningful amount of actual playing time.

None of this required or assumed hypothetical players — every figure above is a real player, in the live database, verified in the actual running application today.

---

## 5. What this audit deliberately does not conclude

- **Not** that more appearances should automatically produce a better score — directly contradicted by the reverse-case evidence in §2.2.
- **Not** that Match Rating's volatility is a problem — it's explicitly, correctly designed to be volatile, and this audit found no reason to disturb that.
- **Not** a specific formula, weight, or threshold to change — that's a deliberate decision for a follow-up, informed by this trace, not a byproduct of it. In particular:
  - Whether the fix belongs in the score itself (e.g., a minutes-aware shrinkage/regularization term inside `computeProvisionalRankings`), in the confidence classifier (making it minutes-aware, not just matches-aware), or purely in presentation (extending the existing "low"-confidence softening to also catch high-matches/low-minutes players) are three different, non-exclusive directions, each with different amounts of risk to the rest of the (currently working, per §2.2) system.
  - Any fix should be validated the same way the Defence-formula audits validated theirs (`docs/PLAYER_INTELLIGENCE_ACCURACY_2.md` §8-9): test candidate changes against the *whole* current dataset, not just the motivating examples, and check they don't damage the cases that are already correct (the Rushworth/Petrović/Senesi cases in §2.2 above are the natural regression set for that check).

---

## Verification

```
git status --short   → clean (no tracked files modified)
npx tsc --noEmit      → clean, no errors
npx vitest run        → 26 test files, 275 tests, all passing
```

All throwaway scripts used to query the database and call the real scoring/ranking functions for this investigation were deleted after use; nothing from this investigation was committed except this document.
