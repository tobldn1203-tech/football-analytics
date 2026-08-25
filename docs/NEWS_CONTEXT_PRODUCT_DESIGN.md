# News/Context Product Design — Phase B Investigation

**Status:** Design and architecture investigation only. No UI, scoring, or intelligence methodology was changed to produce this document. The News Layer data foundation (`docs/NEWS_LAYER_RESEARCH.md`) is unmodified and remains as-is.

**Decision this document responds to:** the previously-proposed generic "Recent Context" player-page news section has been explicitly rejected as insufficiently compelling. This document investigates what *would* be — using the same data, but asking where it changes the user's understanding rather than just adding a list.

Every number below comes from querying the live production database and calling existing repository functions during this investigation, not from assumption.

---

## 1. Current Capability

What the app actually knows, precisely:

- **`Player.status`** — a live-updated single-character code (`a` available, `i` injured, `s` suspended, `d` doubtful, `u` unavailable) on every player row, refreshed on every ingestion run. This is the **current state**, always present, requiring no join.
- **`NewsItem`** — the explanatory/historical layer: a timestamped, categorized note (injury/suspension/transfer/availability/general) with exact player attribution. Currently 119 rows, one per non-available player, each with a real, specific, current-season description (e.g. "Groin injury - Unknown return date", "Has joined Paris Saint-Germain permanently").
- **Not currently persisted, but present in the same already-fetched payload:** `chance_of_playing_next_round` — a numeric percentage (0/25/50/75/100-style) FPL itself assigns. Confirmed live: 157 players currently carry a non-null value. This is a **more precise, already-structured signal than parsing the English `news` text**, and is flagged in §9 as a strong near-term addition — not implemented here, per this task's scope.

## 2. Data Quality Assessment

Checked directly against the live database, not assumed:

| Question | Finding |
|---|---|
| Does every unavailable player have a news item? | **Yes — 119/119.** Perfect correspondence right now. |
| Any player with contradictory or duplicate news rows? | **None found yet** — every player currently has exactly one `NewsItem`. This is expected: it's the first ingestion. The dedup design (§7 of the research doc) will accumulate real history as statuses change over the season, and **the intelligence rules below are written for that future state, not just today's clean snapshot.** |
| Any stale news for a now-available player? | **None found yet**, same reason. |
| Is status evenly distributed, or does it cluster? | **Highly uneven.** Hull City currently has 16 unavailable players; Tottenham 10; Brighton and Liverpool 9 each; several clubs have 2–3. This unevenness is itself a real, useful signal (§3). |
| How much of this data concerns players who actually matter to the product's existing intelligence? | **Very little, by raw count.** Of 119 unavailable players, only **6** have a computed season Performance score at all (≥45 minutes played in GW1) — the other 113 are fringe/loan/youth squad players who were never going to appear in Discover, Team Intelligence, or a Match Rating anyway. This is the single most important finding in this document — see §3. |

**Conclusion:** the data is clean, current, and reliable for what it is — but by itself, mostly not *interesting*. Its value is almost entirely conditional on being filtered through the app's existing intelligence (who has actually shown up in the numbers), not shown as a raw list.

## 3. Product Opportunities, Ranked

**1. Player page — availability status alongside Performance (highest-leverage, lowest cost).** Directly answers the brief's own question: *"A player has strong performance data but is currently unavailable — should the page make that obvious?"* Yes, and cheaply — `Player.status` is already a live field, needs no aggregation, no importance-ranking, no judgment calls. A single, unambiguous status indicator sitting next to the Performance score costs almost nothing in UI weight and closes a real gap (right now, a player's page gives no indication at all that they haven't played in weeks because they're injured).

**2. My Football — "Worth knowing about `<club>`" (highest ceiling, moderate cost).** The user's own instinct is well-supported by the data: filtering a club's unavailable list through their *existing computed Performance score* turns a noisy 16-name list (Hull) into a short, genuinely notable one. Confirmed live: Hull's Ajayi (Overall 8.2, GW1) and Mendy (Overall 8.7, GW1 — the gameweek's *best-rated defender across the whole league*, see `docs/DEFENCE_WEIGHTING_EXPERIMENT.md`) are both currently "doubtful." That is a real, interesting, non-invented fact a Hull supporter would want surfaced — "your two best performers from the weekend are doubtful" is a materially different, more useful statement than "16 players are unavailable."

**3. Team Intelligence — "Availability Watch" (real value, best built after #1 and #2 prove the pattern).** The same importance-filtered logic as My Football, generalized to any team's page. Natural, but should reuse rather than duplicate the underlying rule from #2.

**4. Discover — a filtered category, e.g. "Players to watch return" (plausible, not urgent).** Availability alone isn't a strong Discover axis on its own; more valuable once combined with Form/Momentum (see §8) — deferred, not rejected.

**5. Homepage (low priority right now).** Only worth a homepage slot once My Football's personalised version exists and proves valuable — a generic homepage availability panel would just be noise for a user with no supported club.

**6. Match Centre (see §4 — not recommended without a real data-model change).**

## 4. Product Opportunities We Should NOT Build

**A generic "Recent Context" list of all 119 status items anywhere.** Already rejected by the user, and the data confirms why: 113 of 119 concern players with no computed relevance to anything else in the app. A raw list is noise, not intelligence.

**Match Centre "missing key players" for a specific match.** This is the one idea in the brief that runs into a genuine data-model gap, not just a taste judgement: **we only store a player's *current* status, not their status *as of a specific past match*.** Showing today's "currently unavailable" flag next to a match played last week would misattribute a player's *current* injury as if it explained *that* match's result — factually wrong, and exactly the kind of "this caused the loss" fabrication the brief explicitly forbids. This would require snapshotting availability at kickoff time, which doesn't exist and is out of scope here. **Recommendation: do not build Match Centre availability integration until/unless a real historical-snapshot mechanism exists.**

**Any "key player importance" score invented specifically for this feature.** The brief explicitly warned against this, and it's unnecessary — the existing season Performance score and minutes-played are already legitimate, already-computed importance proxies. No new concept is needed, and building one anyway would be exactly the kind of parallel, uncoordinated "intelligence" the whole project has consistently avoided.

**Tactical inference of any kind** ("this weakens the midfield", "this explains the recent dip in Form"). Nothing in the current data supports that class of claim — it would be fabrication, explicitly forbidden.

**Using this data to explain away a Player Intelligence score** (e.g. "his rating is low because he's been carrying an injury"). Explicitly out of scope per this task's own instruction — Player Intelligence accuracy is a separate, already-concluded investigation, and availability must never be used to retroactively justify or adjust an existing score.

**Cross-referencing chance-of-playing percentages into a numeric prediction** ("70% likely to start"). FPL's number is *their* editorial estimate for fantasy-selection purposes, not ours to launder into a confident-sounding app-native statistic — if surfaced, it must be shown as *their* figure, attributed, not restated as our own.

## 5. Recommended Experience

**Build the player-level availability indicator first (§3, opportunity #1) — a small, factual status signal placed directly beside the existing Performance display on the player page, not a news section.**

- **Where it lives:** the player page header, immediately adjacent to the existing Performance score display (`app/players/[slug]/page.tsx`) — the exact place a user is already looking for "how good is this player," extended to also answer "can I expect to see them play."
- **What the user sees:** a short, factual status label (see §7 for the exact vocabulary) — e.g. "Suspended", "Injured — updated 2 days ago", "Recently joined Paris Saint-Germain" — never a list, never a headline, never more than one line.
- **When it appears:** only when `Player.status !== "a"`. For the ~80% of players with no current issue, nothing renders — no "Available ✓" clutter, no empty state box. Silence is the correct default.
- **When it doesn't appear:** available players (the majority); and — per §7's freshness rule — a status whose underlying note has gone stale beyond a defined window without being refreshed by ingestion (extremely unlikely in practice, since ingestion runs daily and FPL's own status/news fields are themselves kept current, but the rule exists so the UI never presents month-old text as if it were today's situation).
- **What problem it solves:** right now, a fan looking at a player's Performance/Form/Archetype has no idea whether that player is even currently selectable — a genuinely confusing gap for anyone using this page the way it's meant to be used (deciding "should I be excited about this player right now").

This is deliberately the *smaller* of the two strong candidates (vs. My Football's club-level view), because it is the shared primitive the club-level view depends on — see §10.

## 6. Example UX (real current-season data, nothing invented)

**Player example — Ajayi (Hull City):**
```
Ajayi
Hull City · Defender

Performance   8.2   Excellent

⚠ Doubtful — thigh injury, 75% chance of playing (FPL, updated 15 Aug)
```
Real data: `Overall 8.2` from GW1 (Ajayi was one of Hull's best performers, per the defence-weighting work), status `d`, news "Thigh injury - 75% chance of playing", `news_added` 2026-08-15. Nothing here is invented — every word traces to a stored field.

**Team example — Hull City (Team Intelligence, §3 opportunity #3, not built yet but designed the same way):**
```
Availability watch
Mendy (8.7 Overall) — doubtful
Ajayi (8.2 Overall) — doubtful

+ 14 further changes to the squad this week
```
The two names shown are the ones with a real, computed reason to matter; the other 14 (loanees, youth players with no minutes) are acknowledged in count only, never listed by name — precisely to avoid the noise problem identified in §2/§4.

**My Football example — a supported Hull City fan:**
```
MY FOOTBALL
Hull City

Worth knowing: your two best performers from the weekend, Mendy and
Ajayi, are both currently doubtful.
```
This is the single strongest, most concrete example in this document — a real, personalised, non-obvious, accurately-sourced statement that couldn't have been made before this data existed, and that a genuine fan would want to know.

## 7. Intelligence Rules

Defined precisely, so implementation has no ambiguity to improvise around:

- **What counts as "currently unavailable"?** `Player.status !== "a"`. This field is refreshed on every daily ingestion run directly from FPL, so it is always "as of the last successful ingestion" — no separate freshness check is needed for the status itself.
- **How recent must the explanatory news item be?** The status field is authoritative; the *news text* is explanatory context. If the most recent `NewsItem` for a player is more than **14 days** old relative to the current date, show the status alone ("Currently unavailable") **without** the stale explanatory text, rather than presenting an old note as current. (14 days is a judgement call, not a finding — chosen because it comfortably covers FPL's normal weekly update cadence while catching genuinely abandoned/stale notes; revisit once real staleness cases are observed.)
- **Multiple updates for the same player?** Always take the single most recent `NewsItem` by `publishedAt` for display. Older rows remain in the database as history (never deleted) but are not shown in this feature — a future "how has this situation evolved" view could use them, but that's out of scope here.
- **Contradictory updates?** Not currently observable (§2), but the rule for when it happens: `Player.status` (freshest, single source of truth for the *current* state) always wins over any interpretation of older `NewsItem` text. If a `NewsItem`'s description seems to contradict the current `status` code (e.g. a stale "doubtful" note lingering after a player returns to `status: "a"`), the status code wins and the note is not shown at all — this is exactly the §7 freshness/availability-flip case, resolved the same way.
- **Confirmed status vs. ambiguous wording?** Only FPL's own structured fields are treated as fact: `status` (a controlled enum) and `chance_of_playing_next_round` (a number, once persisted — see §9) are confirmed. The free-text `news` field is displayed verbatim, attributed to FPL, and never re-interpreted, upgraded into a stronger claim, or paraphrased into more confident language than the source itself uses. "Unknown return date" stays "unknown" — never converted to an estimate.
- **How do we avoid showing stale information generally?** Two independent checks, both required: (1) the ingestion pipeline must have run recently (already guaranteed by the existing daily cron — not a new requirement); (2) the 14-day explanatory-text rule above. Both must pass for the fuller "status + reason" view; the bare status alone can still show even if only (1) passes.

## 8. Relationship With Existing Intelligence

**Strictly additive — verified against every system named in the brief:**

| System | Relationship |
|---|---|
| Performance / Overall | Unchanged. Availability is displayed *beside* it, never blended into it. |
| Form / Momentum / Consistency | Unchanged. These continue to be computed purely from match performance data, exactly as today. |
| Match Rating | Unchanged — and, per §4, deliberately *not* extended into Match Centre in this phase, specifically to avoid implying availability explains a past result. |
| Archetypes | Unchanged. |
| Team Intelligence | Additive only (§3 opportunity #3) — a new, separate "Availability watch" section, not a modification of the Defence/Attack/Creation/Impact blend or the Team Story text. |
| Discover | Not touched in this phase (§3 opportunity #4, deferred). |

**The one relationship worth naming explicitly, because it's a *use* of existing intelligence rather than a change to it:** the "importance filter" in §3/§6 reads the already-computed `RankedPlayer.scores.overall` and `sample.minutes` — exactly as Discover, Team Intelligence, and the homepage already do — as a read-only input to decide *which* availability facts are worth surfacing. It does not write back to, weight, or influence those scores in any way. This is the same "reuse, don't reinvent" pattern already established for Team Intelligence's synthetic `RankedPlayer` and the nationality flags' identity pass-through fields.

## 9. Future Architecture

The `NewsItem` model (see `docs/NEWS_LAYER_RESEARCH.md`) was deliberately built generic rather than FPL-specific for exactly this reason. Concretely, for a future licensed source to slot in without a rewrite:

- `provider` already distinguishes source (`"fpl"` today; `"guardian"` or similar tomorrow) — nothing keyed to "FPL" is hardcoded into the shape, only into Phase 1's *ingestion* code.
- `category` already anticipates categories no current source populates (the model doesn't restrict which provider can write which category) — a licensed source could contribute `injury`/`transfer` too, or genuinely new categories like `manager` or `press-conference` the brief listed, without a schema change.
- `url`/`imageUrl` are already nullable specifically because FPL's notes have neither — a future editorial source would simply populate them, no migration needed.
- `playerId`/`teamId`/`matchId` associations are already independent and optional — a future source's entity-matching problem (ambiguous names, per the original News Layer brief) is exactly why these are separate nullable columns rather than a required single "subject" field; a low-confidence match can simply leave all three null and still be stored, un-surfaced, until a matching improvement is made.

**One concrete near-term addition flagged, not implemented here:** persist `chance_of_playing_next_round` on `Player` (a single nullable `Int?` column, mirroring the pattern already used for the defensive-action components). It's a cleaner, already-numeric signal than parsing `news` text, confirmed present for 157 players right now. This would strengthen §7's rules considerably (e.g. "back in contention" could mean "`chance_of_playing_next_round` rose from ≤25 to ≥75 between two consecutive ingestion runs" — a precise, factual, non-inferred definition) but is a real, if small, schema/ingestion change and is explicitly left for a future phase per this task's "design only" scope.

## 10. Recommended Implementation Phases

- **Phase A — foundation (complete).** FPL news/status ingestion, `NewsItem` model, idempotent, daily cron. Unchanged by this document.
- **Phase B — the player-level availability primitive (recommended next).** One small repository function (e.g. `getPlayerAvailability(playerId)` — reads `Player.status` + the most recent non-stale `NewsItem`, applies §7's rules, returns a small typed result or `null`), and one small UI element consuming it on the player page (§5, §6). No other page touched. This is intentionally the smallest unit that's genuinely useful on its own.
- **Phase C — team/My Football integration.** Reuses Phase B's exact repository function against every player on a squad, adds the §3/§6 importance filter (existing Performance/minutes data, no new concept), surfaces "Availability watch" on Team Intelligence and "Worth knowing about `<club>`" in My Football. No new data model work — purely composing Phase B's primitive across a squad.
- **Phase D — `chance_of_playing_next_round` persistence (§9).** A small, additive schema/ingestion change once Phase B/C are live and the team has real usage evidence for whether the finer-grained signal is worth the extra field.
- **Phase E — licensed editorial layer, if ever funded.** Guardian Open Platform's commercial tier (per `docs/NEWS_LAYER_RESEARCH.md` §7) or an equivalent, contributing real journalism (`category: "manager" | "press-conference" | "match-report"` etc.) into the same `NewsItem` model established in Phase A. A business decision, not a technical one — no code changes anticipated beyond a new provider-specific ingestion module, per §9's architecture.

---

## Recommendation

**Build Phase B: a single, factual player-availability indicator on the player page, driven by a new `getPlayerAvailability()` repository function.** It is the smallest change that is unambiguously useful (closes a real, confirmed gap — a player's page currently gives no indication they're unavailable), costs almost nothing in UI weight (renders nothing for ~80% of players), requires no new "importance" judgement calls, and is the exact primitive Phase C (the higher-ceiling My Football/Team Intelligence experience the user is most excited about) will need anyway. Building the club-level experience first without this primitive would mean building it twice.

**Waiting, as instructed, for approval before writing any implementation code.**
