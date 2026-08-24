# Performance Intelligence — Football Sense Check

**Date:** 2026-08-25. **Data:** real, current-season Premier League data via the FPL provider,
1 finished gameweek. **Method:** `scripts/audit-intelligence.ts` (kept in the repo, safe to
re-run after every ingest) computed the full `PlayerIntelligence` object for a representative
sample of real players per position, plus adversarial synthetic sequences for Consistency and
Momentum built from this audit's own worked examples (real data doesn't yet have enough matches
per player to exercise those two concepts directly). Player pages for two flagged cases (De
Cuyper, Bergvall) were also inspected in the browser to see how a finding actually reads on the
page, not just in a log line.

No formulas were changed as part of this audit. This is a diagnosis, not a fix.

> **Update, same day:** the issue in §3.1 (strength detection not confidence-gated) has been
> **fixed** — see "Resolution" under §3.1. No scoring formula changed; only the confidence-aware
> interpretation layer on top of it. §3.2 (defensive activity vs. effectiveness) remains an open,
> documented methodology limitation by design — see its "Resolution" note.

## 1. What works well

- **Position-relative Defence differentiates real goalkeeping performance sensibly.** Tzolakis
  (clean sheet, saves) scored 9.0 Defence; Rushworth (conceded, quiet game) scored 2.9 — both
  goalkeepers, compared only against each other, producing the ordering a fan would expect.
- **Attack/Creation are correctly excluded from every goalkeeper's and most defenders'
  strengths**, because they sit below the 5.5 threshold — the system never claimed a goalkeeper's
  "strength" is his attacking output.
- **Momentum's minimum-sample gate and its resistance to a single big match both hold up under
  adversarial testing.** A synthetic player with one 45-bps match preceded by four ordinary ones
  (12, 11, 13, 12) does **not** register as Rising — the recent-3-match window dilutes the spike,
  and the `max(3, baseline × 0.25)` threshold isn't cleared (magnitude 4.1 vs. threshold 4.65).
  This was the brief's central worry about Momentum ("we don't want it to just mean 'scored
  highly last weekend'"), and it's specifically the thing this test was built to catch.
- **A genuine 3-match rise/fall against an earlier baseline is detected correctly and cleanly**
  (synthetic RISING at magnitude +7.4, FALLING at −9.2, a flat sequence correctly reads STABLE at
  −0.1).
- **Consistency is genuinely orthogonal to quality, exactly as designed.** The brief's own
  "Player A" (steady, strong: 8.5/8.6/8.7/8.4/8.6) and "Player C" (steady, mediocre:
  6.5/6.6/6.5/6.7/6.6) both score 9.9 "High consistency" — identical, despite very different
  performance levels. A mediocre-but-steady player is not penalised for being mediocre here, and
  a strong-but-steady player isn't penalised either; the concept measures only variation, as
  intended.
- **Confidence gating currently suppresses every single fake-precision case in the live
  system.** With 1 gameweek of data, every one of the 200 eligible players correctly shows
  "Limited" confidence, and Consistency/Momentum correctly report "unavailable" for all of them.
  Nothing is inventing certainty that doesn't exist.
- **The deterministic summary sentence downgrades appropriately at Limited confidence.** Every
  single-match player's summary read "It's still early days for X this season — just 1 match so
  far, but the early signs are [label]" rather than a confident verdict — checked across dozens
  of real players, no exceptions found.
- **Position-aware Overall weighting correctly dampens a single event's effect on the headline
  score, differently per position.** The same raw event (one goal) contributes to a forward's
  Performance far more (attack weighted 0.45) than a defender's (attack weighted 0.15) — exactly
  the intended effect of the weighting scheme, and it's working.
- **Impact treats the same kind of contribution comparably across positions** — goal
  contributions from a defender, a forward and a midfielder all produced Impact scores in the
  same 9.6–9.9 band, so the single league-wide `bps` proxy isn't quietly favouring one position
  over another for equivalent output.

## 2. Unexpected but defensible results

- **Every player currently shows "Limited" confidence and unavailable Consistency/Momentum.**
  Surprising to see at a glance, but entirely correct — the season is one gameweek old. Not an
  issue; see §4.
- **"Elite" Form labels appear frequently among top performers.** Mechanically correct: Form's
  bands are percentile-based, so the top ~10% of any distribution will always read "Elite" by
  definition, and this audit's own sampling method (top-4-by-Performance per position)
  deliberately selects players likely to also have high Form. Not a flaw — an artifact of how the
  sample was drawn, not of the scoring.
- **Some single-match players show a large gap between Form and Performance** (e.g. one forward
  at Performance 3.5 but Form 0.5, Δ−3.0). Mechanically consistent: Form derives from `bps` alone,
  Performance blends four categories, so they can legitimately diverge — the methodology page
  already states this is deliberate. Worth watching whether this magnitude of divergence stays
  common once more matches exist (if so, it's evidence Form's single-metric basis is too narrow —
  see §6.4), but it isn't wrong today.

## 3. Genuine issues discovered

### 3.1 Strength detection is not confidence- or sample-size-aware — the most important finding — ✅ RESOLVED

Two concrete, real, on-page examples:

- **De Cuyper** (Brighton, DEF) — one match, 77 minutes, 1 goal + 1 assist. His player page lists
  **four** "Key strengths": Match impact, Recent form, **Attacking threat**, **Chance creation** —
  all "Elite." Defence — his actual specialist attribute, scored 6.0 "Good" — doesn't make the
  list at all. A knowledgeable fan looking at this page would not conclude "elite attacking
  threat and chance creation" from a defender's single goal and assist; they'd conclude "he had a
  good attacking game" — a real, important difference in confidence.
- **Bergvall** (Spurs, MID) — one match, 45 minutes, in a match his team lost 0–3. His player page
  lists "**Defensive work — Elite defensive contribution for the position**" as a headline
  strength. His team conceded three goals while he was on the pitch. This is the clearest false
  signal found in this audit.

Root cause, precisely: `detectStrengths()` (`lib/analytics/intelligence/strengths.ts`) and the
separate, actually-rendered `explainPlayer()` (`lib/analytics/scoring/explain.ts`, which powers
the "Key strengths"/"Why" panels in the UI today) both select strengths by score threshold alone.
**Development areas are explicitly confidence-gated** (`allowDevelopmentAreas:
player.sample.confidence !== "low"`) — **strengths are not.** That asymmetry is the bug, in the
sense that it wasn't a deliberate decision, just an omission once development areas were gated.

This isn't a formula bug — every number is being computed exactly as designed. It's a
**presentation-layer confidence gap**: a conclusion drawn from 45–77 minutes of football is being
shown with the same visual authority as one drawn from a full season.

(Secondary note, not a functional problem today: two separate, slightly different strength
implementations exist — `explainPlayer` (4 items, threshold 4.0, actually on-screen) and
`detectStrengths` (2 items, threshold 5.5, feeds `PlayerIntelligence` but isn't yet rendered
directly as pills anywhere). Both had the same gating gap; both are now fixed — see below.)

**Resolution:** both implementations are now confidence-gated, reusing the existing
Limited/Developing/Established classification (`classifySampleConfidence`) — no new confidence
model was introduced, per the constraint on this fix.

- `detectStrengths()` (`lib/analytics/intelligence/strengths.ts`): `primaryStrengths` is now `[]`
  at Limited confidence, mirroring exactly how `developmentAreas` was already gated. Chosen over
  softened text here because `StrengthArea` is a terse internal category tag (e.g. "Attacking
  output"), not a sentence — there's no natural "early signal" phrasing to give a two-word label,
  so suppression is the honest option for this data shape.
- `explainPlayer()` (`lib/analytics/scoring/explain.ts`) — the function actually rendering the
  "Key strengths" panel on both the player page and the homepage "Why" panel: at Limited
  confidence it now returns *softened prose* rather than suppressing outright (Option B from the
  brief), e.g. "Early attacking impact — based on 1 match so far, an early signal, not yet a
  proven strength" instead of "Elite attacking threat — Elite threat in front of goal this
  season." The headline sentence drops its causal claim too: "Early days — rated very good so
  far, based on just 1 match" instead of "Rated very good overall (8.0), driven mainly by
  attacking output." Chosen over suppression here because emptying the "Key strengths" section for
  most of the early season (when most players are Limited-confidence) would make the section feel
  broken rather than honest — the existing "no strengths met the bar" empty state already exists
  for genuinely flat profiles and reads fine there, but every early-season player hitting it would
  not.
- Once a player reaches **Developing** (3+ matches) or **Established** (8+) confidence, both
  functions return unchanged, normal-confidence language — verified in
  `lib/analytics/scoring/__tests__/explain.test.ts` and
  `lib/analytics/intelligence/__tests__/strengths.test.ts`.
- **Category scores themselves are untouched.** Nothing in this fix changes what
  `player.scores.attack` etc. equals — De Cuyper's Attack is still 9.7, Bergvall's Defence is
  still 9.9. Only the *interpretive claim* built on top of those numbers is now confidence-aware.
  Verified live: De Cuyper's and Bergvall's category bars (the raw 0–10 scores) are unchanged;
  only their "Key strengths" panels changed.
- Verified in the browser post-fix: De Cuyper's page now reads "Early attacking impact" / "Early
  creative impact" / "Early match impact" / "Early form signal", all captioned "an early signal,
  not yet a proven strength"; Bergvall's reads "Early defensive impact" / "Early creative impact"
  the same way. Neither page makes an "Elite" claim any more.

### 3.2 Defensive-actions-only Defence (MID/FWD) has no relationship to defensive outcome

Bergvall's case again: his 9.9 Defence score comes entirely from `defensiveActions` per-90 (CBI +
tackles + recoveries) — a count of defensive *activity*, not defensive *success*. A player who is
under constant pressure in a heavy defeat can rack up defensive actions while his team ships
goals. DEF/GKP's Defence score already includes clean sheets as a countervailing outcome signal;
MID/FWD's doesn't (by design — a midfielder isn't individually "responsible" for a clean sheet the
way a centre-back is), but the *label* "Excellent defensive contribution" doesn't communicate the
difference between "very defensively active" and "defensively successful."

**Resolution: documented, not fixed — deliberately, per this round's scope.** This is a
**methodology limitation**, not something this fix attempts to solve. Stated explicitly for the
record:

- **Defensive activity** (what `defensiveActions` measures for MID/FWD: tackles, interceptions,
  clearances, blocks, recoveries, summed and rate-adjusted per 90) is a count of defensive *effort*
  — how much a player did defensively, regardless of whether it worked.
- **Defensive effectiveness** (whether that effort actually prevented goals/chances) is a
  *different, currently unmeasured* concept for MID/FWD. DEF/GKP get a partial proxy for it via
  clean sheets; MID/FWD do not.
- **The current data reliably supports activity, not effectiveness, for MID/FWD.** No claim of
  defensive effectiveness should be attached to a MID/FWD Defence score until a real outcome
  signal (e.g. goals/xG conceded while on the pitch, or a possession-adjusted defensive metric) is
  available and verified against real matches. The softened "Early defensive impact" language
  introduced in §3.1's fix incidentally reduces the visibility of this issue at Limited confidence
  (Bergvall's case no longer says "Elite"), but the underlying category score — and the "Excellent"
  label it gets once a player reaches Established confidence with a genuinely high
  `defensiveActions` rate — still describes activity, not effectiveness. This should be revisited
  as a distinct methodology decision (see §6.3), not folded into this fix.

## 4. Data limitations

- **Only 1 Premier League gameweek exists.** Consistency (needs ≥3 qualifying matches) and
  Momentum (needs ≥4) are correctly unavailable for every real player right now — this audit
  could not observe either concept against genuine multi-match Premier League data, only against
  synthetic sequences built from this brief's own worked examples. Re-run
  `scripts/audit-intelligence.ts` after a few more gameweeks are ingested and re-check §3 and §6.
- **Per-90 extrapolation is inherently noisiest exactly when the sample is smallest** — a
  structural property of any per-90 statistic, not something more code can fix. It compounds
  finding 3.1: a 45-minute cameo produces the same *shape* of category score as a full season,
  just with far less evidence behind it, and today nothing downstream treats those two cases
  differently once you're above the 45-minute ranking floor.

## 5. Methodology limitations (already documented, restated for completeness)

- Impact is one `bps`-based proxy applied to every position — no shot-stopping/distribution
  breakdown for goalkeepers, no progression-specific breakdown for defenders.
  (`docs/DATA_SOURCES.md`, methodology page.)
- Progression is not available from any confirmed free source.
- Momentum's "baseline" includes the recent matches themselves rather than a strictly separate
  "before" period — a known, documented simplification, most visible right at the 4-match minimum
  (where only 1 of 4 matches sits outside the "recent" window).
- **Defence for MID/FWD measures defensive activity, not defensive effectiveness** — see §3.2. It
  reliably answers "how much defensive work did this player do" (tackles, interceptions,
  clearances, blocks, recoveries per 90); it does not answer "did that work actually keep the ball
  out of the net." DEF/GKP's Defence score is a closer (though still partial) proxy for
  effectiveness, since it includes clean sheets. Treat any MID/FWD Defence score as an activity
  measure until an outcome-based signal is added and verified.

## 6. Recommended improvements

1. **✅ Done.** Gate `primaryStrengths` behind sample confidence, the same way `developmentAreas`
   already are. See §3.1 "Resolution."
2. **Partially done — not a full merge.** `explainPlayer` and `detectStrengths` were not merged
   into one implementation (that would have been a larger change than this fix's scope), but both
   now apply the same confidence gate independently, so they can no longer drift apart on *this*
   specific question. A full reconciliation into one source of truth remains open — worth doing
   before either implementation grows a third piece of logic, but not urgent now that both are
   individually correct.
3. **Distinguish "defensively active" from "defensively effective" in Defence's presentation for
   MID/FWD**, or fold in a lightweight outcome signal (e.g. goals conceded while on the pitch).
   **Why:** Bergvall's case shows the current framing can read as a compliment in a heavy defeat —
   a specific, reproducible mismatch between the number and what a fan would call "good
   defending."
4. **Revisit Consistency's CV→score mapping once real multi-match data exists.** The brief's own
   "Player B" worked example (10.0/9.8/6.0/5.9/8.5 — a real high/low spread) computed to 7.8
   "Consistent," which may read as too generous a label for that spread. The *relative* ordering
   was correct (well below Players A/C's 9.9); the *absolute* label boundary is the open question.
   **Why not now:** one synthetic example isn't enough evidence to re-derive a threshold — wait
   for real matches, then recalibrate once, deliberately.
5. **(Low priority, cosmetic)** The player page renders Attack/Creation bars for goalkeepers even
   though those categories carry zero Performance weight for that position. Not incorrect, mildly
   uninformative. UI change, explicitly out of scope this round.

## 7. Concepts that should NOT be changed yet

- **Momentum's window, baseline and thresholds** — passed its adversarial "one great match" test;
  no evidence of a problem, real or synthetic.
- **The league-wide vs. position-relative split for Attack/Creation vs. Defence** — validated
  correct in an earlier session; nothing in this audit contradicts it. The false signals found
  here come from sample size at strength-*selection* time, not from this split.
- **Confidence thresholds (3 / 8 matches)** — no real evidence yet either way with only 1
  gameweek; too early to second-guess.
- **Form's recency weights `[1, 0.8, 0.6, 0.4, 0.2]`** — no real multi-match data available to
  evaluate against yet; the one synthetic check available behaved sensibly.
- **The per-position Overall weighting scheme** — confirmed working as intended in this audit
  (§1); a single raw event moves each position's Performance by a plausible, different amount.

## Bottom line

The core percentile engine and the Consistency/Momentum/Confidence gating are working as
designed and held up under real data and adversarial synthetic tests. The one substantive problem
found — strength detection not inheriting the small-sample honesty that development areas and the
summary sentence already had — is now **fixed**: both `explainPlayer` and `detectStrengths` are
confidence-gated, using the existing Limited/Developing/Established classification and no new
model. Category scores are unchanged; only the confidence of the *claim* made about them changed.
Verified with new unit tests (`explain.test.ts`, extended `strengths.test.ts` and
`summary.test.ts`) and live in the browser on both flagged pages (De Cuyper, Bergvall) and the
homepage "Why" panel.

Remaining open items are genuinely deferrable: the defensive activity-vs-effectiveness question
(§3.2/§5) is now explicitly documented rather than silently wrong, and is a real methodology
decision for later, not an oversight; Consistency's label thresholds (§6.4) and the
`explainPlayer`/`detectStrengths` reconciliation (§6.2) are both real but lower-priority. With the
confidence gap closed, Player Archetypes no longer inherits a false-certainty problem from the
strength labels it would be built on.
