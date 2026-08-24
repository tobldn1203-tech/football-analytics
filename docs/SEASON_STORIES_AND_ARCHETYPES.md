# Season Stories & Player Archetypes — v0

**Date:** 2026-08-24. Built end-to-end in one pass, validated against real live data
(current 2026/27 Premier League season — **1 completed gameweek**, not 10; every
player in the database is at "Limited" confidence except where individually noted).
Nothing here modifies season scoring formulas, FPL ingestion, the Match Centre, or
Match Rating — this is a new read layer on top of data that already existed.

## What was built

- **`lib/analytics/story/seasonStory.ts`** — `buildSeasonStory()`, a deterministic,
  templated narrative paragraph (never an LLM) over `RankedPlayer` + `PlayerIntelligence`,
  confidence-gated into the three tiers the brief specified (Limited/Developing/
  Established → "Early signs…" / "…beginning to show…" / "…consistently show…").
  Deliberately pronoun-free (repeats the player's name) — no gender data exists for
  any player in this app.
- **`lib/analytics/archetypes/archetypes.ts`** — `classifyArchetype()`, a position-aware
  shape classifier over the existing Attack/Creation/Defence category scores (Impact
  and Progression deliberately excluded from the naming logic — see in-file comments
  for why). Reuses the existing confidence system unchanged; never invents a second one.
- **`components/players/season-story.tsx`**, **`components/players/archetype-card.tsx`**
  — the UI, replacing the two "Coming soon" placeholders that previously sat at the
  bottom of the player page.
- Player page reordered: hero (with a new archetype pill) → **Season Story** (narrative,
  supporting metrics, Performance Journey, What Stands Out, Best Performances) →
  **Player Profile** (archetype card) → Analytical breakdown → Recent matches →
  Key moments (untouched "Soon" panel — out of scope this phase, per instruction).
- `pickBestPerformances()` now ranks by the real Match Rating first (falls back to
  the old event-based heuristic only for the rare unrated match) — "Best Performances"
  now means what it says, using the same methodology the Match Centre already shows.
- 23 new unit tests (`archetypes.test.ts`, `seasonStory.test.ts`) — 86/86 passing.
  Type-check and production build both clean. Verified live at desktop and mobile
  widths across a midfielder, a defender, and a goalkeeper (including the "no
  archetype yet" fallback state) — zero console errors throughout.

## Why the archetype taxonomy is smaller than the brief's example list

Inspected the data before choosing labels, as instructed. Two hard constraints shaped
every decision:

- **`PositionCode` has exactly four values** (GKP/DEF/MID/FWD — confirmed in
  `prisma/schema.prisma` and `lib/competitions/premier-league.ts`). There is no
  centre-back/full-back distinction anywhere in the data, so **no flank-specific
  label is used** ("Attacking Full-Back" etc. would assert a sub-position this app
  cannot verify — a direct violation of Archetype Principle #4). Defender archetypes
  are named without reference to flank position.
- **No progression/passing data exists** (confirmed in `docs/DATA_SOURCES.md`), so
  "Ball Progressor" / "Deep Playmaker" — both dependent on progressive-pass data —
  are not implemented. "Pressing Forward" and "Ball-Winning Midfielder" **are**
  implemented, but only because the existing `defence` category score for
  midfielders/forwards is already built from tackles + interceptions + recoveries
  (`defenceMetricsForPosition` in `provisional.ts`) — a genuine, if imperfect, proxy
  for that kind of contribution. The UI copy for "Pressing Forward" says "a
  reasonable proxy for work-rate, not a literal pressing count" for exactly this
  reason.

Eleven archetypes were implemented across four positions (Shot-Stopper; Defensive
Anchor / Attacking Defender / All-Round Defender; Creative Hub / Box-to-Box / Goal
Threat / Ball-Winning Midfielder / All-Round Midfielder; Complete Forward / Creative
Forward / Goal Threat / Pressing Forward), plus an explicit, honestly-labelled
"Profile still taking shape" outcome for players whose data doesn't clear any
threshold — confirmed live on Rushworth (GKP, all categories below average).

## Discovery-readiness

Every `PlayerArchetype` carries its raw `dimensions` vector (`{attack, creation,
defence, impact}`, 0–10 each). That's the same shape a future "find players similar
to Ødegaard" feature would need to compare across players (e.g. cosine similarity
within a position group) — **the data model already supports this**; the search
UI/endpoint itself was deliberately not built, per the brief's "don't build the full
discovery system yet" instruction.

## Refinements worth considering later (not started)

- **Performance Journey is currently a single-point message for every player** —
  correctly honest given real data (1 gameweek), but nobody has actually seen the
  multi-point line render yet. Worth a manual re-check once gameweek 2 or 3 lands,
  in case the line/dot rendering needs a real second data point to reveal a layout
  issue that a single point can't expose.
- **`ArchetypeBadge` and the Season Story's stat-chip row were not tested against a
  very long player name** (e.g. a long hyphenated or accented name) at narrow mobile
  widths — the `truncate` classes should handle it, but wasn't verified against an
  actual long-name case.
- **The archetype thresholds (5.5 / 4.0) are the same constants already used
  elsewhere** (`STRENGTH_MIN`/`DEVELOPMENT_MAX` in `intelligence/strengths.ts`) —
  deliberately reused rather than tuned separately, but as more gameweeks of data
  accumulate this is worth revisiting empirically (are these thresholds actually
  producing a sensible, evenly-spread distribution of archetypes league-wide, or do
  most players cluster into 1–2 labels?) — not something a 1-gameweek sample can
  answer yet.
- **Season Story's momentum/consistency clauses will start firing for real** once
  players cross the 4-match / 3-match qualifying floors (`momentum.ts`,
  `consistency.ts`) — currently untestable against real data since nobody has played
  more than 1 match; the unit tests cover the logic, but a live re-check once real
  multi-match players exist is worth doing.
