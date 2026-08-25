# Defence Methodology Audit

**Status:** This audit's own investigation (§1–§11 below) was evidence-gathering only, and remains an unedited historical record — the original methodology really was 50/50, exactly as described throughout this document. **Its recommendation (§10/§11) has since been implemented as an experiment.** See "Implementation Update" immediately below for what actually changed, and `docs/DEFENCE_WEIGHTING_EXPERIMENT.md` for the full before/after report.

**Companion script:** `scripts/audit-defence-methodology.ts` — read-only, re-runnable (`npx tsx scripts/audit-defence-methodology.ts`), queries the live database and calls the real, unmodified `percentileRank` and `MIN_MINUTES` from the scoring engine. Every number in this document comes from that script's output against real GW1 data (n=87 eligible defenders, 20 goalkeepers, 94 midfielders, 21 forwards, all with the new defensive components backfilled). Re-run it once more gameweeks exist — several of this audit's conclusions (§4's exact percentages, in particular) should be expected to shift as the sample grows past one gameweek. The script now also has a §6, added alongside the implementation below, that directly compares the original 50/50 weighting against whatever is currently live.

## Implementation Update

Following this audit's recommendation (§10: "B — a small, targeted adjustment"), `lib/analytics/scoring/provisional.ts` now weights the GKP/DEF Defence blend **70% individual signal / 30% team clean-sheet signal**, via two explicit, named constants (`INDIVIDUAL_DEFENCE_WEIGHT`, `TEAM_CLEAN_SHEET_WEIGHT`) — replacing the unweighted 50/50 average this document describes throughout. Nothing else changed: the individual metric itself (`defensiveActions`/`saves`), MID/FWD Defence (no team component, untouched), Attack/Creation/Impact/Overall, and every other intelligence layer are exactly as before.

**This is explicitly an experiment, not a settled formula** — validated against exactly one gameweek, same as the audit itself. See `docs/DEFENCE_WEIGHTING_EXPERIMENT.md` for the full implementation report: exact before/after numbers, the regression test suite protecting known cases (Mendy in particular), the real downstream effects observed (including a genuine, desirable archetype correction for Dunk), and what to monitor as GW2+ arrives.

---

## 1. Current Methodology — verified against the live code

Re-read `lib/analytics/scoring/provisional.ts` directly rather than trusting the prior audit's description. It is accurate, with one important precision the prior audit didn't spell out:

```ts
function defenceMetricsForPosition(position: PositionCode): Array<keyof Per90Metrics> {
  if (position === "GKP") return ["saves", "cleanSheets"];
  if (position === "DEF") return ["defensiveActions", "cleanSheets"];
  return ["defensiveActions"];  // MID and FWD
}
```

**The team-outcome (clean sheet) component only applies to GKP and DEF.** MID and FWD get a pure individual signal (`defensiveActions` percentile alone, position-relative, no team term at all). The "50/50 individual/team blend" the prior audit described is real, but scoped to two of the four position groups, not all four.

**Full pipeline, confirmed:**

1. **Eligibility:** `minutes >= MIN_MINUTES` (45 — exported constant, verified via direct import, not guessed).
2. **Per-90 normalisation:** every metric divided by minutes played, scaled to a 90-minute rate.
3. **Percentile rank:** `percentileRank()` — fractional-rank percentile (0–100), ties averaged. Defence is computed **position-relative**: each position group is its own percentile pool (a DEF is only ever compared to other DEFs, a GKP only to other GKPs).
4. **Category composite:** the relevant metrics' percentiles are averaged (unweighted mean) and scaled to 0–10.
5. **Overall:** `OVERALL_WEIGHTS[position]` blends Attack/Creation/Defence/Impact — for DEF: `{ attack: 0.15, creation: 0.15, defence: 0.45, impact: 0.25 }`. Defence correctly dominates a defender's Overall (unchanged from the prior audit's finding, and not revisited here — §1 was about Defence itself, not the Overall weights, which are out of scope for this audit).

**Individual vs. team-outcome signals, explicitly separated (as requested):**

| Position | Individual signal(s) | Team-outcome signal | Team signal's share of Defence |
|---|---|---|---|
| GKP | saves/90 | clean sheet/90 | 50% |
| DEF | defensiveActions/90 | clean sheet/90 | 50% |
| MID | defensiveActions/90 | — none — | 0% |
| FWD | defensiveActions/90 | — none — | 0% |

**Missing data handling:** unchanged by this audit — a player below `MIN_MINUTES` is excluded from the cohort entirely (not scored at 0); a metric with no recorded value defaults to 0 via the ingestion layer, which then percentile-ranks normally (a real, low percentile, not a penalty beyond what the 0 legitimately earns).

---

## 2. New-Data Analysis

Distributions (per-90, GW1, positions with the components backfilled):

| Position (n) | Metric | Mean | Median | SD | Range |
|---|---|---|---|---|---|
| **GKP** (20) | tackles/90 | 0.00 | 0.00 | 0.00 | 0 – 0 |
| | CBI/90 | 1.25 | 1.00 | 1.13 | 0 – 4 |
| | recoveries/90 | 8.35 | 8.00 | 4.09 | 4 – 22 |
| | defensiveActions/90 | **0.00** | 0.00 | 0.00 | 0 – 0 |
| **DEF** (87) | tackles/90 | 1.52 | 1.07 | 1.41 | 0 – 6 |
| | CBI/90 | 5.91 | 5.00 | 3.84 | 1 – 20 |
| | recoveries/90 | 3.46 | 3.00 | 1.98 | 0 – 10 |
| | defensiveActions/90 | 7.42 | 6.82 | 3.98 | 2 – 21 |
| **MID** (94) | tackles/90 | 1.75 | 1.41 | 1.42 | 0 – 6 |
| | CBI/90 | 1.85 | 1.44 | 1.76 | 0 – 8 |
| | recoveries/90 | 4.28 | 4.00 | 2.44 | 0 – 14 |
| | defensiveActions/90 | 7.87 | 7.78 | 3.66 | 1 – 16 |
| **FWD** (21) | tackles/90 | 0.81 | 0.00 | 1.11 | 0 – 4 |
| | CBI/90 | 1.61 | 1.30 | 1.61 | 0 – 6.5 |
| | recoveries/90 | 1.97 | 2.00 | 1.31 | 0 – 4.4 |
| | defensiveActions/90 | 4.39 | 3.91 | 2.66 | 0 – 9.7 |

### A significant, previously-undocumented finding: `defensiveActions` is composed differently by position

Checked exactly, across every enriched row, not assumed:

| Position | `defensiveActions == tackles + CBI` | `defensiveActions == tackles + CBI + recoveries` |
|---|---|---|
| DEF | **87/87 (100%)** | 4/87 |
| MID | 4/94 | **94/94 (100%)** |
| FWD | 4/21 | **21/21 (100%)** |
| GKP | 6/20 | 0/20 (GKP `defensiveActions` is always exactly 0 — see below) |

**FPL's own "defensive contribution" formula structurally excludes `recoveries` for defenders, but includes it for midfielders and forwards.** This is not an ingestion bug on our side — it's confirmed, consistent, exhaustive across every real row — it reflects FPL's own (differently-thresholded) defensive-contribution rule by position. The practical consequence: **`recoveries` is a genuinely new, non-redundant signal for DEF specifically** (0% currently reflected in their combined number), whereas for MID/FWD it's already fully baked in (100% reflected). Any recommendation to use `recoveries` should be scoped to defenders for exactly this reason — adding it for MID/FWD would double-count information already in `defensiveActions`.

**Goalkeepers' `defensiveActions` is always 0** (confirmed: mean, median, min, max all 0.00 across all 20 rows) — FPL's defensive-contribution stat evidently doesn't apply to the GKP position at all. This has no effect on the current formula (GKP Defence already uses `saves`, not `defensiveActions`), but it does mean goalkeepers' now-available `recoveries` (mean 8.35/90 — a real, meaningfully-sized, currently completely unused signal, likely reflecting sweeping/distribution involvement) and `CBI` are sitting unused. Out of scope to act on here, but worth recording as a possible future avenue distinct from the DEF question this audit focuses on.

### Correlation between the three components

| Position | tackles↔CBI | tackles↔recoveries | CBI↔recoveries | defensiveActions↔recoveries |
|---|---|---|---|---|
| GKP | n/a (tackles always 0) | n/a | −0.06 | n/a (defensiveActions always 0) |
| DEF | −0.08 | 0.23 | −0.14 | **−0.05** |
| MID | 0.04 | 0.07 | 0.19 | 0.79 |
| FWD | −0.03 | 0.43 | 0.09 | 0.73 |

The three components are **weakly correlated with each other across every position** (all |r| well under 0.5) — they measure meaningfully different things, not three readings of the same underlying activity. The last column confirms the finding above numerically: for DEF, `defensiveActions` and `recoveries` are essentially uncorrelated (−0.05, i.e. no relationship) — proof the combined field carries zero information about recoveries for defenders. For MID/FWD, the strong 0.73–0.79 correlation confirms recoveries is already substantially reflected there.

**Is `defensiveActions` dominated by one component?** For DEF, it's a straight sum of two components (tackles + CBI) with CBI numerically larger on average (mean 5.91 vs. 1.52) — so CBI does dominate the combined number for defenders simply by being a bigger raw count, not because it was deliberately weighted higher. Whether that's desirable (CBI arguably reflects more "last-ditch, higher-stakes" actions than tackles) or accidental is a legitimate open question this audit doesn't resolve — flagged for the team, not decided here.

---

## 3. Lacroix Case Study — as a diagnostic, not a justification

Real GW1 data, DEF cohort of 87 (position-relative percentiles, exactly matching the live formula):

| Metric | Value | Percentile among 87 DEF |
|---|---|---|
| Tackles/90 | 5.0 | high — top quartile range |
| CBI/90 | 7.0 | upper-middle |
| Recoveries/90 | 2.0 | mid-pack |
| **defensiveActions/90 (combined)** | 12.0 | **88th** |
| Clean sheet | No (Chelsea conceded 2) | 35th (tied block — every non-clean-sheet defender shares this) |
| **Current blended Defence score** | — | **62nd → 6.2/10** |

His individual defensive-activity percentile (88th) is genuinely strong — among the better defensive performances in the league that gameweek by this measure. The clean-sheet term, shared by roughly half the cohort, pulls the blended result down 26 percentile points.

**Comparison — three categories, as requested:**

**A. Strong individual activity, team conceded** (the Lacroix pattern) — and Lacroix is far from the most extreme case:

| Player | Individual pct | Blended pct | Delta |
|---|---|---|---|
| O'Shea (IPS) | 98 | 67 | **−31** |
| Senesi (TOT) | 96 | 66 | −30 |
| Richards (CRY) | 96 | 66 | −30 |
| Acheampong (CHE) | 94 | 65 | −29 |
| Thiaw (NEW) | 94 | 65 | −29 |
| Murillo (NFO) | 92 | 64 | −28 |
| Silva (BOU) | 91 | 63 | −28 |
| **Lacroix (CHE)** | **88** | **62** | **−26** |
| Robertson (TOT) | 85 | 60 | −25 |
| Virgil (LIV) | 85 | 60 | −25 |
| Hall (NEW) | 85 | 60 | −25 |

19 of 87 defenders (22%) show a strong individual signal (≥70th percentile) pulled down by 15+ percentile points. **Lacroix sits in the middle of this group, not at its extreme.**

**B. Weak individual activity, team kept a clean sheet** — the reverse effect:

| Player | Individual pct | Blended pct | Delta |
|---|---|---|---|
| Coyle (HUL) | 5 | 51 | **+47** |
| Dunk (BHA) | 1 | 41 | **+40** |
| Collins (BRE) | 8 | 45 | +37 |
| Bogle (LEE) | 8 | 45 | +37 |
| Kayode (BRE) | 29 | 63 | +34 |
| De Cuyper (BHA) | 28 | 61 | +33 |
| Mykolenko (EVE) | 19 | 50 | +31 |
| Vuskovic (BHA) | 19 | 50 | +31 |
| Gabriel (ARS) | 19 | 50 | +31 |

12 of 87 (14%) show this reverse pattern. **Dunk is the most striking case: 1st-percentile individual defensive activity (essentially the quietest defensive game in the league that week) still finishes at the 41st percentile** — a 40-point lift purely from his team's result.

**C. Individual and team signals agree** (the formula working as intuitively expected): Mendy (individual 99th, clean sheet — blended 9.91/10, "Excellent") and Egan (individual 100th, clean sheet — blended 9.07/10) are clean examples where a genuinely dominant individual game coincided with a clean sheet, and the score reflects that without controversy.

**Conclusion for this section:** the Lacroix case is **not an isolated edge case**. It's a clear instance of a systematic pattern affecting roughly a fifth of all defenders in any gameweek in one direction, and about a seventh in the other. Whether that pattern is a "reasonable trade-off" or "too much team influence" is addressed directly in §4 and §8.

---

## 4. Individual Performance vs. Team Outcome — the central question

Restating §3's totals precisely, across the full 87-defender and 20-goalkeeper cohorts:

| | Downgraded (individual ≥70th, blended drops ≥15pts) | Upgraded (individual ≤30th, blended rises ≥15pts) |
|---|---|---|
| DEF | **19 / 87 (22%)** | **12 / 87 (14%)** |
| GKP | 4 / 20 (20%) | 2 / 20 (10%) |

**Is this a legitimate football principle or too much influence?** Both, honestly, depending on direction:

- There is a real, defensible football argument for *some* team-outcome weight: defending is a collective activity, and a back line's job is partly about denying the opponent chances as a unit, not just accumulating personal touches. A clean sheet is real signal, not noise.
- But a **50% weight** produces effects too large to call "a light thumb on the scale" — a defender at the very top of the individual activity distribution (98th percentile, O'Shea) can still land at a merely "Good" 6.7/10 outcome, while a defender at the very bottom (1st percentile, Dunk) can land at a very respectable "Average-to-Good" 4.1/10. **That compression — genuinely elite and genuinely quiet individual performances landing within ~2.5 points of each other once the team term is applied — is hard to defend as reflecting the individual player's game.**
- The magnitude, not the direction, is the issue. Some team-outcome influence on a defender's score is defensible; a coin-flip-sized 50% share is not obviously the right amount, and the data shows it can dominate the individual signal outright in either direction.

---

## 5. Candidate Methodology Experiments

Four candidates, computed for real over the DEF cohort (`scripts/audit-defence-methodology.ts` §5). **None of these are recommendations on their own — they're structured experiments to learn from.**

**A. Current methodology** — `avg(defensiveActions_pct, cleanSheet_pct)`. Baseline for comparison; see §1, §3, §4 for its behaviour.

**B. Separate components** — `avg(tackles_pct, CBI_pct, recoveries_pct, cleanSheet_pct)`, all four equal-weighted.

**C. Reduced team-outcome weighting** — `defensiveActions_pct × 0.7 + cleanSheet_pct × 0.3`, same individual metric as today, only the ratio changes.

**D. Hybrid** — a richer individual base (`avg(tackles_pct, CBI_pct, recoveries_pct)`), then clean sheet applied as a small **additive** adjustment (±0.5 max on the 0–10 scale) rather than a peer term.

| Player | A (current) | B (3-component) | C (70/30) | D (hybrid) |
|---|---|---|---|---|
| Mendy (clean sheet, elite individual) | **9.91** | 6.09 | 9.90 | **5.30** |
| Egan (clean sheet, elite individual) | **9.07** | 6.57 | 9.44 | 6.36 |
| Lacroix (no clean sheet, strong individual) | 6.19 | 5.70 | **7.25** | 6.27 |
| Acheampong (no clean sheet, strong individual) | 6.45 | 7.76 | 7.62 | **9.02** |
| Virgil (no clean sheet, strong individual) | 6.02 | 6.99 | 7.01 | 7.99 |
| Guéhi (no clean sheet, weak individual, scored a goal) | 2.73 | 4.75 | 2.41 | 5.01 |
| Maguire (no clean sheet, weak individual) | 2.73 | 4.00 | 2.41 | 4.00 |
| Shaw (no clean sheet, weak individual) | 2.73 | 3.46 | 2.41 | 3.28 |
| Castagne (no clean sheet, 2 assists, weak defence) | 3.84 | 4.71 | 3.95 | 4.95 |

**Assessment, strengths and weaknesses of each:**

**B (separate components, equal weight):** Effect on Lacroix is small and *slightly negative* (6.19 → 5.70) — worth stating plainly, since this audit is explicitly not trying to inflate his score, and this candidate doesn't. It raises several other players (Acheampong, Virgil, Guéhi) by giving each component equal standing regardless of its raw scale. **Weakness:** the four-way equal split is itself an arbitrary choice with no stronger justification than the current 50/50 split — it swaps one unvalidated weighting for another, and doesn't address the core question of *how much* team outcome should count. **Sensitivity to sample size:** worse than the current formula — three separate low-count metrics (tackles/CBI/recoveries individually) will be noisier percentile inputs than one combined number, especially for short-minute substitute appearances.

**C (70/30 reduced team weight):** Cleanly moves both directions of the systemic issue in the intuitively correct direction: Lacroix rises (6.19 → 7.25), Dunk-style low-individual/clean-sheet cases fall (Dunk: 4.13 → 2.52 in the companion script's counterintuitive-ranking check), and — importantly — **cases where individual and team signals already agree are barely disturbed** (Mendy 9.91 → 9.90, a 0.01 change). This is the cleanest, least disruptive candidate of the four: it changes one number (a weighting ratio) rather than the shape of the metric, is trivial to reason about, and doesn't introduce new noisy inputs. **Weakness:** 70/30 is still a chosen number, not a derived one — it needs to be validated against more than one gameweek before being treated as "correct," and the audit does not claim 70/30 specifically is the right ratio, only that *some* reduction from 50/50 behaves better on every case examined.

**D (hybrid — richer individual base + small clean-sheet adjustment):** This was the most conceptually appealing candidate going in, and **produced the most concerning result in testing**: Mendy — an uncontroversial "genuinely dominant defensive performance, deservedly the gameweek's best-rated defender" case — drops from 9.91 to **5.30**, a "merely average" outcome for a player who topped the individual defensive-activity charts *and* kept a clean sheet. This happens because (a) clean sheet's influence is capped too small to reward an aligned case properly, and (b) building the base from three separately-percentiled, lower-count components is noisier for short-minute appearances (Mendy played 63 minutes) than one combined number. **This is exactly the kind of counterintuitive ranking §5 asked to watch for, and it comes from the candidate designed to look the most sophisticated on paper.** Not recommended as specified.

**No candidate was selected because it raised Lacroix's own score** — B lowers it slightly, C raises it, D raises it marginally; the evaluation criterion throughout was internal consistency and whether known-good/known-bad cases behaved sensibly, not any one player's outcome.

---

## 6. Positional Fairness

The current model already avoids the most obvious fairness trap: **Defence percentiles are computed strictly within a position group** (a DEF is never compared to a MID or FWD), so the fact that defenders naturally rack up more raw defensive actions than forwards (DEF mean 7.42/90 vs. FWD mean 4.39/90) cannot cross-contaminate scores between positions — this part of the design is sound and unchanged by this audit's findings.

**What this audit does surface:** `defensiveActions` isn't actually the *same measurement* across positions — §2 confirmed it's `tackles + CBI` for defenders but `tackles + CBI + recoveries` for midfielders and forwards. Because percentile comparison is always within-position, this doesn't produce a statistical unfairness today (no DEF is ever measured against a MID using this field) — but it is a **conceptual inconsistency** worth naming: the same field name means a structurally different formula depending on position, which matters directly for how any future change (like adding recoveries) should be scoped — it would be a genuinely new signal for DEF, but double-counting for MID/FWD (see §2).

We do **not** have CB/FB granularity in `PositionCode` (`GKP | DEF | MID | FWD` only), and this audit does not propose inventing that distinction — there is no reliable source for it in the current data model, and the brief is explicit that we should not invent positional categories we can't actually verify. Within the existing four groups, the three new components don't obviously demand finer positional treatment beyond what's already discussed (the DEF-specific recoveries gap).

---

## 7. Data Limitations — what we still cannot measure

Restating and extending the prior audit's findings, now informed by what the three new components do and don't cover:

| Football quality | Measurable now? |
|---|---|
| Tackle attempted/won volume | Yes (`tackles`) |
| Clearances, blocks, interceptions (combined, not separable) | Yes (`clearancesBlocksInterceptions`) |
| Possession recoveries | Yes (`recoveries`) — but structurally excluded from `defensiveActions` for defenders (§2) |
| Quality/difficulty of a tackle (last-ditch vs. routine) | **No** |
| Whether a clearance was actually necessary (danger level) | **No** |
| Aerial duels won/lost | **No** |
| Defensive positioning / covering space | **No** |
| Errors leading to a shot or goal | **No** |
| Successful pressing | **No** |
| Preventing progression (not just the final action) | **No** |
| Defensive organisation as a unit | **No** |
| "Goals prevented" (an outfield shot-stopping-quality equivalent) | **No** |

None of this has changed since the prior audit — the new fields add breakdown, not new categories of information. **The honest position remains: FPL's data can tell us a defender was *active* and, now, in what specific way (tackling vs. clearing/blocking/intercepting vs. recovering possession), but not how *good* any individual action was.** This is a real, permanent ceiling on what this data source can responsibly claim, and no formula change proposed here pretends otherwise.

---

## 8. Should Clean Sheet Be an Input or an Adjustment?

This is the conceptual crux the brief asked to isolate. Two models:

> **Model 1 (current):** INDIVIDUAL DEFENSIVE PERFORMANCE + TEAM DEFENSIVE PERFORMANCE (peer components, equal standing)
>
> **Model 2 (proposed framing):** INDIVIDUAL DEFENSIVE PERFORMANCE + TEAM DEFENSIVE OUTCOME CONTEXT (a primary signal, adjusted by context)

The data supports Model 2 as the more defensible framing. A clean sheet is real evidence that the *team* defended well, but it is neither necessary nor sufficient evidence about any *one player's* game — Dunk (1st-percentile individual activity, clean sheet) and O'Shea (98th-percentile individual activity, no clean sheet) are the two clearest proof points in this exact gameweek that the current model conflates "how well did this team defend" with "how well did this player defend."

§5's Candidate C is the closest concrete implementation of Model 2 tested here: same individual metric, same team signal, just a materially smaller share for the team term — and it behaved well on every case examined without introducing new problems. This doesn't mean 0.3 is the exact right weight, only that the *direction* (individual signal primary, team outcome as a smaller contextual adjustment rather than a coin-flip peer) is well supported by the evidence gathered.

---

## 9. What a Knowledgeable Football Fan Would Notice

Concrete GW1 examples where the app's current interpretation would likely surprise or frustrate an informed viewer:

- **Dunk (Brighton):** 1st-percentile individual defensive activity — essentially the quietest defensive game of any defender that week — still finishes with a "respectable" 4.1/10 Defence score, purely because Brighton kept a clean sheet. A fan who watched Brighton's other defenders do the heavy lifting would find this odd.
- **O'Shea, Senesi, Richards:** each had a genuinely elite individual defensive workload (96th–98th percentile) but their teams conceded, capping them at "Good, not exceptional" (6.6–6.7/10). A fan who saw one of these players single-handedly keep their side in the match would reasonably expect a higher score than a run-of-the-mill "Good."
- **Lacroix specifically:** defended actively, added an assist, and finished 6.4 Overall / "Good" — not a poor score, but not one that would prompt "one of the better players on the pitch," which several fans' live impressions suggested. This audit doesn't resolve whether 6.4 is "wrong," only that the Defence component specifically underweights what a fan would credit him for individually.
- **Guéhi:** scored a goal, individual defensive activity was weak (19th percentile), team conceded — Defence score of 2.7 ("Below average") is arguably the *most* defensible of any case examined here: nothing about his defensive involvement that match supports a higher score, and the goal is correctly rewarded elsewhere (Attack 9.3). This is a good example of the model working as intended, not a flaw.
- **Goalkeepers making many saves but conceding:** not tested numerically in this audit (out of scope — GKP's formula wasn't the focus), but the same conceptual issue applies identically: a goalkeeper's `saves` percentile and the team's `cleanSheets` percentile are blended exactly as they are for defenders, and a busy, excellent goalkeeper on a leaky team would show the same compression pattern documented for defenders in §3–§4.

The consistent theme: **the model's failures cluster specifically around cases where individual quality and team result diverge** — exactly the "individual vs. team outcome" question this audit was built to investigate, and exactly where an informed fan's mental model (which naturally separates "how did *he* play" from "what was the scoreline") and the app's current model (which doesn't, for DEF/GKP) part ways.

---

## 10. Recommendation

**B — Make a small, targeted adjustment. Not A (keep as-is), and not C (a full redesign).**

**Why not A (keep as-is):** §3–§4 show this is a systematic pattern (22% of defenders materially downgraded, 14% materially upgraded by team outcome alone, GW1), not an edge case, and §9 shows it produces results an informed fan would reasonably contest. Leaving it unaddressed means a recurring, predictable class of "the app doesn't seem to get it" moments.

**Why not C (full redesign):** §5 shows real risk in reaching too far — Candidate D, the most ambitious redesign tested, produced a worse outcome for an uncontroversial "great performance" case (Mendy) than the current formula does. Splitting into more granular inputs before this audit's sample is any bigger than one gameweek would be over-fitting a fix to a single gameweek's data, which the brief explicitly warned against.

**Proposed smallest defensible change (not implemented in this task):**

1. **Reduce the team-outcome (clean sheet) share of the DEF and GKP Defence blend from 50% down to a smaller minority weight** — something in the neighbourhood of Candidate C's 70/30 individual/team split, which was the single cleanest-behaving experiment run: it corrected both directions of the systemic issue (§3's categories A and B) without disturbing the "signals agree" cases (category C) and without introducing new noise. The exact ratio (70/30 vs. some other split) should be tuned and re-validated once more than one gameweek of data exists — this audit supports the *direction and magnitude class* of the change, not a precisely optimised number from a single gameweek.
2. **Leave `defensiveActions` itself as the individual metric for now** — do not immediately restructure it into separate tackles/CBI/recoveries percentiles (Candidates B and D). The correlation and noise analysis in §2 and §5 shows real promise in `recoveries` specifically for defenders (a genuinely new, non-redundant signal there), but also real risk (noisier at low minutes, no clearly-better weighting scheme yet identified). This deserves its own follow-up investigation with more data, not folding into this change.
3. **What should NOT change:** Attack, Creation, Impact, Overall weights, Form, Consistency, Momentum, Player Intelligence, Archetypes, Match Rating's structure, or the position-relative cohort design (§1, §6) — none of this audit's findings implicate any of those.

**What additional data would improve this further:** more gameweeks (to validate any specific weighting choice against a larger, more stable sample — this audit deliberately treats every specific number from GW1 as provisional); and, longer-term, the categories listed in §7 that no currently-available free source provides (duel quality, positioning, errors) — acknowledged as a permanent ceiling, not a near-term to-do.

---

## 11. Proposed Next Implementation Step (not implemented here)

If the team accepts this recommendation: a follow-up task to **reduce the clean-sheet weight in the DEF/GKP Defence formula from 50% to a smaller share** (starting from ~70/30 as a validated-in-spirit, not validated-in-exact-number, reference point), re-run the full regression suite plus this audit's script against the change, and confirm:

- Match Rating, Overall, and every other category remain untouched (only Defence's internal weighting changes).
- The specific comparison cases in this document (Mendy, Egan as aligned cases; Lacroix, O'Shea, Virgil as the "downgraded" pattern; Dunk, Coyle as the "upgraded" pattern) all move in the direction this audit's evidence supports, without introducing new counterintuitive rankings.
- The change is validated against at least the next gameweek's data before being considered settled, not treated as final from GW1 alone.

This audit does not recommend touching `recoveries`, `tackles`, or `clearancesBlocksInterceptions` as separate formula inputs yet — that remains a distinct, second-order question flagged in §2, §5, and §10 for its own future investigation once there's more evidence to evaluate it against.

---

## Verification

```
git status / git diff   → only this document, its companion script, and the
                           already-reviewed defensive-data-enrichment changes
                           from the prior task; no scoring/UI/intelligence
                           code touched by this audit
npx tsc --noEmit          → clean
npx vitest run             → 19 test files, 181 tests, all passing (unchanged
                           from before this audit)
npm run build               → clean production build, unchanged route table
```
