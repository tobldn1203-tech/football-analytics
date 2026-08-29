# Player/Team Information Density Audit + Availability Watch 2.0

Investigation and design document, produced before any code changed. Covers both refinements requested: Availability Watch's depth, and Player/Team page information density.

---

## Part 1 — Availability Watch 2.0

### What data actually exists after Ingestion 2.0

Inspected `NewsItem`, `PlayerAvailability` (`lib/analytics/availability/`), and — critically — the **live FPL `news` text itself**, not assumptions about it. Ingestion 2.0 (the matchday-frequency work) added no new fields; the relevant data has been present since the original Player Availability Intelligence phase, but **Worth Knowing has never actually used the richest part of it** — it only reads `.category` and `.chanceOfPlayingNextRound`, discarding `.detail` (FPL's own verbatim text) entirely when building its headline.

Queried the live 2026/27 API directly (125 non-available players with news) and found FPL's `news` text is **extremely consistent and safely parseable**, not free-form prose:

| Status | Pattern (100% consistent across every entry checked) | Example |
|---|---|---|
| `i` (injured) | `"<Reason> injury - Unknown return date"` **or** `"<Reason> injury - Expected back <D Mon>"` | `"Hamstring injury - Expected back 11 Oct"` |
| `d` (doubtful) | `"<Reason> - <N>% chance of playing"` | `"Thigh injury - 75% chance of playing"` |
| `s` (suspended) | `"Suspended until <D Mon>"` (no dash — already one complete clause) | `"Suspended until 19 Sep"` |
| `u` (transfer) | `"Has joined <Club> permanently"` / `"...on loan for the rest of the season"` (no dash) | `"Has joined Paris Saint-Germain permanently"` |

**Genuine finding: some injuries carry a real, FPL-sourced expected return date** ("Expected back 11 Oct") — not invented, not estimated by us, exactly what the brief asked to look for ("An expected return date/gameweek/timeframe, IF the underlying data genuinely supports it"). Where it's absent, FPL itself says "Unknown return date" — that absence is itself real information and is shown as such, never filled in.

Every `i`/`d` entry checked has a dash separating **reason** from **timeframe**; every `s`/`u` entry has none (they're already one coherent clause). This split is a **structural fact about FPL's own templated text**, not an inference — reusing it is not "building a news parser" any more than reading `chance_of_playing_next_round` is; it's reading a second field FPL happens to encode inside one string instead of two.

### Design: SIGNAL → CONTEXT

- **SIGNAL** — the existing headline, unchanged (e.g. *"Two of Brighton's strongest performers this season are currently doubtful."*).
- **CONTEXT** — one new, optional, compact sentence naming up to the 2 most important affected players and their reason/timeframe, e.g. *"Hinshelwood is a doubt — unspecified injury · 25% chance of playing next match; Georginio is a doubt — unspecified injury · 75% chance of playing next match."* Built from real Brighton data, verified live.
- If no player's detail is fresh/present enough to extract anything, **CONTEXT is simply absent** — the existing concise headline is the whole insight, exactly the graceful fallback the brief asked for.

`chance_of_playing_next_round`'s own name already scopes it to "next round" — restating that as "next match" is a faithful restatement of the field's documented meaning (established in `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md` §2), not an inference. "Expected back 11 Oct" and "Suspended until 19 Sep" are shown verbatim. Nothing is ever converted into a gameweek number, a diagnosis, a severity claim, or a probability we didn't compute.

### Where this plugs in

**Extending the existing insight function, not a parallel system.** `buildWorthKnowingInsight()` gains one new field, `context: string | null`, built by a new small pure module (`lib/analytics/availability/describe.ts`) it already has everything it needs to call (`PlayerAvailability.detail`/`.category`). Team Intelligence's per-player rows (already showing name/position/score) get their secondary line upgraded from the bare status label ("Doubtful") to the same compact descriptor ("Unspecified injury · 75% chance of playing next match") — exactly the mockup requested. My Football's compact block gains the one extra context sentence beneath its existing headline. No new component tree, no new data model, no new query.

### Selectivity — unchanged

Still gated entirely by the existing `buildWorthKnowingInsight` tiers (reusing the "Good" quality threshold, the existing `sample.confidence` rule for superlative claims) — this phase only makes the SAME already-selected insight say more, never surfaces more players than before.

---

## Part 2 — Player Page Density Audit

### Section-by-section, with duplication flagged

| Section | Verdict |
|---|---|
| Hero (identity, big score, quality label, archetype badge, trend pill, consistency text, availability line, sample caveat) | Essential — the "who/how" anchor. Keep. |
| Season Story → **4-chip metric grid** (Season Performance / Recent Form / Momentum / Consistency) | **Duplicate.** Season Performance repeats the hero's big number verbatim. Momentum repeats the hero trend pill's arrow direction as a second, separate text label. Consistency repeats the hero's own consistency line word-for-word, pixels away. Only Recent Form's *numeric* score (the hero pill shows the label only, not the number) is genuinely new. |
| Season Story → narrative paragraph, appearance/goals/assists tiles, Performance Journey chart, What Stands Out, Best Performances | Essential, non-duplicated — the actual season narrative and its direct evidence. |
| Archetype Card → icon/label/qualifier/description | Essential identity content, not shown elsewhere. |
| Archetype Card → **Attack/Creation/Defence shape bars** | **Duplicate.** The exact same three numbers, re-plotted as a second, differently-styled mini bar-chart, immediately above the Analytical Breakdown section that already plots them properly (with quality labels). |
| Analytical Breakdown (Attack/Creation/Progression/Defence/Impact) | Essential, the one place these numbers should live. |
| Recent matches table, Key moments | Already compact/tabular; not a density problem. |

### Proposed hierarchy

1. Hero communicates WHO/HOW immediately (unchanged), enriched with the one genuinely-new number (Recent Form's score folded into the existing trend pill: *"Strong form · 8.2"* instead of a separate chip).
2. Season Story leads with interpretation, then goes straight to real evidence (appearances/goals/assists → journey → what stands out → best performances) — no redundant restatement of numbers the hero already gave.
3. Archetype Card becomes purely the "what kind of player is this" narrative — description only, no second chart.
4. Analytical Breakdown remains the single, canonical place for the four category scores.

Net effect: two full duplicate visualizations removed, zero underlying numbers lost — every one of them still appears exactly once, in its most appropriate place.

---

## Part 3 — Team Page Density Audit

### Section-by-section

| Section | Verdict |
|---|---|
| Hero (identity, standing, form strip, goals/GD/points) | Essential. Keep. |
| Team Overview → narrative paragraph | Essential, unique interpretation. |
| Team Overview → **"Strongest area" / "Area to watch" 2-box headline** | **Duplicate preview.** These are literally `strengths[0].label` / `developmentAreas[0].label` — the exact same array the very next sections render in full. |
| Performance Profile (all 4 categories, ranked, with quality labels + scores) | Essential — the one place these numbers should live. |
| **"What's working / Areas to watch"** (full strengths/developmentAreas lists, with scores) | **Duplicate.** The same `strengths`/`developmentAreas` arrays already summarised by Team Overview's headline, now shown a second time as a completely separate card, and largely re-describing rows the Performance Profile list directly above/below already ranks. |
| Performance journey chart + momentum | Essential, no overlap. |
| Players driving the team (5 player picks) | Essential — a genuinely different lens (which *player* is responsible), not a repeat of the team-level scores. Keep. |
| Match history, League position, Next fixture | Already reasonably compact; not the density problem. |

Three separate cards (Team Overview's headline, Performance Profile, What's Working/Areas to Watch) currently narrate the same four numbers from three angles within a few hundred pixels of each other — precisely the "four different analytics modules describing overlapping ideas" the brief named.

### Proposed hierarchy

Merge into one coherent section: **narrative paragraph → the single ranked Performance Profile list, with its top row tagged "Strongest area" and its lowest flagged row tagged "Area to watch" directly inline** (reusing the exact same `strengths`/`developmentAreas` output `detectStrengths` already produces — no new intelligence, just one fewer place it's redrawn). The standalone headline grid and the separate full-list card are retired as components; their information is not lost, it's annotated onto the list that was always the real evidence for it.

Availability Watch continues to sit right after this, unchanged in position — it's already the "what should I know right now" answer the brief asks the first screen to include.

---

## Data limitations (unchanged by this task)

- No expected-return date exists for suspensions beyond FPL's own "until \<date\>" text, and none at all for transfers (there's nothing to return from).
- Not every injury carries an "Expected back" date — most currently say "Unknown return date", and that's shown as exactly that, never guessed at.
- `chance_of_playing_next_round` only exists for `doubtful` status; it is never shown for injured/suspended players (always 0, so it's never informative there — unchanged rule from the original Player Availability Intelligence phase).

## Desktop/mobile

Every change here is a text/content change to already-responsive components (the hero pill, the existing card grids) — no new breakpoints needed. Verified in browser, both viewports, after implementation (see final report).

## Components reused vs. changed

- **Reused as-is:** `PlayerAvatar`, `NationalityFlag`, `TeamCrest`, `TeamIdentity`, `MatchTrend`, `TrendBadge`, `CategoryBar`, `getPlayerAvailabilityMap`, `buildWorthKnowingInsight`'s tier logic.
- **Extended:** `lib/analytics/availability/worthKnowing.ts` (new `context` field), `components/teams/team-worth-knowing.tsx` and `components/home/my-football-widget.tsx` (render the new field), `components/players/availability-indicator.tsx` (reuses the new shared formatter for consistent phrasing), `components/teams/team-performance-profile.tsx` (optional strength/watch tagging).
- **Simplified (content removed because it was a proven duplicate, not deleted from the product):** `components/players/season-story.tsx` (metric chip grid), `components/players/archetype-card.tsx` (shape bars), `components/teams/team-overview.tsx` (headline grid).
- **Retired (fully superseded by the merge above, functionality preserved elsewhere):** `components/teams/team-strengths.tsx`.
