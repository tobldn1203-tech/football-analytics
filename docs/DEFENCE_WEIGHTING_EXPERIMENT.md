# Defence Team-Outcome Weighting — Experiment Implementation Report

**Companion to:** `docs/DEFENCE_METHODOLOGY_AUDIT.md` (the investigation that recommended this) and `docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md` (the original Lacroix investigation that started this whole line of work).

**This is documented as an experimental post-audit weighting, not "the correct Defence formula".** It is based on exactly one completed Premier League gameweek. It must be revisited once GW2+ data exists — see "What to Monitor" below.

---

## 1. Exact Formula — Before

`lib/analytics/scoring/provisional.ts`, GKP/DEF Defence blend:

```
defence_score = (individual_percentile × 0.5 + clean_sheet_percentile × 0.5) / 10
```

Implemented as an unweighted average via the shared `averagePercentilesTo10()` helper — the same function used by Attack, Creation, and Impact. MID/FWD had (and still have) no team component at all: `defence_score = individual_percentile / 10`.

## 2. Exact Formula — After (experimental)

```
defence_score = (individual_percentile × INDIVIDUAL_DEFENCE_WEIGHT + clean_sheet_percentile × TEAM_CLEAN_SHEET_WEIGHT) / 10
```

with `INDIVIDUAL_DEFENCE_WEIGHT = 0.7`, `TEAM_CLEAN_SHEET_WEIGHT = 0.3` — two explicit, named, exported constants in `provisional.ts`, with a comment explaining why they exist, what evidence motivated them, and exactly how to revert (`set both back to 0.5`). Computed via a new small `weightedAveragePercentilesTo10()` function, used only for the 2-metric GKP/DEF case — `averagePercentilesTo10()` itself, and every category that uses it, is untouched. MID/FWD Defence still never reaches this code path at all (confirmed by test — see §4).

**What did not change:** `defensiveActions` and `saves` (the individual metrics themselves), the position-relative cohort design, Attack/Creation/Impact/Overall and their weights, Form, Consistency, Momentum, Player Intelligence, Season Story, Archetypes, Match Rating's structure, and every UI component. `tackles`, `clearancesBlocksInterceptions`, and `recoveries` remain unused by any formula — this experiment only touches the existing `defensiveActions`/`cleanSheets` blend ratio.

## 3. Players Materially Affected

Full real-data comparison for all 87 eligible GW1 defenders and 20 goalkeepers is in `scripts/audit-defence-methodology.ts`'s §6 output (re-run with `npx tsx scripts/audit-defence-methodology.ts`). Headline movers:

**Case A — strong individual activity, team conceded (the Lacroix pattern) — all improved, as intended:**

| Player | Old Defence | New Defence | Old rank (of 87) | New rank |
|---|---|---|---|---|
| O'Shea | 6.66 | 7.90 | 13 | 8 |
| Senesi | 6.57 | 7.78 | 15 | 10 |
| Richards | 6.57 | 7.78 | 14 | 9 |
| **Lacroix** | **6.19** | **7.25** | 22 | 16 |
| Virgil | 6.02 | 7.01 | 27 | 19 |

**Case B — weak individual activity, clean sheet (the Dunk pattern) — all reduced, as intended:**

| Player | Old Defence | New Defence | Old rank | New rank |
|---|---|---|---|---|
| Coyle | 5.12 | 3.26 | 39 | 67 |
| **Dunk** | **4.13** | **2.52** | 59 | 72 |
| Collins | 4.48 | 3.01 | 56 | 69 |
| Bogle | 4.48 | 3.01 | 55 | 68 |
| Kayode | 6.28 | 4.93 | 21 | 48 |

**Case C — individual and team signals agree (Mendy/Egan) — essentially untouched, as required:**

| Player | Old Defence | New Defence | Old rank | New rank |
|---|---|---|---|---|
| **Mendy** | **9.91** | **9.90** | 1 | 1 |
| Egan | 9.07 | 9.44 | 2 | 2 |

## 4. Did the Lacroix Issue Improve?

**Yes.** Defence 6.2 → 7.3 ("Good" → "Very good"), Overall 6.4 → 6.9 ("Good" throughout, but materially closer to the top of that band). His individual defensive-activity percentile (88th) is now much more visibly reflected rather than being pulled halfway back to the middle of the pack by his team's result.

## 5. Did the Dunk-Type Issue Improve?

**Yes.** Defence 4.13 → 2.52 ("Average" → "Below average"). His 1st-percentile individual activity is no longer able to hide behind his team's clean sheet to the same degree.

## 6. Did the Mendy-Type Case Remain Sensible?

**Yes — protected by both a mathematical guarantee and a direct regression test.** When individual and team percentiles are both at (or near) the top, `(100×w₁ + 100×w₂)/10 = 10` for *any* w₁+w₂=1 — so this class of case cannot regress no matter how the exact ratio is tuned later. `lib/analytics/scoring/__tests__/provisional.test.ts` now has a dedicated test asserting this directly. Real data confirms it: Mendy moved by −0.01, Egan by +0.37 (both stayed rank 1 and 2 respectively).

## 7. Unexpected Downstream Effects

Checked Performance, Match Rating, Strength detection, Season Story, and Archetypes for every case player, as requested. One genuine, notable effect found — reported here, not compensated for:

**Dunk's archetype changed from "All-Round Defender" to "Profile still taking shape".** Verified directly: under the old 4.13 Defence score, Dunk's dimensions (`attack=3.3, creation=5.2, defence=4.13`) crossed `archetypes.ts`'s `LOW` threshold (4.0) on both "going forward" and defence, qualifying for "All-Round Defender". Under the new 2.52 Defence score, defence falls below that threshold and no archetype shape matches, correctly falling back to "Profile still taking shape."

**This is judged a correct, desirable side effect, not a bug.** A player with the single lowest individual defensive-activity percentile in the entire GW1 cohort was being labelled a "reasonably even split between defensive duties and contributing going forward" purely because his team happened to keep a clean sheet — exactly the kind of false-positive the audit was investigating. The corrected label ("nothing stands out clearly yet") is more honest. No compensating logic was added to `archetypes.ts`; its thresholds are unchanged.

No other archetype, Season Story wording, or Strength-detection change was observed for any of the players checked (Lacroix, O'Shea, Mendy, Guéhi) — Season Story text is unaffected because it's driven by sample-confidence tier (still "Limited" for everyone with 1 match played), not by the exact Defence value.

## 8. Tests, Type-Check, Build

```
npx tsc --noEmit     → clean
npx vitest run        → 19 test files, 190 tests, all passing
                        (181 pre-existing + 9 new: weight-sum invariant,
                        6 hand-derived synthetic edge cases, the Mendy
                        protection guarantee, and a MID/FWD-unchanged check)
npm run build          → clean production build, unchanged route table
```

New regression tests live in `lib/analytics/scoring/__tests__/provisional.test.ts`. Every synthetic edge case's expected score was hand-derived from `percentileRank`'s exact fractional-rank formula before running the test (not fitted after the fact) — see that file's comments for the arithmetic.

**Real-application verification** (screenshots taken, no UI code touched): visited Lacroix, O'Shea, Mendy, and Dunk's player pages against live production data. All four rendered correctly with zero console/page errors, identical layout and styling to before, and the new scores/labels/archetypes flowing through exactly as computed — including Dunk's page now correctly showing "🌱 Profile still taking shape" instead of "All-Round Defender."

## 9. What to Monitor Once GW2+ Data Arrives

1. **Re-run `scripts/audit-defence-methodology.ts` in full**, including its §6 comparison, against the larger sample. Confirm the same named cases (Lacroix, O'Shea, Senesi, Richards, Dunk, Coyle, Mendy, Egan) continue to move in the directions this report documents, and that §4-style systemic percentages (22% downgraded / 14% upgraded under the old formula) are recalculated rather than assumed to still hold.
2. **Watch for new counterintuitive cases** the 70/30 ratio might introduce that a single gameweek couldn't reveal — the audit was explicit that 70/30 is "the right *direction and magnitude class*", not a validated exact number.
3. **Track archetype stability** for defenders sitting near the `LOW`/`ELEVATED` thresholds (4.0/5.5) — Dunk's case shows the new weighting can move a player across an archetype boundary; that's expected behaviour, but worth confirming it keeps happening for the right reasons (genuinely weak individual signal) and not for players who are borderline in ways that feel arbitrary.
4. **Do not treat this ratio as final.** If GW2+ data suggests a different ratio behaves better, change `INDIVIDUAL_DEFENCE_WEIGHT`/`TEAM_CLEAN_SHEET_WEIGHT` directly — that's the entire reason they're named constants rather than inline numbers.
5. The audit's still-open, deliberately-deferred question — whether `tackles`/`clearancesBlocksInterceptions`/`recoveries` should become separate scoring inputs (Candidates B/D) — remains unimplemented and untouched by this change. Candidate D's Mendy regression (§5 of the audit) is a specific reason to be cautious about revisiting that without a larger sample.
