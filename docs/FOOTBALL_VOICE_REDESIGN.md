# Football Voice — redesign notes

**Date:** 2026-08-24. Short by design — this replaces the v1 voice layer, not the
whole app. Research done via public descriptions/examples of the named accounts'
style (no scraping, no copied wording — see below).

## 1–3. What the research actually found (mechanism, not vocabulary)

**ThatGuysJokes** — the recurring shape is **"[subject] when [ironic reality]"** —
a real football fact paired with an unstated, implied conclusion the reader has to
complete themselves. E.g. a struggling player suddenly playing well specifically
because the cameras are on; an "interim manager" reacting to a permanent offer,
where the *audience* supplies the punchline (that club's job is a poisoned
chalice) — the tweet never states it. The comedy is entirely in the **omission**.

**No Context Football** — no punchline at all. A real clip/fact, presented
completely flat, with the absurdity coming from the **content itself**, not any
commentary wrapped around it. Deadpan to the point of having *no* joke framing
device whatsoever.

**The shared mechanism, stripped of both accounts' specific material:**
```
real event/stat → an ironic or absurd angle already latent in it → stated
(or half-stated) as flatly as possible, trusting the reader to get it
```
Never an adjective doing the work ("hilarious", "savage"). Never explained.
Often funnier the *less* it announces itself as a joke.

## 4. Why the v1 vocabulary-bank approach failed

v1 (`STANDOUT_WITH_CONTRIBUTION`, etc.) picked a **pre-written punchy phrase**
from a fixed list keyed only to score-tier, then rendered it as a giant
capitalised headline. Two failures, both structural, not just wording:

- **No juxtaposition.** A lookup table can't notice anything about *this*
  specific performance beyond "the number was high" — it can't surface an
  irony, because it isn't looking at the data for one. "Did the job and then
  some" isn't a joke; it's an intensifier. It reads like marketing copy trying
  to sound current, which is exactly the "AI trying desperately to be funny"
  failure mode being described.
- **Forced escalation.** Every standout got a capitalised "joke" regardless of
  whether the underlying match actually had anything ironic in it. A real
  system has to be allowed to say nothing.

## 5. Revised architecture

Three independent layers, kept as three separate files so future pages (Season
Stories, Discover, etc.) can reuse the machinery without the phrase content:

- **`lib/analytics/voice/mechanisms.ts`** — signal detectors. Each one looks at
  real data already computed elsewhere (Match Rating, category scores, cards,
  minutes, position) for one *specific, checkable* irony: a strong performance
  with a card anyway; a player's standout category not matching their position
  (an attacking midfielder rated the match's best *defender*); a substitute who
  outrated the starters; a routine rout with nothing else notable; a goalless
  or narrow game that still needed a pile of cards. Each detector returns a
  candidate or `null` — most of the time, most detectors return `null`, and
  that's correct, not a gap.
- **`lib/analytics/voice/phrasing.ts`** — template generators, one family per
  mechanism, each with several structurally-different variants (not
  find/replace on one fixed sentence) rendered in normal sentence case. A
  deterministic per-entity pick (same helper as before, kept because it's the
  right tool) avoids every match reading identically without ever being random
  between renders.
- **`lib/analytics/voice/orchestrator.ts`** — runs the detectors in priority
  order for a given subject (player or match), returns the first hit as Level
  3 with a humour intensity (`LIGHT`/`DRY`/`STRONG`, roughly "how unusual is
  this, statistically"), or falls through to Level 2 (natural, no-joke
  football language) or Level 1 (plain fact) when nothing fires. **`NO_HUMOUR`
  is a normal, common, correct outcome**, not an edge case to minimise.

Output shape everywhere: `{ level, observation, evidence }` — `evidence` is
always the flat factual sentence and is **always rendered**, regardless of
whether a joke fired. `observation` is the level-appropriate line sitting above
it. Humour is optional; the evidence line is not — this is what keeps the
credibility promise intact even when Level 3 is chosen.

**UI change to match:** no more capitalised quote-card headline. The voice line
renders as a normal-case sentence, same visual weight as the surrounding copy —
an observation sitting in the section, not a separate shouting element.

## What this session implements

Match Standout and Match Summary only, per the brief — wired to real match
data, several outputs below for judgement before touching anything else. The
mechanism/phrasing/orchestrator split is written so Season Stories etc. can
plug into `mechanisms.ts`/`orchestrator.ts` later without new architecture.

## Addendum — cultural concepts (2026-08-24)

A second research pass, prompted by a specific correction: some of the
strongest examples in this style of humour ("Good day for the
hate-watchers") aren't clever wording at all — they work because the
audience already shares a cultural CONCEPT (a hate-watch, an agenda, plot
armour, stocks rising/falling) and the situation happens to activate it.

**New layer:** `lib/analytics/voice/concepts.ts` catalogues ~20 such
concepts as *meanings*, not phrases — each with an honest note on what
context it would need to detect safely. `context.ts` defines the typed
slots (`SeasonBaseline`, `NarrativeTag`, `Reputation`) a detector reads
from; only `SeasonBaseline` is populated with real data today. This is the
explicit "room to grow into" asked for — wiring up e.g. HATE_WATCH later
means populating the `reputation` slot from a real source, not redesigning
anything.

**Two concepts actually implemented, both from data this app already has:**
- **PLOT_ARMOUR** — the winning side had the *lower* Team Performance
  rating of the two (a genuine "shouldn't have won that, statistically"
  signal, match-level, zero new data).
- **STOCKS_RISING / STOCKS_FALLING / AGENDA** — a match rating well above
  or below a player's own *established* (8+ match) season Performance
  baseline. This is the one mechanism that looks beyond the single match —
  reusing the same season score already shown on the player's own page.
  Gated on established confidence specifically so it can't fire off a thin
  sample; correctly produces nothing at all this early in a season, for
  every player, which is the honest outcome, not a bug.

The other ~17 concepts (AGENDA/PROPAGANDA's narrative-tracking need,
HATE_WATCH's reputation need, THE_ALLEGATIONS' news need, etc.) are
catalogued with their real data requirement and deliberately left
unimplemented — building those data sources is its own project, not a
humour-copy task.
