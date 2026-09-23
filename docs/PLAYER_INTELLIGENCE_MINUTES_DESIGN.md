# Player Intelligence 2.1 — Minutes-Aware Reliability Design

**Status:** Design and experimentation only. No production code, formula, confidence logic, UI, ranking, ingestion, schema, archetype, voice, Team Intelligence, Worth Knowing, Best XI, or Match Rating was changed. All candidate models below were tested as local, throwaway functions against real production data pulled via the app's own unmodified functions (`getCurrentSeasonPerformanceInputs`, `computeProvisionalRankings`); every script used to run these experiments was deleted after use. Verified clean before and after: `git status --short` shows nothing tracked modified, `tsc --noEmit` clean, `vitest run` 275/275 passing.

**Builds on:** `docs/MINUTES_SAMPLE_RELIABILITY_AUDIT.md` (this task's own prerequisite reading) — its findings are treated as established fact here, not re-litigated: minutes enter the current formula only via a flat 45-minute floor and a per-90 rate conversion; `classifySampleConfidence` counts matches, not minutes; no consumer of confidence touches the score itself.

---

## 1. Executive recommendation

**Adopt Model D: a minutes-aware reliability adjustment applied once, inside the scoring engine, to every category score and Overall — combined with a minutes-based (not matches-based) confidence classifier.** Neither alone is sufficient; together they fix the two genuinely distinct problems this audit found (the *number* being unwarrantedly extreme, and the *language* built on top of it not knowing that):

- **The score fix** (shrinkage toward a position-and-category-specific baseline, weighted by total minutes) corrects the number itself — the thing that determines league-wide ranking, Top Performers position, and Team Intelligence's "who's driving this team" selection, none of which currently consult confidence at all.
- **The confidence fix** (classify by minutes, not matches, using thresholds *derived from* the existing 3-match/8-match boundaries rather than invented fresh) corrects language — and because `explainPlayer`, `detectStrengths`, and the archetype qualifier **already branch on `sample.confidence`**, this fix requires touching only the classifier function itself. Every consumer that already does the right thing at "low" confidence starts doing the right thing for Isidor and Merino too, automatically, with no changes to those files.

Real-data validation (§6-8): applying both, K = 90 (one full match's worth of minutes as the shrinkage constant) — Isidor's Overall drops from 8.6 "Excellent" to 7.4 "Very good" (now statistically indistinguishable from Isak's 7.7, appropriately, given the evidence gap); Merino's Overall barely moves (6.4 → 5.9, both "Good") because his *number* was never the problem — his Impact (8.7 → 7.0) and Defence (7.8 → 6.0) category scores were, and those are exactly what feeds the "Elite overall influence"/"Excellent defensive contribution" claims his page currently makes. Haaland (360 minutes, the most anyone currently has) moves from 8.8 to 8.3 — noticeably but not punitively. Only 12 of 317 ranked players move by more than 50 league-wide rank places. Established poor performers (Rushworth, 360 minutes, 0.9) are essentially untouched (0.9 → 1.7, still firmly "Below average") because they already have the minutes to back their score, good or bad.

**Full mathematical detail, exact thresholds, and every experiment's numbers are in §6-14 below.** This section states the conclusion; the rest of the document is the evidence for it.

---

## 2. Confirmed problem (restated briefly — full detail in the prerequisite audit)

Minutes currently enter the Performance calculation in exactly two places: a flat 45-minute eligibility floor, and as the denominator of a per-90 rate. Past that floor, a 45-minute sample and a 900-minute sample producing the same rate are indistinguishable to the engine. `classifySampleConfidence(matches)` counts appearances, not minutes, so four 15-minute cameos clear the same "moderate confidence" bar as four full 90-minute matches — and every downstream consumer of confidence affects only generated language, never the score, the quality label, or ranking position.

---

## 3. Design principles (the standard this design is held to)

1. **Performance quality and evidence reliability are two different questions and must stay two different concepts internally, even where they combine into one displayed number.** "How good was the observed level" and "how much do we trust that this observed level is sustained" are computed from different inputs and must remain traceable separately.
2. **A short appearance is not weak evidence because it is short — it is weak evidence because it is small.** The fix must not encode "substitutes are worth less"; it must encode "less football has been observed, so we should be more cautious about generalizing from it," and it must relax that caution symmetrically as more football accumulates, regardless of whether that football came from starts or cameos.
3. **Nothing here changes what actually happened in a match.** Match Rating, by design, is a single-match judgement and stays exactly as volatile as it already correctly is (§13).
4. **Prefer continuous, asymptotic adjustment over a cliff.** A player crossing from 44 to 45 minutes already gets a step-change (ranking eligibility) — that one is deliberate and pre-existing (a reasonable "is there even a match's worth of evidence" floor) and this design does not touch it. Anything new added on top of it should not introduce a second cliff.
5. **One shared primitive, not several independent reliability concepts.** Confidence, ranking, and any future Best XI/Player Comparison eligibility logic should all read from the same underlying "how much evidence exists" function, tuned differently for different displays, rather than each re-deriving its own answer to the same question (§15).

---

## 4. Current architecture (as verified — see the prerequisite audit for the full trace)

```
PlayerMatchPerformance (raw, per match)
   → getCurrentSeasonPerformanceInputs()          [sums minutes, matches, goals, etc.]
   → computeProvisionalRankings()
        eligible = filter(minutes >= 45)            ← ONLY minutes gate
        per90(total, minutes)                       ← ONLY other place minutes are read
        percentileRank(per-90 rates)                 ← no sample-size awareness
        overall = Σ (categoryScore × positionWeight) ← blends categories, not time
        sample.confidence = classifySampleConfidence(matches)  ← matches, not minutes; never fed back into scores
   → RankedPlayer { scores, qualityLabel, sample }
        ↓ read directly, unchanged, by:
        explainPlayer (softens language only at confidence === "low")
        detectStrengths (suppresses primaryStrengths only at "low")
        archetypes.ts (qualifier text: "Early profile" at low, "Emerging profile" at moderate)
        teamRepository.ts "Players driving the team" slots (top-of-team by raw score, no confidence check at all)
        Top Performers table, Worth Knowing (read scores/qualityLabel directly, no confidence check)
```

---

## 5. Candidate models

Every model below was run against real production data (§6-8). Descriptions here are the conceptual comparison the task asked for; results follow.

### Model A — Performance unchanged; minutes affect confidence and language only
**Logic:** Replace `classifySampleConfidence(matches)` with a minutes-based version. Leave every score untouched.
**Football interpretation:** "We won't claim certainty we don't have, but the number itself still says what it says."
**Strength:** Zero risk to the score/ranking machinery; trivially reversible; the smallest possible change.
**Weakness:** Does not touch ranking, Top Performers position, or "Players driving the team" selection — none of which consult confidence. Isidor would still rank #4 in the league and still top Sunderland's driving-players list; only his page's prose would soften. **Confirmed insufficient on its own** — this is the central limitation this design must not settle for.

### Model B — Continuous reliability adjustment on Performance; confidence unchanged
**Logic:** Shrink `scores.overall` (and, as tested in §8, each category score) toward a neutral baseline by a continuous, minutes-based weight. Leave `classifySampleConfidence` exactly as it is today.
**Strength:** Fixes ranking and Team Intelligence selection, the two places Model A cannot reach.
**Weakness:** The confidence bucket still says "moderate" for a 51-minute player, so `explainPlayer`/`detectStrengths` still generate full-strength language on top of a now-tempered (but still real) number — a smaller version of the original problem, one layer up.

### Model C — Performance unchanged; minutes-aware confidence gates ranking eligibility and language, but the number is never altered
**Logic:** Introduce a minutes-based reliability tier that controls *inclusion* (e.g., in league-wide leaderboards) or a visual "provisional" marker, without changing `scores.overall` itself.
**Strength:** Avoids the philosophical question of "what should the number even mean" — the number stays a pure quality read, gating happens entirely at presentation.
**Weakness:** Doesn't answer the task's own framing. The brief explicitly wants the *score* to communicate evidence honestly where appropriate, not just to be hidden or flagged when weak. Excluding Isidor from a leaderboard rather than showing an honestly-tempered number for him is a strictly worse experience — it looks like the product doesn't know what to do with him, rather than that it has an honest, considered opinion. **Rejected** for this reason, not tested numerically beyond confirming this framing gap.

### Model D — Both: score-level reliability adjustment AND minutes-aware confidence — **recommended**
**Logic:** Model B's shrinkage on every category score and Overall, plus Model A's confidence-classifier fix. Because `explainPlayer`/`detectStrengths`/the archetype qualifier already branch on confidence, fixing the classifier alone (no changes to those three files) makes their existing "low confidence" behaviour correctly apply to Isidor and Merino. The score-level shrinkage separately fixes what confidence structurally cannot reach: ranking, Top Performers ordering, and "Players driving the team" selection.
**Strength:** Closes every gap Models A-C individually leave open; confirmed with real data in §6-8 below.
**Weakness:** The most surface area of any model tested — touches the core scoring function, not just a label. Mitigated by keeping the change additive and narrowly scoped (§18) and by validating against the full population, not just the motivating cases (§6-8).

### Model E — Richer "effective evidence" combining minutes, appearances, starts, and distribution
**Tested specifically to answer the task's own instruction not to assume one variable is sufficient (§6.4).** Real data (five named thin-sample players, each cross-referenced against their actual start/substitute history) showed **every one of them had zero starts** — this season's flagged cases are a homogeneous "substitute only" population, so appearance count and start count could not be shown to add independent signal beyond total minutes in the data available. Average-minutes-per-appearance (checked as a proxy for "how fragmented is this player's time") also didn't reveal a case where two players with equal *total* minutes needed different treatment because one was more fragmented than the other. **Not adopted** — not because the idea is wrong in principle, but because this dataset does not yet contain evidence that it adds anything Model D's minutes-only approach misses, and adding unvalidated complexity would violate this design's own principle (§3.4, §16) against unnecessary machinery. Revisit once more gameweeks exist and a genuine "many starts, few total minutes due to repeated early substitutions" profile appears, if one does.

---

## 6. Real-data experiments — the shrinkage formula and constant

**Formula (Model D's score-level component), tested and adopted:**

```
reliability(minutes) = minutes / (minutes + K)
adjustedScore(category) = rawScore(category) × reliability + prior(position, category) × (1 − reliability)
```

This is a standard empirical-Bayes / "stabilized rate" shrinkage — the same family of technique used for exactly this problem in sports analytics generally (a batting average from 10 at-bats is less trustworthy than one from 500, and the standard fix is to blend the observed rate with a league-average prior, weighted by sample size). It is:
- **Continuous** — no cliff; every additional minute nudges reliability up smoothly.
- **Nonlinear** — the curve is steep at low minutes and flattens as minutes grow (§14).
- **Asymptotic** — `reliability → 1` as minutes grow without bound, but never reaches it; the raw score is never fully "trusted" to the total exclusion of the prior, appropriately, since even a good sample is still a sample.
- **Not** the rejected `minutes / 900` linear penalty — that would be *linear*, not asymptotic, would still be climbing at 900 minutes (a fixed, arbitrary endpoint chosen for no defensible reason), and would treat 45 minutes and 90 minutes as barely different (linear near zero) when they are actually very different in evidence terms (barely-eligible vs. one full match) — exactly backwards from what a reliability curve should do near the origin.

**Prior:** position-and-category average across all currently-ranked players (e.g., FWD/attack averages 7.2; MID/impact averages 6.0 — computed fresh from the live dataset, not assumed), not a single league-wide constant and not zero. Shrinking toward zero would be indefensible (it would imply "no evidence = assume the player is bad," which is not what "insufficient evidence" means — see §10); shrinking toward the position-and-category mean is the standard, defensible choice: with zero evidence, the best estimate of an unknown player's category score is "about what a typical player at that position scores in that category," not "the worst possible score."

### 6.1 Choosing K

Tested K ∈ {90, 180, 270, 360, 450} minutes against the full real dataset (317 ranked players, minutes ranging 45-491 at the current 5-gameweek mark — max minutes is well below what a mature season would show, since this is still early in the season, confirmed by directly querying the distribution).

**K = 90 (one full match) is the best-supported choice**, for a specific, statable reason rather than a round-number guess: it is the only tested value that keeps a player who has played *every single available minute so far* (Haaland, 360/360 possible) close to fully trusted (reliability 0.80) while still meaningfully tempering a 51-95 minute sample (reliability 0.36-0.51). The larger K candidates (270-450) were tested and rejected: at K = 360, even Haaland — who has literally never missed a minute — sits at only 0.50 reliability, which would flatten the entire current leaderboard toward the mean and defeat the purpose of having live scores at all this early in a season that is, by the product's own "Preview build" framing, expected to show real signal as soon as real matches exist. K = 90 avoids this by anchoring the constant to a *single football-meaningful unit* (one completed match) rather than to a number chosen to make one player's score look right.

### 6.2 Full-population ranking effect (not just the motivating cases)

Comparing the real top-20 by raw Overall against the top-20 by K=90-shrunk Overall:

- **Thin-sample (<100 total minutes) players in the top 20: 7 → 1.** Isidor is the one that remains — now at rank 12, not rank 4, and at 7.4 "Very good," not 8.6 "Excellent."
- **João Pedro (360 minutes, previously rank 5) rises to rank 2** — a legitimately consistent player correctly benefiting from thin-sample noise clearing out ahead of him.
- **Only 12 of 317 ranked players move by more than 50 league-wide rank places.** The adjustment is targeted at the specific population it needs to reach, not a blanket reshuffle — confirmed by directly computing rank deltas across the entire dataset, not asserted.

### 6.3 Reverse cases — confirming the model doesn't over-correct

- **Rushworth** (GKP, 360 minutes, raw 0.9 "Below average") → 1.7, still firmly "Below average." He has real, substantial evidence of a poor season so far; shrinkage barely moves him (reliability 0.80) because he has the minutes to back the number, whichever direction it points.
- **Brobbey** (FWD, 309 minutes, raw 3.6 "Below average") → 4.2, crossing into "Average." A modest, defensible correction — his sample is large but not maximal (reliability 0.77), so a small pull toward the mean is appropriate, not a distortion.
- **Chavarria and Herrington** — the two players with the *most* total substitute-only minutes in the current dataset (118 and 107) — score 2.3 and 2.8 respectively, both **already correctly low without any adjustment**, because they have produced nothing (zero goals, zero assists, minimal BPS) in that time. This is important, direct evidence that shrinkage is not "punishing substitutes": these two are real substitutes with more total bench minutes than Isidor, and the *raw, unshrunk* formula already scores them appropriately low. The problem this design fixes is specifically the opposite case — a short sample containing a genuine positive event, extrapolated too far — not "substitutes in general."

### 6.4 Does anything beyond total minutes add signal? (Model E's test, real data)

Cross-referenced five flagged thin-sample players (Isidor, Merino, J.Ramsey, Costinha, Bruno G.) against their actual match-by-match start/substitute history in the database: **all five have zero starts this season** — every one of their appearances was as a substitute. Average minutes per appearance varied (12.8 for Merino, 32.0 for Bruno G.) without any corresponding pattern that total minutes alone failed to capture. **Conclusion: total minutes is the dominant, sufficient signal for this dataset; starts/appearance-count did not demonstrate independent value and are not recommended as a separate weighted factor** — see Model E.

---

## 7. Isidor — full before/after

| | Raw | Shrunk (K=90, reliability 0.51) |
|---|---|---|
| Overall | 8.6 "Excellent" | **7.4 "Very good"** |
| Attack | 9.8 "Excellent" | 8.5 "Excellent" *(stays — he genuinely converted a high-probability chance; this claim is earned, not overclaimed)* |
| Creation | 5.7 "Good" | 5.4 "Average" |
| Defence | 2.3 "Below average" | 3.6 "Below average" |
| Impact | 9.8 "Excellent" | **7.7 "Very good"** *(this is the category feeding "Elite overall influence" — now tempered)* |
| Confidence (minutes-based, §9) | — | **"low"** (95 min < 270) vs. today's matches-based "moderate" |
| Consequence for language | "Elite threat in front of goal," "Elite overall influence," "Elite performances in recent matches" (unqualified) | With confidence correctly reclassified to "low," `explainPlayer`'s **existing, unmodified** low-confidence branch applies: softened to early-signal phrasing, exactly as it already does for any other "low" confidence player today. |
| Consequence for ranking | 4th in the league | ~12th, tied closely with Isak (333 min, 7.4 shrunk) — the evidence genuinely does not support calling Isidor clearly better than Isak right now, and the model now says so. |
| Consequence for Team Intelligence | Tops Sunderland's "Players driving the team," described "Standout performer... in red-hot form... leading the attack" | Selection logic (top-of-team by score) automatically reflects the tempered score — still likely to feature Isidor (he probably still leads a struggling Sunderland squad), but at a number that no longer overstates certainty. |

**Football read:** Isidor's goal and assist were real and good. The shrunk score still says so (7.4 "Very good" is a genuinely positive rating) — it just stops claiming, from 95 minutes, the same thing it would claim from 360.

## 8. Merino — full before/after

| | Raw | Shrunk (K=90, reliability 0.36) |
|---|---|---|
| Overall | 6.4 "Good" | 5.9 "Good" *(barely moves — his number was never the actual problem)* |
| Attack | 6.0 "Good" | 5.7 "Good" |
| Creation | 4.1 "Average" | 5.2 "Average" |
| Defence | 7.8 "Very good" | **6.0 "Good"** *(feeds "Excellent defensive contribution" — now tempered out of that band)* |
| Impact | 8.7 "Excellent" | **7.0 "Good"** *(feeds "Elite overall influence" — now tempered out of that band)* |
| Confidence | — | **"low"** (51 min) vs. today's "moderate" |
| Consequence | "Elite overall influence," "Excellent defensive contribution" from zero goals, zero assists, and near-zero match-level contribution in every appearance | Both claims' source categories drop a full quality band; the corrected confidence bucket additionally suppresses `detectStrengths`' primary-strength listing entirely via its existing "low confidence → []" rule. |

**Football read (important, and different from Isidor's):** Merino's *Overall number was already reasonable* — "Good," not an outlier. **The injustice in his case was almost entirely in the generated language overselling a middling score**, not in the score itself. This is direct, real evidence that the score-level and language-level fixes are solving two different problems that happen to co-occur in Isidor's case and appear almost independently in Merino's — confirming Model D (both) is not redundant with itself; each half is doing real, distinct work.

---

## 9. Confidence redesign — minutes, not matches

**Recommended replacement for `classifySampleConfidence`:**

```ts
function classifySampleConfidence(minutes: number): SampleConfidence {
  if (minutes < 270) return "low";        // < 3 full matches' worth
  if (minutes < 720) return "moderate";   // 3–8 full matches' worth
  return "established";                    // 8+ full matches' worth
}
```

**Why these exact numbers, not new arbitrary ones:** 270 and 720 are 3×90 and 8×90 — the *existing* match-count boundaries (3 matches, 8 matches), expressed in their natural unit. **A player who starts and plays full matches crosses these boundaries at exactly the same point as under today's system** — this change is deliberately non-disruptive for the majority of players who play normally, and only changes classification for the specific population the audit flagged: players who accumulate matches without accumulating minutes. Verified directly: Haaland (360 min ≈ 4 full matches) still lands "moderate" under both the old and new rule. Isidor (95 min, 4 matches) moves from "moderate" (old, matches-based) to **"low"** (new, minutes-based) — exactly the correction needed.

**This one change, on its own, requires no edits to `explainPlayer.ts`, `strengths.ts`, or the archetype qualifier** — all three already branch on the `confidence` value; they simply start receiving a more accurate one.

---

## 10. "Lack of evidence" vs. "negative evidence" — how this design keeps them distinct

This distinction is preserved structurally, not just by convention:

- **Lack of evidence** (a short sample, whatever its raw rate) is handled by *reliability* — the shrinkage weight is a function of *minutes alone*, completely blind to whether the raw score is high or low. A 20-minute cameo with an excellent rate and a 20-minute cameo with a poor rate get the *same* reliability weight (§6.3's Rushworth-vs-thin-sample comparison shows this symmetry directly: shrinkage pulls extreme scores in both directions toward the mean, proportionally, never selectively).
- **Negative evidence** (a large sample with a genuinely poor rate) is *not* touched by reliability at all — a player with 900 minutes of poor performance has high reliability (their poor rate is well-supported) and their score correctly stays low. Confirmed with real data: Rushworth's 360 minutes of poor goalkeeping barely shrinks (reliability 0.80) — the model is not "generous" to him; it correctly recognizes that his poor number is well-evidenced, not noisy.

The one thing this design does *not* attempt to distinguish, because the data cannot support it yet: whether a short cameo's poor rate is "genuinely bad play" or "not enough time to show anything" — both currently shrink toward the mean identically, which is the statistically honest answer given no further information (see §12, deferred: distinguishing "briefly bad" from "briefly quiet" would need event-level context this project doesn't have).

---

## 11. Season progression — the curve, not a cliff

Reliability at K = 90, computed directly from the formula (not a separate model — the same one used everywhere in this design):

| Minutes | Reliability | Reading |
|---|---|---|
| 50 | 0.36 | Barely past eligibility; heavily shrunk toward the position average |
| 100 | 0.53 | About one match; score and prior roughly equally weighted |
| 200 | 0.69 | Over two matches; raw score starts to dominate |
| 300 | 0.77 | ~3.3 matches |
| 500 | 0.85 | ~5.5 matches |
| 750 | 0.89 | ~8.3 matches |
| 900 | 0.91 | 10 matches |
| 1500 | 0.94 | ~16.7 matches — roughly a third of a mature season |
| 2500 | 0.97 | ~28 matches |

The curve is smooth and monotonic by construction (it's a single continuous rational function) — there is no point at which a player's treatment jumps discontinuously. It also naturally answers the task's own framing: at 5 gameweeks, *nobody* has more than ~490 minutes, so even the most-played players in the league today sit at reliability 0.80-0.85 — appropriately short of "fully established," which is honest given how early the season still is, not a flaw in the constant.

---

## 12. Edge cases and explicitly deferred questions

- **Injured/unavailable players carrying strong but thin-sample intelligence language** (J.Ramsey, currently shown injured with three unqualified "Elite" claims) — the same fix applies to him identically (69 minutes → "low" confidence, category scores shrunk); no special-case logic needed. Not separately modeled beyond confirming this in §6.
- **The single 6-match player** found in the raw data (a fixture-rescheduling artifact per the prerequisite audit) — not investigated further; irrelevant to this design and not worth chasing down before a fix that doesn't depend on match count at all.
- **Whether a short cameo's poor showing is "bad play" or "no time to show anything"** — both shrink identically toward the mean under this design; genuinely distinguishing them would need data (event context, quality of chances defended, etc.) this project has already documented it doesn't have (see the Defence-methodology audits). Not attempted here.
- **Per-category prior granularity** — position-and-category averages were used and validated; a finer-grained prior (e.g., by position *and* team quality) was not tested — no evidence in this pass that the coarser prior is causing a problem, and finer priors risk becoming their own small-sample problem (a team with only 4 matches of its own history is itself a thin sample to average over).
- **True "substitute specialist" validation** — the current 5-gameweek dataset does not yet contain a player with a large accumulated total of substitute-only minutes and sustained strong output (the closest analogues, Chavarria/Herrington, have volume but no output). **This is a real gap in this design's validation, stated plainly rather than papered over**: re-run this exact analysis once such a player exists in the data (likely within a few more gameweeks) to confirm the model continues to correctly reward them as their bench minutes accumulate, rather than assuming it will.

---

## 13. Match Rating — explicitly protected, unchanged

`computeMatchRatings` (`lib/analytics/scoring/matchRating.ts`) feeds `season: { minutes: r.minutes, matches: 1, ... }` for exactly one gameweek into the same engine. **This design's shrinkage is a function of minutes within that single call** — for a Match Rating, "minutes" means minutes played *in that one match* (typically ≤90), so a 20-minute match-level cameo would shrink somewhat *within that match's own rating* too, under a naive application. **This is explicitly not intended and must be guarded against in implementation** (§18): Match Rating's own volatility is correct by design and documented as such — the fix in this design is for the *season* aggregation path only. The recommended implementation scope (§18) makes this a parameter passed by the season-ranking caller, not a change to `computeProvisionalRankings`'s unconditional behaviour, specifically to avoid this trap. Flagging this precisely now so it is not discovered as a bug during implementation.

---

## 14. Best XI implications (architecture only — not built)

Best XI will need to select players by quality while being aware of how much evidence backs that quality (the brief's own framing: don't want a thin-sample flukey inclusion crowding out a proven contributor, but also don't want to exclude a genuine breakout). **If reliability lives inside `computeProvisionalRankings`'s output (Model D, this design's recommendation), Best XI inherits it automatically** by reading the same `RankedPlayer.scores` every other feature already reads — no separate reliability logic needs to be built into Best XI's own selection code.

**Recommended shared primitive**, exported alongside the existing scoring types:

```ts
export function evidenceReliability(minutes: number, K = 90): number {
  return minutes / (minutes + K);
}
```

One function, one constant, consumed by: the score-shrinkage step inside `computeProvisionalRankings`, the confidence classifier (§9, via fixed minute thresholds rather than calling this function directly — confidence needs discrete buckets for language branching, reliability needs the continuous value for score blending; both should be *derived from the same underlying minutes concept*, not two independent inventions), and — later, unbuilt — any Best XI "is this pick well-evidenced enough" logic, Player Comparison's confidence framing, or a future refinement of Worth Knowing. This directly satisfies the brief's own §15: one shared concept, not several systems each deciding independently what "enough evidence" means.

---

## 15. Recommended architecture

1. **Add `evidenceReliability(minutes, K)` to `lib/analytics/scoring/types.ts`** (or a new small `reliability.ts` alongside it) — pure, stateless, no dependencies. K = 90, named and exported (matching the existing convention for `MIN_MINUTES`, `INDIVIDUAL_DEFENCE_WEIGHT` — a stated, visible hypothesis, not a buried magic number).
2. **Inside `computeProvisionalRankings`, after computing each category's raw percentile-based score and before returning `RankedPlayer`**, compute each position-and-category prior (mean across the currently-eligible pool, exactly as tested in §6) and blend: `shrunk = raw × reliability + prior × (1 − reliability)`, using **season-total minutes only** — never touching `computeMatchRatings`'s single-gameweek call path (§13's guard).
3. **Replace `classifySampleConfidence(matches)` with the minutes-based version in §9**, keeping the function name, signature shape (still returns `SampleConfidence`), and every existing consumer's branching logic completely unchanged.
4. **`RankedPlayer.sample` keeps both `matches` and `minutes`** (already does) — nothing about the type needs to grow; `confidence` simply gets computed from the field that was always there but previously unused for this purpose.

**No changes needed to:** `explainPlayer.ts`, `strengths.ts`, `archetypes.ts`'s qualifier logic, `teamRepository.ts`'s "why" slot selection, Worth Knowing, the Top Performers table, or any UI component — every one of them already reads `scores`/`qualityLabel`/`sample.confidence` and will simply receive more accurate values.

---

## 16. Recommended mathematical approach — full formula and every component explained

```ts
const K = 90; // one full match's worth of minutes — see §6.1 for why this value, not another

function evidenceReliability(minutes: number): number {
  return minutes / (minutes + K);
  // → 0 as minutes → 0 (no evidence: fully trust the prior)
  // → 1 as minutes → ∞ (asymptotic: never fully "certain", but effectively so past a few hundred minutes)
  // → 0.5 exactly at minutes = K (one full match = "as much weight as the prior gets")
}

function shrinkCategory(raw: number, minutes: number, prior: number): number {
  const r = evidenceReliability(minutes);
  return raw * r + prior * (1 - r);
  // A weighted average of "what we observed" and "what's typical for this position/category" —
  // the observed rate always pulls the number in its own direction, proportional to how much
  // of it exists; it never overrides the prior entirely, and it never gets ignored entirely.
}

// Applied inside computeProvisionalRankings, per category, per eligible player:
const priorByPositionCategory = /* mean of raw scores[category], grouped by position, over `eligible` */;
scores.attack   = round1(shrinkCategory(rawAttack,   p.season.minutes, priorByPositionCategory[p.position].attack));
scores.creation = round1(shrinkCategory(rawCreation, p.season.minutes, priorByPositionCategory[p.position].creation));
scores.defence  = round1(shrinkCategory(rawDefence,  p.season.minutes, priorByPositionCategory[p.position].defence));
scores.impact   = round1(shrinkCategory(rawImpact,   p.season.minutes, priorByPositionCategory[p.position].impact));
// Overall is then computed from these ALREADY-SHRUNK category scores, using the existing,
// untouched OVERALL_WEIGHTS — no separate shrinkage step needed for `overall` itself, since it's
// a linear blend of already-honest inputs.

function classifySampleConfidence(minutes: number): SampleConfidence {
  if (minutes < 270) return "low";       // 3 matches' worth — same boundary as today, in minutes
  if (minutes < 720) return "moderate";  // 8 matches' worth — same boundary as today, in minutes
  return "established";
}
```

**Every component, restated in football terms:**
- `K = 90`: "how many minutes of watching a completely unknown player would it take before we start trusting what we've seen as much as our general expectation for that position?" Answer proposed here: one full match.
- `prior`: "what does a typical player at this position usually score in this specific category?" — not a guess, computed fresh from the live pool every time, so it moves as the season's overall level shifts.
- `reliability`: "of the two, how much should the observed number count versus the prior?" — purely a function of minutes, deliberately blind to whether the observed number is good or bad, which is what keeps §10's distinction (lack of evidence vs. negative evidence) intact.
- Shrinking **categories**, not just Overall, before the Overall blend: this is what makes the fix reach `explainPlayer`'s per-category claims and the archetype's shape classification for free, without editing either file.

---

## 17. Proposed implementation scope (for a future task — not done here)

- `lib/analytics/scoring/types.ts` (or a new adjacent file): add `evidenceReliability`.
- `lib/analytics/scoring/provisional.ts`: compute per-position-category priors from the eligible pool; shrink each category score before the Overall blend; replace `classifySampleConfidence`'s signature and body per §9, updating its one call site (`sample.confidence: classifySampleConfidence(p.season.matches)` → `classifySampleConfidence(p.season.minutes)`).
- **Explicitly do not touch** `matchRating.ts`'s call path into the shared engine, or thread a flag through so match-level ratings skip the shrinkage step entirely (§13) — this needs to be a deliberate, tested decision in that implementation task, not an afterthought.
- Unit tests: extend `provisional.test.ts` with the exact real-world cases in this document (Isidor, Merino, Rushworth, Haaland) as fixed-input regression cases, plus the reliability function's own boundary behavior (0 minutes, K minutes, large minutes).
- Re-run this document's own experiment methodology against the implemented code as a verification step, confirming the real numbers match what's written here before considering the task done.

---

## 18. Explicitly deferred work

- Building the actual code change (this document is design only, per the task's strict scope).
- Any Best XI selection logic — only the shared-primitive architecture (§14) is specified, not consumed anywhere yet.
- Revalidating once a genuine long-accumulated substitute-specialist profile exists in the data (§12).
- Any UI/copy change to the specific softened-language wording — `explainPlayer`'s existing "early signal" phrasing is reused as-is via the confidence fix; no new copy was designed or is needed for this specific change.
- Finer-grained priors (by team strength, by specific matchup context, etc.) — no evidence found that the coarser position-category prior is currently insufficient.
- A possible future "effective minutes" concept incorporating fragmentation/starts (Model E) — deliberately not adopted now; revisit if and when the data shows a case current minutes-only shrinkage handles poorly.

---

## 19. "Do not change" list

Per the task's explicit scope and this design's own findings, none of the following should change as part of implementing this design:

- Attack/Creation/Defence/Impact's underlying metric definitions and per-90 mechanics.
- The position-specific `OVERALL_WEIGHTS`.
- The 70/30 individual/clean-sheet Defence blend (`INDIVIDUAL_DEFENCE_WEIGHT`/`TEAM_CLEAN_SHEET_WEIGHT`) — unrelated to this problem, already extensively validated in its own audits.
- The 45-minute eligibility floor (`MIN_MINUTES`) — a separate, pre-existing, reasonable "is there even a match's worth of evidence" gate; this design adds continuous treatment *above* that floor, it doesn't replace it.
- Archetype shape classification logic (which category combination maps to which archetype name) — only the *qualifier text* mechanism is affected, and only because it will now receive a more accurate confidence input; the archetype-matching logic itself is untouched.
- Voice mechanisms, Season Story sentence construction, `pickMatchStrength`, Match Centre's leaders/standout logic — all read scores/confidence as inputs and will behave more accurately once those inputs are honest, without needing their own logic changed.
- `computeMatchRatings`'s single-gameweek call path (§13) — protected explicitly, not incidentally.
- The `classifySampleConfidence` function's *name*, *return type*, or *set of callers* — only its internal logic and the field it reads change.

---

## Verification

```
git status --short   → clean (no tracked files modified)
npx tsc --noEmit      → clean, no errors
npx vitest run        → 26 test files, 275 tests, all passing
```

All throwaway scripts used to run these experiments against the real database and real scoring functions were deleted after use; nothing from this design task was committed except this document and its prerequisite audit.
