# News Layer — Product & Data Design

Investigation and product-design task only. No schema, ingestion, API, UI, scoring, Player/Team Intelligence, Discover, Match Centre, Season Story, personalisation, or voice code was changed to produce this document. One temporary read-only script queried the live database and was deleted immediately after; everything else below comes from reading current repository code and primary-source web research done today, both cited inline.

---

## 1. Product purpose

**What should a user learn from the News Layer that they cannot already learn from Player Intelligence, Team Intelligence, Match Centre, Season Stories, or Discover?**

Those five surfaces all answer variations of *"what does the data say happened?"* — a percentile-based Performance score, a Form/Momentum read, a Match Rating, a deterministic narrative built from real match statistics. None of them can answer *"why is this happening, or what's happening around it, that the numbers alone don't show?"* — a manager's public explanation for a tactical switch, confirmation of an injury timeline, a transfer that explains a sudden change in game time, a suspension explaining an absence. That gap — **stats-shaped intelligence vs. real-world context** — is the actual product job available here, and it's a real gap: today the app has no way to tell a user *why* something changed, only *that* it changed.

**Five candidate product jobs, ranked:**

1. **Explain a change the data already flagged.** Player Intelligence detects a Form/Momentum shift, an availability change, or a new archetype signal; News answers "is there a real-world reason for this?" — an injury return, a role change, a manager comment. **Strongest candidate** — it only ever activates alongside something the app already found statistically interesting, so it's additive by construction and never a stand-alone feed.
2. **Reduce surprise for a supported club.** A My Football user should not be blindsided by something everyone else already knows (a manager sacked, a big signing, a long-term injury) purely because they only check this app. Directly serves the existing personalisation model without expanding it.
3. **Add pre-match team-news context to Match Centre.** Genuinely valuable in principle (who's out, who's back) but collides hard with a real, already-discovered data limitation — see §9's Match Centre section. Weakest of the five on feasibility, not on merit.
4. **Surface transfer/availability changes for players already featured in Discover.** A nice-to-have layered onto an existing surface, not a reason to build the layer on its own.
5. **A general club news feed.** Explicitly the thing the user does not want, and the thing every other football app already does. Included here only to rule it out.

**Recommended primary job: #1 — News as context for intelligence the app already produces**, with #2 (My Football) as the natural first real user experience of it. This is explored fully in §9.

---

## 2. Current-state analysis

The app already has, and this design must not duplicate or compete with:

- **Player Intelligence** (`lib/analytics/scoring/`, `lib/analytics/intelligence/`) — percentile-based Attack/Creation/Defence/Impact/Overall, Form/Momentum/Consistency, confidence-gated by sample size.
- **Team Intelligence** (`lib/analytics/scoring/teamRepository.ts`) — the same scoring engine aggregated per club.
- **Match Rating / Match Centre** (`lib/analytics/scoring/matchRating.ts`, `matchRepository.ts`) — per-fixture ratings, squad breakdowns, deterministic match narratives.
- **Season Stories** (`lib/analytics/story/`) — deterministic per-player narrative text built only from real computed numbers.
- **Discover** (`lib/discover/`) — surfaces players/teams worth noticing.
- **Football Voice** (`lib/analytics/voice/`) — a concept-catalogue humour system (`concepts.ts`), detailed in §10.
- **Personalisation** (`lib/preferences/types.ts`) — exactly one stored preference, `supportedClubId` (plus a dismissed-prompt flag). No followed players, no browsing history, no style preferences. This constraint is treated as fixed throughout this document.
- **FPL ingestion** (`lib/ingestion/fpl/`), daily Vercel Cron (`vercel.json`, confirmed still once-daily — see `docs/PRODUCTION_DATA_PIPELINE_AUDIT.md`), Prisma Postgres.
- **`NewsItem` model** (added in the News Layer Phase 1 work) — already exists, already ingesting. Assessed fully in §3.
- No **`Manager`** entity exists anywhere in the schema. This matters a great deal for §6/§7 below — there is currently no deterministic way to attach a manager quote or manager-change story to anything more specific than a `Team`.

---

## 3. Existing FPL news capability — inspected today, not assumed

Read `lib/ingestion/fpl/ingestPlayerNews.ts` and the `NewsItem` Prisma model directly, then queried the live production database (616 players, current 2026/27 season, GW2 in progress) with a temporary script, deleted after use:

| Question | Finding |
|---|---|
| What is stored? | One `NewsItem` per player-status-change, with `category` (injury/suspension/transfer/availability/general — derived **only** from FPL's own `status` code, never by parsing the `news` text for keywords), `title` (synthesized from category, since FPL provides no headline), `description` (FPL's `news` text verbatim), `publishedAt` (FPL's `news_added`), `sourceName: "Fantasy Premier League"`. |
| How is history retained? | Every distinct `news_added` timestamp creates a new row (`externalId = playerId-news_added`) rather than overwriting — old rows are kept, not deleted. |
| How are duplicates handled? | An unchanged `news_added` re-ingests into the same row (upsert on `(provider, externalId)`) — verified: **0 of 131 current players with any news have more than one `NewsItem` row**, since no status has been updated a second time yet this season. |
| Are timestamps reliable? | Yes — `news_added` is skipped entirely (row not created) if missing or unparseable, never defaulted to "now" (`mapPlayerNews` returns `null` in that case). Verified live: ages range from 1.2 to 36.5 days old; **61 of 131 (46.6%) are already older than 14 days**, confirming genuine staleness risk is real and growing as the season progresses, not a theoretical concern. |
| What % of current players have useful news? | **131 of 616 players (21.3%)** have any `NewsItem` at all. Category breakdown: injury 61, transfer 45, availability (doubtful) 24, suspension 1, general 0. **Zero** rows have a `teamId` or `matchId` association — the existing implementation has only ever attached news to players, never teams or matches, despite the schema supporting both. |
| Should this become part of the broader News Layer? | **Yes, as one input among several, unchanged.** It is real, current, legitimately-sourced structured availability data — but it is not journalism (zero editorial content, zero manager quotes, zero tactical context) and must never be described as such. It already answers the "is this player currently available" question (see `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md`, already shipped) — the News Layer's job is everything that data source structurally cannot provide: *why*, not just *what*. |
| Does it need modification now? | **No.** Nothing about this investigation identified a data-quality problem in the existing implementation — it does exactly what it claims, cleanly. Per the task's own instruction, it remains untouched. |

---

## 4. Legitimate source landscape

Every source below was checked today against primary documentation/Terms where the source could be reached; where it could not, that is stated explicitly rather than inferred from a search snippet or third-party wrapper site. Sources already investigated for the Phase 1 News Layer work (`docs/NEWS_LAYER_RESEARCH.md`) are carried forward with their prior verdicts, marked as such, not re-litigated from scratch.

| Source | What it provides | Attribution | Freshness/coverage | Free tier | Commercial/production use | Verdict |
|---|---|---|---|---|---|---|
| **FPL `news`/`news_added`** (already ingested) | Structured injury/suspension/transfer/availability status, player-exact | Not third-party editorial content — it's our own data source | Daily, current | N/A — already legitimately used | Already permitted (same `bootstrap-static` payload as the rest of ingestion) | 🟢 Already in use; not journalism |
| **Official Premier League site** (premierleague.com) | Match reports, club news, official statements | Would be theirs | High, current | N/A | **Checked today, primary source.** Terms of Use (`premierleague.com/en/terms-and-conditions`), fetched directly: *"The Website and App must not be used in any other way, including for commercial purposes, and you may not otherwise reproduce, re-utilise or redistribute it... without our prior written approval."* Explicitly forbids scraping/database-building and commercial reuse. | 🔴 **Confirmed prohibited** without a licensing deal |
| **Official club sites/RSS** (e.g. Arsenal, Liverpool) | Club-specific news, official statements | Club's own | High, current | Varies | Direct fetch of a representative club's terms page was blocked (403, bot-protection) — could not independently verify today. No football-industry precedent was found of a top-flight club granting free commercial redistribution rights to third-party apps; clubs monetise media rights as tightly as or more tightly than the League itself. | 🔴 **Unclear, presumed restrictive** — not assumed permissive without evidence |
| **Guardian Open Platform** | Full editorial articles, tags, sections, search — genuinely covers football | Required | High, near-real-time | Free "Developer" key | Carried forward from `docs/NEWS_LAYER_RESEARCH.md` (verified earlier in this project): free tier is explicitly non-commercial; a separate paid "Commercial" tier exists for production use. **Not re-verified today** — the Guardian's Open Platform pages were unreachable via automated fetch this session; flagged for a fresh check before any commitment. | 🟡 **Free tier: non-commercial only.** Paid tier is the strongest realistic future editorial option (see §13) |
| **BBC Sport RSS** | Headlines + summaries | Required, prescribed form | High | Public feed | Carried forward + re-corroborated by search today: feeds are restricted to personal use; business use requires the BBC's permission and may require a fee. | 🔴 **Confirmed restrictive** |
| **Sky Sports RSS** | Headlines + summaries | — | High | Public feed | Carried forward from prior research: no explicit reuse permission found; default copyright applies. | 🔴 Unclear/restrictive |
| **Google News RSS** | Aggregated headlines | — | High | Unofficial endpoint | Carried forward: unofficial, undocumented, not a supported public API. | 🔴 Not a legitimate integration point |
| **NewsAPI.org** | Multi-publisher aggregation | Required | High | Free "Developer" plan | Carried forward: free tier's own terms restrict it to development/testing, explicitly forbidding production use. | 🔴 Confirmed prohibited on free tier |
| **GNews.io** | Multi-publisher aggregation | Required | High | Free plan | Carried forward: free tier explicitly non-commercial. | 🔴 Confirmed prohibited on free tier |
| **Mediastack** | Multi-publisher aggregation, sports category | Requested (not mandated per ToS text found) | Free tier delayed | Free (100 req/month) + paid | **Checked today, primary source** (`mediastack.com/terms`): general clauses prohibit "reproduce, copy, modify, distribute, market, display, transfer, sublicense... prepare derivative work(s)" without qualifying by tier. Secondary sources describe the free tier as explicitly non-commercial, with commercial use unlocked only on paid plans — consistent with, but not fully confirmed against, the general ToS language found. | 🟡 Paid tier plausible; needs a direct compliance read before committing spend |
| **NewsData.io** | Multi-publisher aggregation, sports category, claims a "free forever, commercial-use-permitted" tier | Unclear | Free tier has a 12-hour delay, no full article content | Free (200 credits/day) | **Could not independently verify.** The vendor's own marketing blog claims the free tier permits commercial use — but per this task's explicit instruction, a vendor's self-interested marketing claim is not treated as evidence of a binding permission, and the actual Terms of Service page could not be fetched (JS-rendered, returned no content twice). | 🟡 **Genuinely unclear — do not assume permission; requires direct ToS confirmation before any use** |
| **PA Media / Opta / Stats Perform** (industry-standard sports news & data licensing) | Full editorial + match data, professionally licensed | Contractual | Highest available | None | Well-established industry structure: enterprise-only commercial licensing, custom pricing, no public free tier. Not independently re-verified via ToS today since this is uncontroversial, widely-documented industry knowledge rather than a permission question requiring parsing. | 🔴 Paid/enterprise only — the realistic option if this product is ever commercially funded at scale (see §13) |

**Overall conclusion, stated plainly: there is currently no legitimate, genuinely free, commercially-usable source of real football journalism available to this product.** Every free-tier option that carries real editorial content is explicitly non-commercial (Guardian, GNews, NewsAPI, Mediastack) or outright prohibits reuse (Premier League itself, BBC). The only source this app can legitimately and immediately build on is the one it already has — FPL's own structured status fields — which is real, current, and free, but is not journalism and must never be presented as if it were.

---

## 5. Licensing/ToS assessment — summary

- **Confirmed, primary-source, prohibited:** Official Premier League site.
- **Confirmed/corroborated, restrictive:** BBC Sport RSS, NewsAPI.org, GNews.io.
- **Unclear, treated as restrictive by default:** Official club sites, Sky Sports RSS, Google News RSS, NewsData.io.
- **Confirmed non-commercial on free tier, paid tier exists:** Guardian Open Platform, Mediastack (Mediastack not fully confirmed on the tier split specifically, but consistent with its category).
- **Confirmed legitimate, already in use, not journalism:** FPL `news`/`news_added`.
- **No public free tier at all (enterprise-only):** PA Media / Opta / Stats Perform.

Nothing in this list changes the conclusion of Phase 1: **no new provider is being integrated now.** This section exists so a future funded phase has an accurate, dated, primary-source-checked map rather than having to redo this research.

---

## 6. Entity association strategy

**The core problem, stated precisely:** given a piece of external text, how does the app know — reliably, not approximately — which `Player`, `Team`, `Match`, or (nonexistent today) `Manager` row it's about?

**What the app can already do reliably, and why:** every player and team already carries a **deterministic provider identifier** (`Player.provider` + `Player.externalId`, same for `Team`) from FPL's own numeric IDs — this is exactly how the existing FPL ingestion avoids fuzzy matching entirely (see `ingestPlayers.ts`, `ingestTeams.ts`). **This is the model to preserve, not abandon**, for any source that itself carries a compatible structured identifier (in practice, only FPL's own fields do today).

**What a genuine editorial source (Guardian, BBC, or similar) would require, and why it's harder:** none of those sources tag articles with FPL IDs, or with any identifier this app shares. Attribution would necessarily start from **text** — a player's name, a club's name — which introduces real, specific ambiguity this document will not paper over:

- **Same-surname collisions.** The current 2026/27 squads alone contain pairs like multiple "Silva"s across different clubs, and a text match on a bare surname is unsafe without club context in the same sentence.
- **"United"/"City" collisions.** "United" alone could mean Manchester United, Newcastle United, Leeds United, or West Ham (historically); "City" alone could mean Manchester City or Leicester City. FPL's own `short_name` fields (`MUN`, `NEW`, `LEE`, `MCI`) sidestep this entirely — free text does not.
- **Manager changes / no Manager entity.** The schema has no `Manager` model at all today. A quote attributed to "the Arsenal manager" can only ever be associated with `Team: Arsenal` as a whole, not a specific named individual, and if that individual leaves and a new manager arrives mid-season, nothing here would notice — because nothing tracks a manager as an entity to begin with. **This is a genuine, named architectural gap**, not a matching-algorithm problem, and adding a `Manager` entity is explicitly out of scope for this design task.
- **Transfers between clubs.** A player's club affiliation changes; a news association strategy keyed only on "current club" would misattribute an old article to a player's new club, or vice versa, unless the story is timestamped and the player's club-at-that-time is known — which today's schema does not retain (see the same historical-status-attribution problem already documented in `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md`'s limitations).
- **Multi-entity stories.** A transfer-deadline-day roundup mentioning six players and four clubs cannot be safely reduced to "this story is about Player X" — it's about all of them, or realistically, none of them individually.

**Recommended strategy, in order of preference — deterministic first, always:**

1. **Provider-ID matching wherever the source itself is FPL** (already done, keep doing it, zero ambiguity).
2. **For any future text-based source: exact match against an explicit alias table, never substring or fuzzy matching.** A short, hand-maintained list per entity (full name, common short forms actually used in headlines — e.g. "Spurs" for Tottenham) — not a similarity score, not Levenshtein distance, not any approach that can silently attach a story to the wrong "Silva." A story that doesn't cleanly match the allowlist stays **unattached** rather than guessed at.
3. **Multi-entity stories are stored unattached to a single player/team, or attached to every entity they clearly and individually name** — never collapsed into one "most likely" subject.
4. **No manager-entity association is possible until a `Manager` model exists.** Until then, a manager-attributed story can only ever attach to the `Team`, and the UI must never phrase this as being "about" a specific person by name in a way that implies a tracked entity, only as a club-level note.
5. **Confidence is a first-class, stored field, not an afterthought.** Every association should be either "certain" (deterministic ID match) or "not stored as an association at all" — there is no proposed "probably" tier, because a probably-wrong attribution in an accuracy-first product is worse than no attribution.

---

## 7. News taxonomy — what's legitimately obtainable vs. worth building

| Category | Legitimately obtainable today? | Would it materially improve the product? |
|---|---|---|
| Injury | 🟢 Yes — FPL's own status field, already ingested | Yes — already shipped (Player Availability Intelligence) |
| Suspension | 🟢 Yes — FPL's own status field | Yes — already shipped |
| Transfer (in/out) | 🟢 Yes — FPL's own status field (`u` status, verified as departures) | Yes — already shipped |
| Contract (extension/expiry) | 🔴 No legitimate free source found | Unproven — deferred |
| Manager comments | 🔴 No legitimate free source found; also no `Manager` entity to attach it to | Potentially high value, but blocked on both source and data model — explicitly deferred |
| Press conference | 🔴 Same as manager comments | Same |
| Tactical/role change | 🔴 No legitimate structured source; inferring this from prose would risk exactly the "fabricated tactical explanation" failure mode this app has repeatedly ruled out | Would be valuable **if** verifiably sourced — not safe to attempt without one |
| Selection/team news | 🔴 No legitimate free source with reliable per-fixture lineup announcements beyond FPL's own availability signal | The FPL signal already covers the safely-obtainable slice of this |
| Training return | 🟡 Sometimes implicit in FPL's `news` text (e.g. "75% chance of playing") but not a distinct structured field | Marginal — already partially covered by availability, not worth a separate category |
| Form/performance discussion | 🔴 Editorial-only concept; would require a licensed journalism source | The app already has a data-driven equivalent (Form/Momentum) that doesn't need this |
| Milestone (caps, goals, appearances) | 🟡 Technically derivable from the app's own existing performance data, not from a "news" source at all | Interesting, but it's a Discover/Season Story feature, not a News Layer one — flagged as out of scope here |
| Disciplinary issue | 🟢 Partially — suspensions are already covered; anything beyond that needs a licensed source | Already covered where legitimately obtainable |
| Off-pitch story | 🔴 No legitimate source; also the highest-risk category for the "never invent, never imply things about real people" principle | **Explicitly not recommended at any phase** without a fully licensed, editorially-responsible source |
| Transfer speculation/rumour | 🔴 No legitimate source; and even if one existed, presenting speculation as fact would directly violate the "never present rumours as facts" principle | **Explicitly not recommended.** A confirmed transfer (FPL's `u` status) is fine; a rumoured one is not this product's business |
| Match reaction (post-match quotes) | 🔴 No legitimate free source | Would strengthen Match Centre if ever licensed (see §9) |

**Pattern worth naming explicitly:** every category this app can *legitimately* obtain today (injury, suspension, transfer, disciplinary via FPL) is **already built** (Player Availability Intelligence). Every category that would require genuine editorial journalism (manager comments, tactical context, transfer speculation, off-pitch stories) is currently **blocked on licensing**, not on product design. This is the single most important finding in this document: **there is no unbuilt, legitimately-obtainable "big win" category waiting to be added right now.** The News Layer's next real step is not a new data category — it's making better use of the one category already legitimately available (see §11).

---

## 8. How news should interact with existing intelligence, by location

| Location | Value | Complexity | Risk | Assessment |
|---|---|---|---|---|
| **Player page** | High — already proven (Player Availability Intelligence ships exactly this: a factual line beside the Performance score, additive, never blended into scoring). | Low (done) | Low | ✅ Already correctly built; this design doesn't propose changing it |
| **Team Intelligence** | Medium-high — an "availability watch" surfacing the same underlying data, filtered by which players actually have a computed Performance score (the exact non-invented relevance filter already established in `docs/NEWS_CONTEXT_PRODUCT_DESIGN.md`). | Low (the primitive, `getPlayerAvailability`/`getPlayerAvailabilityMap`, already exists and was built for this) | Low | ✅ Next natural step — see §11 |
| **Match Centre** | Plausible in principle (pre-match "who's missing" context) but genuinely constrained: the app only stores a player's **current** status, never a historical snapshot of status **as of a specific past match's kickoff**. Showing today's availability next to a match played weeks ago risks implying an absence explains a result it may have nothing to do with — already identified and explicitly rejected in `docs/NEWS_CONTEXT_PRODUCT_DESIGN.md` §4. | Medium-high (would require a real schema change to snapshot status per-match, which is out of scope for any near-term phase) | High (the exact "fabricated tactical explanation" failure mode this task explicitly forbids) | ❌ Not recommended until a genuine historical-snapshot mechanism exists |
| **Homepage / My Football** | High — respects the existing single-preference personalisation model perfectly: "worth knowing about `<supported club>`" needs no new stored preference, just a read against the club the user already told the app they support. | Low-medium (reuses the same availability primitive, aggregated per squad) | Low | ✅ Strong second step — see §11 |
| **Discover** | Low-medium — could flag "this player has a live availability note" on a card, but availability isn't really a *discovery* axis (it doesn't help someone find an interesting player, it just adds a caveat to one they've already found). | Low | Low | 🟡 Nice-to-have, not a priority; do not build first |

---

## 9. The "intelligence + context" model

This is the most important design decision in this document, and it should be **architectural, not cosmetic**: the News Layer must never let the product imply a causal relationship it cannot actually evidence.

**The three-tier distinction to build in from day one:**

1. **Observed by our model** — a claim this app's own scoring/intelligence engine directly computed from real match data (a Form trend, a Performance score, a Match Rating). Already fully trustworthy; nothing here changes it.
2. **Reported externally** — a fact stated by a legitimate external source, shown as exactly that source's claim, attributed, never restated in the app's own voice as if it discovered it (e.g. FPL's own "75% chance of playing," or, in a future licensed phase, a manager's own quoted words).
3. **Interpretation** — anything that would require *connecting* tiers 1 and 2 (e.g. "his Form improved *because* his role changed"). **This tier should not exist as an automated output at all**, unless a specific, narrow, verifiably-sourced case can support it (and even then, phrased as "A and B are both true," never "A caused B"). The example given in the brief — Player Intelligence flags improvement, News reveals a role change — is a genuinely valuable **juxtaposition**, and juxtaposition is exactly the right ambition: show both facts side by side, cleanly labelled by tier, and let the user draw the (obvious, usually correct) connection themselves. The app draws it for them only when it has actual evidence, never when it's plausible-sounding pattern-matching.

Concretely, this means every `NewsItem`-derived UI element should carry a tier label (even if only implicit in its presentation — a "Reported: Fantasy Premier League" attribution line, e.g.) and no UI copy should ever bridge tiers with a causal word ("because", "which explains", "as a result of") unless the *same, single source* explicitly states that causal link itself.

---

## 10. Football Voice considerations

Read `lib/analytics/voice/concepts.ts` directly. Two findings materially simplify this section:

1. **The voice system is already concept-based, not phrase-bank-based** — exactly the shape needed to safely extend to news-derived context, and exactly the reason this document does not need to propose "another phrase bank." A concept fires only when a real signal is detected; phrasing is chosen from a pool only after that.
2. **The architecture already has named slots anticipating this exact gap.** Two `implemented: false` concepts already declare precisely the context a licensed news source would eventually fill: `requiresContext: ["Manager/player pressure or job-security context (don't have)"]` and `requiresContext: ["Player transfer history / former-club relationships (don't have — no transfer history data ingested)"]`. Wiring a future concept up is "populate the named slot with a real source", not "redesign the humour system" — this was evidently designed with exactly this kind of future extension in mind.

**Design rule for News + Voice, stated as the brief's own example demands:** the *fact* is always assembled and shown first, in plain factual language, sourced and attributed. Humour is layered on **only** where an existing, already-detected concept genuinely activates (e.g. `STOCKS_RISING` already exists and is `implemented: true` from real Form data — a news item confirming a recovery could reasonably co-occur with it, without the joke itself needing to reference the news). **Availability/injury/suspension content specifically should continue to never receive forced humour** — this rule already exists (`docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md`, "no forced humour — the availability line uses plain factual language only") and this document does not propose changing it. A future licensed editorial source (manager quotes, press conferences) is a more promising place for dry, observational humour than injury news ever was or should be — but building that safely requires the concept mechanism to detect it from a real signal, not from a generic "there's a quote, insert a joke" rule.

---

## 11. Minimum viable News Layer

Given §4's conclusion (no new legitimate source is available today) and §7's finding (every legitimately-obtainable category is already ingested), **the MVP is not a new ingestion pipeline — it's the first real product use of the data already flowing in**, exactly mirroring the Player Availability Intelligence precedent.

- **What data is ingested?** Nothing new. FPL's existing `news`/`news_added`/`status` fields, already flowing daily.
- **From where?** Nowhere new. Same `bootstrap-static` payload.
- **How often?** Unchanged — daily, via the existing Vercel Cron (see §14 on matchday-frequency implications, deferred).
- **What entities are stored?** Unchanged — `Player` only, via the existing `NewsItem` model (already supports `Team`/`Match` associations if a future source needs them).
- **What metadata is required?** Unchanged — the existing model already carries everything needed (`category`, `publishedAt`, `sourceName`, provenance).
- **How are duplicates handled?** Unchanged — already correctly idempotent (§3).
- **How is freshness handled?** Unchanged from the Player Availability precedent — a documented window (14 days for open-ended categories, none for permanent/dated facts like suspensions and transfers; see `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md` §4).
- **How is attribution handled?** Unchanged — `sourceName: "Fantasy Premier League"`, shown wherever the data is surfaced.
- **How are old stories archived?** Not deleted — kept as history (already the case), simply not surfaced once stale.
- **What UI does the user actually see?** The next increment beyond the player page: a **My Football "worth knowing" line** for the user's supported club, built by composing the *already-existing* `getPlayerAvailabilityMap()` primitive (built specifically for this reuse case, per `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md` §8) against the club's own already-computed Performance scores — reusing, not rebuilding, the same non-invented relevance filter validated in `docs/NEWS_CONTEXT_PRODUCT_DESIGN.md` (a player only surfaces here if they already have a computed season Performance score, exactly as documented).
- **What does it deliberately NOT attempt?** A general club news feed; manager quotes or press-conference content (no legitimate source, no `Manager` entity); tactical inference; Match Centre integration (§9); transfer speculation; anything requiring a new paid provider.

This MVP requires **zero schema changes** (the model and the primitive both already exist) and is a UI/composition task, not a new data-engineering effort.

---

## 12. Phased implementation roadmap

- **Phase A — research/data foundation.** ✅ Complete (FPL news ingestion, `NewsItem` model, this document).
- **Phase B — first product use (player-level).** ✅ Complete (`docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md` — the player-page availability indicator, the `getPlayerAvailability`/`getPlayerAvailabilityMap` primitives).
- **Phase C — squad/club-level product experience.** Not yet built. The MVP in §11: Team Intelligence's "Availability watch" and My Football's "worth knowing" line, both composing Phase B's existing primitive. No new data, no new schema — pure product/UI work reusing what exists.
- **Phase D — licensed editorial layer, if ever funded.** Genuine manager quotes, press conferences, tactical context, transfer confirmations beyond FPL's own signal — requires a paid/licensed source (Guardian commercial tier, or an enterprise provider — see §13). Would also require adding a `Manager` entity to the schema for reliable attribution (§6), and populating the voice system's already-waiting `requiresContext` slots (§10). Not proposed for implementation now.

---

## 13. Free vs. paid capability matrix

| Capability | Status |
|---|---|
| Player injury/suspension/transfer/availability status, current | 🟢 Can build now for free — already built |
| Team-level "availability watch" (Phase C) | 🟢 Can build now for free — no new data needed |
| My Football "worth knowing about your club" (Phase C) | 🟢 Can build now for free — no new data needed |
| Freshness-aware, non-stale display of the above | 🟢 Already solved (§3, §11) |
| Confirmed transfers, suspensions with dates | 🟢 Already covered by FPL's own fields |
| A numeric, more-precise "chance of playing" signal | 🟢 Available now (`chance_of_playing_next_round`, already persisted per `docs/PLAYER_AVAILABILITY_IMPLEMENTATION.md`), not yet surfaced beyond the player page |
| Manager comments / press conferences | 🔴 Requires a licensed editorial source (Guardian commercial tier realistically the closest fit) **and** a new `Manager` entity |
| Tactical/role-change context | 🔴 Requires a licensed source with genuine tactical reporting; not safely inferable from any free source |
| Transfer speculation/rumours | 🔴 Not recommended even if a source existed — conflicts with the "never present rumours as facts" principle regardless of budget |
| Match-report-level post-match reaction | 🔴 Requires a licensed source; would meaningfully strengthen Match Centre's `summary` field if ever available |
| Historical per-match availability snapshots (unblocking Match Centre integration) | 🟡 Not a licensing problem — a data-model problem. Could be built for free (store status-at-ingestion-time per gameweek instead of only current status) but is a genuine schema change, out of scope here, and worth its own future design pass rather than folding into this one |
| Off-pitch/personal stories | 🔴 Not recommended at any price point without full editorial accountability — the risk profile doesn't suit an accuracy-first intelligence product regardless of source quality |

---

## 14. Risks and failure modes

- **Staleness compounding as the season progresses.** Already measurably real (46.6% of current news items are >14 days old at GW2) — the freshness discipline already built for Player Availability must be preserved exactly as-is for any Phase C surface, not loosened for the sake of having "more" to show.
- **Entity misattribution.** The single biggest risk of ever adding a text-based source (§6) — mitigated only by refusing fuzzy matching, ever, as the default.
- **Causal overreach.** The single biggest risk to product trustworthiness (§9) — mitigated by the three-tier model, enforced at the architecture level (a UI component that can only render "Observed"/"Reported" separately has no way to accidentally imply "Interpreted").
- **Scope creep back into a general news feed.** The single biggest risk to product *identity* — mitigated by treating every future News surface as a filtered, relevance-gated addition to an existing intelligence view, never a standalone page of its own.
- **Matchday ingestion frequency.** The existing once-daily cron (confirmed still in place, `docs/PRODUCTION_DATA_PIPELINE_AUDIT.md`) means a same-day status change (e.g. an injury confirmed mid-matchday) won't reach the app until the next day's run — the same gap already identified for match results. This document does not propose fixing it (explicitly out of scope, per the task's own instruction — "treat it as a separate infrastructure task") but flags it clearly: **any Phase C feature inherits this same freshness ceiling**, and the fix, if pursued, would benefit both the results pipeline and the News Layer identically, so it's worth sequencing as one shared infrastructure task rather than two.

---

## 15. Explicitly deferred capabilities

- A general club/league news feed of any kind.
- Manager entity modelling and manager-attributed content.
- Any editorial journalism source (Guardian, BBC, or otherwise) until a commercial licence is actually purchased.
- Transfer speculation/rumour content, regardless of source, at any phase.
- Off-pitch/personal story content, regardless of source, at any phase.
- Match Centre availability/context integration, until a genuine historical-status-snapshot mechanism exists.
- Tactical inference of any kind from any source.
- Any new stored personalisation preference beyond `supportedClubId`.
- Matchday-frequency ingestion changes (separate infrastructure task, not this one).
- A `chance_of_playing_next_round`-based "back in contention" concept for the voice system (plausible per §10's architecture, but not designed in this pass).

---

## 16. Recommended next implementation step

**Build Phase C exactly as scoped in §11/§12: the My Football "worth knowing about `<supported club>`" experience, followed immediately by Team Intelligence's "Availability watch."** Both compose primitives that already exist (`getPlayerAvailabilityMap`, the Performance-score relevance filter already validated against real data) — this is a focused UI/composition task with no new schema, no new ingestion, no new licensing exposure, and it is the natural, already-designed-for continuation of the Player Availability Intelligence work already shipped. It also directly serves the single-preference personalisation model without expanding it, and gives the clearest, most personally-relevant "the app told me something I'd actually want to know" moment identified anywhere in this investigation.

---

# Summary for the user

**1. What I investigated:** the current FPL news implementation against live production data (not assumptions); the licensing landscape for editorial news sources (official Premier League site — confirmed prohibited via direct primary-source fetch; Guardian, BBC, Sky, Google News, NewsAPI, GNews carried forward from prior verified research; Mediastack and NewsData.io newly checked today, one confirmed restrictive-by-default, one genuinely unresolved); the app's actual entity-identification architecture (deterministic provider IDs, no `Manager` entity); the existing voice system's concept architecture; and the existing personalisation, Player/Team Intelligence, and Match Centre code to ground every recommendation in what's actually there.

**2. The strongest legitimate opportunity:** using the data already ingested — FPL's structured availability/injury/suspension/transfer status — as genuine **context alongside existing intelligence**, not as a news feed. The clearest expression of this is a supported-club user learning "your two best performers this week are both currently doubtful" — a real, personal, non-invented insight the app cannot currently surface anywhere above the individual player page.

**3. The recommended MVP:** no new ingestion at all. Compose the already-built `getPlayerAvailabilityMap()` primitive against each club's already-computed Performance scores to power a My Football "worth knowing" line and a Team Intelligence "Availability watch" — both zero-schema-change, zero-new-licensing, pure product work.

**4. What's genuinely free today:** everything already built (player-level availability) and everything proposed as the MVP (squad/club-level composition of that same data). Nothing else in the "real editorial journalism" category is genuinely free for commercial use anywhere in the market as verified today.

**5. What requires paid/licensed data:** manager comments, press conferences, tactical context, match-reaction reporting, and transfer confirmations beyond FPL's own signal — realistically the Guardian's commercial Open Platform tier, or an enterprise provider (PA Media/Opta-class), if this product is ever commercially funded at that scale. Also requires adding a `Manager` entity to the schema, which this document deliberately does not do.

**6. The exact next implementation step:** build the Phase C My Football/Team Intelligence "worth knowing" experience described in §11 and §16 — awaiting your approval before writing any code.
