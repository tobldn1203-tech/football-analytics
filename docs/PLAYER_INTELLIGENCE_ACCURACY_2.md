# Player Intelligence Accuracy 2.0 — Defensive Performance

**Companion documents:** `docs/PLAYER_INTELLIGENCE_ACCURACY_AUDIT.md` (the original Lacroix investigation), `docs/DEFENCE_METHODOLOGY_AUDIT.md` and `docs/DEFENCE_WEIGHTING_EXPERIMENT.md` (the 50/50 → 70/30 change already implemented). This document picks up where those left off, using the same reusable script (`scripts/audit-defence-methodology.ts`, extended with a new §7/§8), and reaches a different conclusion than "tune the formula again": **the evidence does not support a further methodology change right now.**

**No production code was changed to produce this document.** `git status` shows only the audit script extension; `tsc --noEmit` and `vitest run` (190/190) both confirmed clean before and after.

---

## 1. Executive Conclusion

**Lacroix's Defence score is now 7.3/10 — already inside the 7–9 range the user's own football judgement expected.** Overall is 6.9 ("Good"), 0.1 short of the "Very good" band (≥7.0). The 50/50→70/30 change already implemented closed most of the original gap; what remains is small, and testing a further, well-motivated candidate (adding `recoveries` as a third individual signal, avoiding the double-counting the prior audit identified) **does not improve Lacroix's score — it lowers it to 5.74** — while also weakening two of the clearest "aligned, correctly-rated" cases in the dataset (Mendy 9.90→8.35, Egan 9.40→8.13).

This is the central finding: **there is no tested, honest, non-Lacroix-optimised change available right now that both (a) genuinely improves Lacroix's case and (b) doesn't damage other clearly-correct cases.** That is meaningfully different from "the model is broken" — it is evidence that the model, at its current 70/30 setting, is already closer to a reasonable equilibrium than the premise of this investigation assumed.

Classifying against Objective 4's options: **the answer is closest to (A) — largely correctly scored now, with the residual gap attributable to a genuine, permanent data-visibility boundary (§5, §7) rather than a fixable formula defect (B/C/D).** There is a smaller, legitimate open question about whether `recoveries` should count for defenders at all (§8) — tested here, found inconclusive, and explicitly not recommended for implementation without a larger sample.

## 2. Current Methodology (as of this document, verified against live code)

`lib/analytics/scoring/provisional.ts`:

```
Defence (GKP/DEF) = (individual_signal_percentile × 0.7 + clean_sheet_percentile × 0.3) / 10
Defence (MID/FWD) = individual_signal_percentile / 10   (no team component)

individual_signal = defensiveActions per-90 (DEF/MID/FWD) or saves per-90 (GKP)
Overall (DEF)      = attack×0.15 + creation×0.15 + defence×0.45 + impact×0.25
```

`INDIVIDUAL_DEFENCE_WEIGHT`/`TEAM_CLEAN_SHEET_WEIGHT` are explicit, named, exported constants (see the two prior documents for the full change record). This document does not revisit whether 0.7/0.3 is correct in isolation — that was tested extensively in the prior audit. It asks the different question this task poses: **is the underlying concept of "defensive performance" this model measures adequate at all**, independent of the exact weighting.

## 3. Lacroix Forensic Analysis (traced end-to-end, current production code)

| Stage | Value |
|---|---|
| Raw: minutes | 90 (started) |
| Raw: tackles | 5 |
| Raw: clearances/blocks/interceptions | 7 |
| Raw: recoveries | 2 |
| Raw: `defensiveActions` (= tackles + CBI, confirmed exact for DEF) | 12 |
| Raw: assists | 1 (xA 0.20) |
| Raw: clean sheet | No — Chelsea conceded 2 |
| Individual signal percentile (defensiveActions/90, among 87 DEF) | 88th |
| Clean-sheet percentile (tied block, non-clean-sheet defenders) | 35th |
| **Defence** = (88×0.7 + 35×0.3)/10 | **7.3** ("Very good") |
| **Creation** = percentile(assists/90, xA/90), league-wide | **8.8** ("Excellent") |
| **Impact** = percentile(bps/90), league-wide | **7.4** ("Very good") |
| **Attack** = percentile(goals/90, xG/90), league-wide | **3.3** ("Below average" — expected; he didn't shoot) |
| **Overall** = 3.3×.15 + 8.8×.15 + 7.3×.45 + 7.4×.25 | **6.9** ("Good", 0.1 short of "Very good") |
| Archetype | Attacking Defender (unchanged by this investigation) |
| Comparison: only DEF in GW1 with high defensive activity (≥70th pct) *and* an assist | **Lacroix is the sole example** (§6, category 5) |

**Answering the question directly, without defaulting to "clean sheet weighting" (already tested and already addressed):**

An informed fan watching this match sees things the data genuinely cannot represent:
1. **Whether Lacroix was personally at fault for either of Chelsea's two conceded goals.** FPL's data tells us the team conceded twice; it does not and cannot tell us which player(s), if any, were individually responsible. The model's clean-sheet term (now only 30% of Defence) is a *blunt proxy* for "did the defence do its job," applied identically to every defender on the pitch regardless of whether they were near either goal. This is not a weighting problem — it is a genuine absence of individual-attribution data for goals conceded, and no re-weighting of an aggregate team statistic can fix it.
2. **The quality/danger level of his 12 defensive actions.** A last-ditch tackle stopping a clear chance and a routine sideways clearance both count as "1 defensive action." FPL has no shot-danger-weighted defensive-action data.
3. **Off-the-ball defensive positioning and duels** — not measurable from this data source at all (§5).

None of these are new discoveries beyond the original audit — but the question explicitly asked *not* to settle for "clean sheet weighting" as the answer, and the honest answer is: **the specific things a fan credits Lacroix for beyond what's already captured are largely things this data source structurally cannot see, not things the formula is weighting wrong.**

## 4. Data Availability Audit — every field, freshly re-verified

Re-fetched both FPL endpoints live during this investigation (not assumed from the prior audit) to build a complete, current inventory.

**Fixtures endpoint** (`/fixtures/?event=N`) — per-fixture event stats, identifiers actually present:

| Identifier | Used? | Where |
|---|---|---|
| `goals_scored`, `assists`, `yellow_cards`, `red_cards`, `saves`, `bonus`, `bps` | ✅ Yes | `ingestFixtures.ts` → `goals`/`assists`/`yellowCards`/`redCards`/`saves`/`bonus`/`bps` |
| `defensive_contribution` | ❌ Not from here (a fuller version comes from the live endpoint instead) | — |
| `own_goals` | ❌ **Not captured anywhere in the pipeline** | — |
| `penalties_missed` | ❌ **Not captured anywhere** | — |
| `penalties_saved` | ❌ **Not captured anywhere** | — |

**Live gameweek endpoint** (`/event/N/live/`) — per-player stats:

| Field | Used? | Where |
|---|---|---|
| `minutes`, `starts`, `expected_goals`, `expected_assists`, `expected_goals_conceded` | ✅ Yes | `ingestGameweekStats.ts` |
| `defensive_contribution`, `tackles`, `clearances_blocks_interceptions`, `recoveries` | ✅ Yes (as of the prior enrichment) | `ingestGameweekStats.ts` → `defensiveActions`/`tackles`/`clearancesBlocksInterceptions`/`recoveries` |
| `ict_index` | Captured, but **deliberately unused in scoring** (documented: reports as 0 until FPL finalizes a gameweek) | Stored, not read by `provisional.ts` |
| `goals_scored`, `assists`, `clean_sheets`, `goals_conceded`, `yellow_cards`, `red_cards`, `saves`, `bonus`, `bps` | Duplicates of the fixtures-endpoint values already captured — not re-read here (fine; not a gap) | — |
| `clean_sheets` (FPL's own field) | ❌ **Not read** — we compute our own clean-sheet flag from match scores + a 60-minute convention instead | `ingestGameweekStats.ts`'s `cleanSheet` calculation |
| `goals_conceded` (FPL's own per-player field) | ❌ **Not read** — computed independently from match scores | Same |
| `influence`, `creativity`, `threat` | ❌ **Not captured anywhere, not used anywhere** — new finding this pass | — |
| `expected_goal_involvements` | Not captured — redundant with xG+xA already stored separately | — |
| `own_goals`, `penalties_saved`, `penalties_missed` | ❌ **Not captured here either** — genuinely missing from the entire pipeline | — |
| `total_points`, `in_dreamteam`, `played` | Not captured — FPL fantasy-game artifacts, not football-performance signals | — |

**What this means concretely:**
- `own_goals`, `penalties_saved`, `penalties_missed` are genuinely available (confirmed via a live fetch) and captured nowhere. None of these would have changed Lacroix's case (he didn't have any), but they represent real, free, already-legitimate data currently discarded — flagged for a future, separate, low-priority pass; not touched here since it's out of this investigation's scope.
- `influence`/`creativity`/`threat` are FPL's own proprietary weighted sub-indices (components of `ict_index`) — genuinely unused, but they carry the same finalization-lag risk documented for `ict_index` itself, and are opaque (FPL doesn't publish their exact formula), so they're not a clean addition even though "available."
- **Nothing found in this pass suggests we are missing a clean, currently-available field that would resolve the Lacroix gap.** The relevant components (tackles, CBI, recoveries, assists, minutes, clean sheet) were all already in use before this investigation started.

## 5. Real-World Anomaly Analysis

Ran the full requested category sweep (`scripts/audit-defence-methodology.ts` §7) against real GW1 data, current production scores (post-70/30):

**1. High defensive activity + team conceded (11 found)** — O'Shea (Def 7.9), Richards (7.8), Senesi (7.8), Acheampong (7.6), Thiaw (7.6), Murillo (7.5) all now score "Very good" Defence despite their teams conceding — the exact pattern the 70/30 change was built to fix, working across the board, not just for Lacroix.

**2. Low defensive activity + clean sheet (7 found)** — Dunk (Def 2.5), Coyle (3.3), Bogle (3.0), Collins (3.0) all now correctly land in "Below average"/"Average" territory despite their team's clean sheet — confirms the reverse fix also holds broadly.

**3. High activity + clean sheet — aligned, correctly excellent (4 found)** — Egan (9.4), Mendy (9.9), Bijol (8.6), Justin (8.6). No issues.

**4. Low activity + conceded — aligned, correctly poor (15 found)** — Heaven (1.1), Frimpong (1.1), Lindelöf (1.6). No issues.

**5. High activity + assist — Lacroix is the *only* example in the entire dataset.** Worth stating plainly: there is no other case to generalise from here yet. His profile (defended actively *and* created) is genuinely rare in this gameweek, which is itself part of why it reads as a standout performance to a fan even though the aggregate numbers alone (7.3 Defence, 6.9 Overall) look merely "good."

**6. High activity + goal (2 found)** — Mendy (9.9 Defence, scored, clean sheet), Ajayi (8.6 Defence, scored, clean sheet). Both correctly rated highly — no conflict, since these also have clean sheets.

**7. High activity + card (3 found)** — Silva (Def 7.4, Overall only 4.7 — a card plus his team conceding twice drags Overall down despite good individual defensive activity — a plausible combination, not obviously wrong), Virgil (Def 7.0, Overall 5.3), Ballard (Def 6.1, Overall 4.1). No clear anomaly — a yellow card recorded alongside decent defensive activity but a losing scoreline producing a modest Overall is a defensible reading.

**8. Very low activity + high overall Match Rating — zero found.** The model does not currently reward anyone for doing nothing defensively. Reassuring: no evidence of the model "hallucinating" a strong overall performance from weak defensive involvement.

**9. Very high activity + low overall Match Rating (1 found) — Thiaw:** Def 7.6 ("Very good", correctly reflecting heavy defensive activity), but Impact only 0.7 and Overall only 4.5. This is Defence and Overall correctly diverging, not conflicting — a player can defend actively but contribute little else to a losing performance (his BPS was evidently very low that match). Not treated as an anomaly; Overall is explicitly a *blend*, not a Defence score by another name, and this is what that design is supposed to do.

**10. DEF: high Creation, unexpectedly low Defence (3 found)** — Castagne (2 assists, Def 4.0), Maguire (Creation 7.1, Def 2.4). Both are plausible "bombed forward, left gaps" profiles — not an obvious contradiction of football reality.

**11. High Defence despite very low individual activity — zero found.** Directly validates that the already-implemented 70/30 change eliminated this specific failure mode at the ≥7/≤25th-percentile threshold tested — the "free ride" case (§7.2's players) all land well below 7.0, not artificially propped up.

**12. Players within 0.3 of an archetype threshold** — 17 defenders currently sit close enough to the archetype `LOW` (4.0) or `ELEVATED` (5.5) boundary that a single subsequent gameweek's data could flip their labelled archetype (e.g. Mosquera 5.30, Dasilva 4.00, Vuskovic 3.80). This is not a defect — archetypes are explicitly labelled "Early profile" at this sample size specifically because of this instability — but it's a concrete, quantified confirmation of how provisional these labels still are, worth keeping in mind for any future archetype-related work.

## 6. What the Current Model Gets Right

- Position-relative Defence cohorts (a DEF never compared to a MID/FWD) — sound design, unchanged and unchallenged by this investigation.
- The 70/30 weighting change has demonstrably fixed both directions of the original systemic issue at scale (§5, categories 1, 2, 11) — not just for Lacroix.
- Creation and Impact correctly and generously reward Lacroix's assist and overall contribution — these categories are not part of the problem.
- No case was found where the model rewards a genuinely empty defensive performance with a high score (§5.8) — a meaningful accuracy floor.
- Archetype classification for Lacroix ("Attacking Defender") is a fair, descriptive label given his real dimensions.

## 7. What It Gets Wrong (and What It Structurally Cannot Get Right)

**Cannot get right — permanent data-visibility boundary, not a formula defect:**
- Individual attribution for goals conceded (§3) — no source available to this project can currently provide "which player, if any, was at fault."
- Action quality/danger level — every defensive action counts equally regardless of the danger it prevented.
- Aerial duels, defensive positioning, marking quality, pressing success, tracking/recovery-run data — none of this exists in FPL's data, confirmed exhaustively in §4.

**A genuine, but modest, remaining gap:**
- Overall (6.9) sits just 0.1 below the "Very good" band for a case (Lacroix) that combines strong defence, an assist, and solid Impact — a fan reasonably reading "Good" as underselling a performance that's one rounding step from "Very good." This is real, but small, and — per §8 below — not something a further tested change actually fixes without cost elsewhere.

## 8. Candidate Methodologies — Tested

**A) Current 70/30 model** — baseline, described above. Already the product of the prior audit's own testing.

**B) Individual signal weighted even more heavily than 70/30** — not separately re-tested numerically in this pass (already explored in the prior audit's Candidate C sweep from 50/50 to 70/30 across the full range); this document's new evidence (§5.11: zero "free ride" cases already) suggests there isn't a live problem left at the top end of the weighting spectrum that would justify pushing further without more data.

**C) Component-based model using tackles/CBI/recoveries, avoiding double-counting** — tested directly as **Candidate E**: `individual_signal = (defensiveActions_percentile × 2 + recoveries_percentile) / 3`, correctly *not* double-counting (defensiveActions already excludes recoveries for DEF, confirmed in the prior audit and re-confirmed here), then blended at the live 70/30 ratio.

  **Result: Lacroix 7.3 → 5.74 (worse), Mendy 9.90 → 8.35 (worse), Egan 9.40 → 8.13 (worse), Virgil 7.00 → 7.11 (marginal improvement), Maguire/Shaw/Guéhi all improved by 1.0–1.4.** This candidate is a mixed bag with no clean directional win — and critically, it **does not help the motivating case** and **weakens two of the clearest correctly-rated cases in the dataset**. Recoveries is real, legitimate, non-double-counted information (§4 of the prior audit), but a naive equal-ish blend of it does not produce better football intelligence — it appears to reflect a different (and for these specific players, weaker) dimension of defensive involvement, and folding it in this way just adds noise to an already-reasonable signal.

**D) Separate individual performance from team defensive outcome conceptually** — already the direction of the current 70/30 model (§8 of the prior audit made exactly this case). No further separation was identified that doesn't require data this project doesn't have (§7 above).

**E) Other methodologies considered and not pursued:** using `influence`/`creativity`/`threat` as additional signals — rejected for now given their opacity and the same finalization-lag risk already documented for `ict_index`; using `own_goals` to penalise individual defenders — rejected because it would only ever apply to the rare player who scored one, not to defenders more broadly, and doesn't address the Lacroix-shaped question at all.

## 9. Comparative Results

| Player | Live (70/30, current) | Candidate E (+recoveries) | Verdict |
|---|---|---|---|
| **Lacroix** | **7.30** | **5.74** | Worse under C |
| Mendy | 9.90 | 8.35 | Worse under C |
| Egan | 9.40 | 8.13 | Worse under C |
| Acheampong | 7.60 | 7.52 | ~Neutral |
| Virgil | 7.00 | 7.11 | Marginal improvement |
| Guéhi | 2.40 | 3.52 | Improved (but was already a defensible low score — see §5.10) |
| Maguire | 2.40 | 3.82 | Improved (same caveat) |
| Shaw | 2.40 | 2.98 | Improved (same caveat) |
| Castagne | 4.00 | 4.55 | Marginal improvement |

No candidate tested moves every case in a defensible direction. This is reported plainly rather than picking whichever candidate happens to flatter Lacroix.

## 10. Recommended Methodology

**Do not change the Defence formula again right now.** Keep the current 70/30 weighting exactly as implemented. The evidence in this document does not identify a superior, generalisable alternative — Candidate E (the most concrete, best-motivated alternative available from current data) actively makes the motivating case worse while helping some others, which is precisely the kind of trade-off the brief warned against accepting without scrutiny.

This is not a "no action" conclusion by default — it's a conclusion reached *because* the honest test of the most promising available lever (recoveries) failed to clear the bar this investigation itself set: "produces more defensible football intelligence across the broader dataset," not just for one player.

## 11. Risks and Limitations

- **Single-gameweek sample.** Every number in this document, like the prior audit, comes from GW1 alone. Candidate E's mixed results could look different with more data — this document recommends *not deciding* based on one gameweek's noise in either direction, which cuts against implementing Candidate E now just as much as it cut against reweighting further.
- **`recoveries` at low minutes.** Several of Candidate E's biggest swings involve short-appearance players; per-90 extrapolation is noisier at low minutes, a risk already flagged for the rejected Candidate D in the prior audit and reconfirmed here for a different but related candidate.
- **The permanent data ceiling (§7) will not close** with more gameweeks — no amount of additional FPL data will ever answer "was Lacroix at fault for either goal." Any future user expectation that the model should reflect that specific judgement needs to be met with product framing (e.g. explicitly telling users what the score can and cannot see), not a data or formula change.

## 12. Validation Plan for Future Gameweeks

1. Re-run `scripts/audit-defence-methodology.ts` (§7/§8 in particular) once GW2+ exists. Specifically re-check whether Candidate E's Mendy/Egan/Lacroix pattern holds at a larger sample, or was a GW1-specific artefact.
2. Watch category 5 (high activity + assist) — GW1 had exactly one example (Lacroix). A larger sample will show whether his Overall (6.9, just under "Very good") is typical for this profile or an outlier worth revisiting.
3. Track the 17 near-archetype-threshold defenders from §5.12 — confirm archetype labels stabilise sensibly as more data arrives rather than flickering.
4. If a future audit revisits `recoveries`, test weighting it *lower* than a naive equal share (e.g. 15–20% of the individual signal rather than ~33%) before concluding it can't work — this document tested one specific blend and found it wanting, not every possible blend.
