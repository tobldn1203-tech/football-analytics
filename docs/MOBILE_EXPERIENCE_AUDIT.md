# Mobile Experience Audit — Phase 2, Section 8

Investigation only. Nothing was changed to produce this document. Audited the actual running app (not just source reading) at 375px, 390px, and 430px, using Playwright — real screenshots, real DOM measurements (bounding boxes, overflow detection, computed styles), against real current-season data. Every finding below cites the specific evidence that produced it.

---

## Executive summary

1. **The site header overflows the viewport on every single page at real mobile widths (375–390px).** Confirmed by direct DOM measurement: the header's nav+"My Football" cluster is 405px wide and its right edge sits at x=425 against a 390px viewport — on every page, because the header is shared. This makes the entire page body horizontally scrollable, which is bad on its own (an app-like product shouldn't let the whole page slide sideways) and is the direct cause of finding #2.
2. **The homepage's Top Performers table — the single most-used feature in the product — clips its own Performance scores on real phones.** Screenshotted directly: "9.3" renders as "9", "EXCELLENT" renders as "EXCELLI", the "PERFORMANCE" column header renders as "PERFORMAN". This is not a hypothetical responsive concern — it is the literal, headline number of the app's flagship ranking, unreadable by default on a standard phone width, with no visual cue that scrolling right would reveal it.
3. **The homepage ranking table's clickable area doesn't match what it visually looks like.** The player avatar and the player name are visually one unit but only the name text (~21px tall) is an actual link — the avatar itself does nothing when tapped. On a touch device this is a "landmine" pattern: users tap the part that looks most tappable (the photo) and nothing happens.
4. **Match Centre is roughly 4,600px tall on a phone** — over 11 screens of scrolling for one match — and the single biggest contributor is two complete Starting XI + substitutes lists stacked vertically, one full team then the other. A user glancing at a match for 30 seconds gets the score and headline, but nothing below "Who ran the show?" is realistically reached.
5. **Header nav links are ~18–20px tall touch targets**, well under any comfortable touch-target size, sitting inside a horizontally-scrollable row with no visual affordance that it scrolls.
6. **The Player and Team pages are, by contrast, already in good shape on mobile** — a direct, visible payoff of the recent condensation work (removing duplicate Season Story chips, the Archetype shape-bars, and the Team Performance Profile). These should be treated as the reference bar for the rest of the app, not as pages needing further mobile work.
7. **Discover already reads well on mobile** — a genuinely mobile-appropriate 2-column category grid collapsing into a clean single-column list. This is evidence the product already knows how to do this well when a screen is designed with a phone in mind from the start.
8. The football voice (Season Story prose, Match Standout narrative) already reads naturally on mobile — text-first, no oversized joke card — this relationship is intact and should be preserved as-is.
9. Nothing broke *because of being on mobile specifically* in Team/Player pages — the real gaps are concentrated in exactly two places: the shared header, and the Homepage/Match Centre, which is a useful, narrow, and actionable finding rather than a diffuse "everything needs work" one.

---

## Page-by-page audit

### Homepage (`/`)

**Current experience:** My Football (if a club is set) → Discover teaser → Top Performers ranking table with a horizontally-scrolling category tab strip.

**What works:** the My Football card and Discover teaser are compact, single-purpose, and already read well at 390px — no changes needed. The category tabs (Performance/In Form/Attack/...) scrolling horizontally is a reasonable, common mobile pattern *for that specific control*.

**What doesn't:**
- The ranking table clips its Performance score and quality label at the right edge (see finding #2). Measured: at 390px, only `#`, `Player`, and a truncated `Performance` column are meant to show (Team/Position are already correctly hidden via `hidden sm:table-cell` in `top-performers.tsx`) — but even with those columns hidden, the remaining table is still wider than the viewport, because the header row's own overflow (finding #1) shifts everything right, and the table's cell padding/font sizing wasn't budgeted for the width that's actually left over.
- The avatar-vs-name split link target (finding #3).
- The category tab strip has no visual affordance (fade, arrow, or partial next-tab peek) that there's more to scroll to — a user has to discover it by accident.

**Severity:** High (the clipped score is a core-feature bug, not a polish issue).
**Classification:** C (responsive implementation problem) for the clipping — the desktop table design is fine; the mobile column/width budget was never actually solved, just partially attempted (two columns hidden, not enough). A (mobile-specific) for the tab-scroll affordance.
**Recommended direction:** Rethink the Top Performers row as a mobile-first component (not a hidden-columns table) — a compact row layout closer to what `TeamPlayersDriving` already does successfully (avatar, name, one clean number) rather than a `<table>` with columns switched on and off.

### Discover (`/discover`)

**Current experience:** category picker grid → a single ranked list for the active category.

**What works:** genuinely good. Two-column card grid at mobile is legible and tappable; the list below (player name, club, form/metric) is a clean single-line-per-row pattern with no clipping, no cramped metadata, one number per row. This is the best mobile page in the app right now.

**What doesn't:** minor — the category grid's descriptive sub-text ("Who's flying under the radar?") occasionally sits close to the card edge; not a real problem at the widths tested.

**Severity:** Low. **Classification:** N/A — working well. **Recommended direction:** none needed; use this page's row pattern as the template when reworking Top Performers.

### Individual Player page (`/players/[slug]`)

**Current experience:** hero (identity, score, trend, archetype, availability) → Season Story (narrative, stat tiles, journey, what stands out, best performances) → Player Profile (archetype description) → Analytical Breakdown (category bars) → Recent Matches table → Key Moments placeholder.

**What works:** everything, essentially. No clipping, no horizontal scroll beyond the shared header issue, sensible card count (down to 3 "card-like" containers after the recent condensation pass, measured directly), category bars are legible, the recent-matches table is compact and doesn't need column-hiding tricks because it was designed with few enough columns to begin with.

**What doesn't:** nothing page-specific found. The only overflow present is the shared header issue (see Cross-cutting).

**Severity:** Low. **Classification:** N/A. **Recommended direction:** preserve as the reference implementation — this is what "designed for mobile, not shrunk for mobile" looks like elsewhere in this same app.

### Teams list (`/teams`)

**Current experience:** the league table, full width, with column-hiding at narrow widths (already only shows `#`, `Club`, `P`, `GD`, `Pts` at 390px, per direct measurement).

**What works:** the column reduction is exactly the right instinct and already implemented — this table doesn't clip, because unlike Top Performers it committed to hiding enough columns that what remains actually fits.

**What doesn't:** nothing found at the widths tested.

**Severity:** Low. **Classification:** N/A.

### Individual Team page (`/teams/[teamId]`)

**Current experience:** identity hero → Team Overview → Players Driving the Team → Availability Watch (where relevant) → Performance Journey → Match History → League Position → Next Fixture.

**What works:** this page is the other clear success story. Players Driving the Team is exactly the "compact horizontal row" pattern the brief asks about elsewhere — it already exists here and works well at 390px (verified: no clipping, sensible truncation on long combined reason text like "Standout performer this seas…", tap targets are full-row height). League Position correctly reduces to the same 5 columns as the standalone teams list.

**What doesn't:** nothing page-specific found.

**Severity:** Low. **Classification:** N/A. **Recommended direction:** preserve; this and the Player page are the two pages to hold up as "already right" when reworking the rest.

### Matches / gameweek view (`/matches/[gameweek]`)

**Current experience:** gameweek header with prev/next → a vertical stack of fixture cards (crest + name each side, score/kickoff centre).

**What works:** each fixture card is legible, single-row, three independent tap targets (home team, match, away team — from the recent navigation work) all comfortably sized (measured ~38–40px tall touch areas). No clipping observed.

**What doesn't:** nothing significant found beyond the shared header issue. The prev/next gameweek links ("← Gameweek 1" / "Gameweek 3 →") are a reasonable pattern but are quite far apart at the top of a tall card — on a very long gameweek list a sticky mini version of this could help (see Deeper UX changes), not urgent.

**Severity:** Low. **Classification:** N/A for the fixture cards themselves.

### Individual Match Centre (`/match/[matchId]`)

**Current experience:** hero (score) → What happened → snapshot stats → Match Standout → Team Performance → Who Ran the Show (both sides) → Match Events (3 columns) → Squad Performance (both full XIs + subs) → Match Timeline placeholder.

**What works:** every individual section, in isolation, is well-built — no clipping, sensible typography, the recently-added team links work correctly, the narrative sections read naturally.

**What doesn't:** the page as a *whole* is the single longest, most demanding scroll in the app — measured at ~4,600px tall at 390px width, meaning roughly 11+ full phone screens of vertical scrolling to reach the bottom. The overwhelming majority of that height is the Squad Performance section: two complete 11-player Starting XIs plus two full substitute benches, stacked one after another, every player shown regardless of whether anything about their game was notable. On mobile this reads as a wall of near-identical rows (position, minutes, one adjective, one number) between the genuinely interesting sections (Standout, Who Ran the Show) and the bottom of the page.

**Severity:** High (page-rhythm, not a bug) — this directly works against "if someone opens this page for 30 seconds on a train, what do they take away." Right now they take away the score and, if they scroll a little, the standout performer — everything past that is effectively invisible in a realistic mobile session.
**Classification:** D (product architecture) for Squad Performance specifically — showing every player, every time, regardless of relevance, is a content-modelling decision, not a CSS one. B (shared UX problem, mildly, since the same length exists on desktop too, just less punishing to scroll with a mouse wheel).
**Recommended direction:** progressive disclosure for Squad Performance specifically (e.g., collapsed by default with the two Best Performers already promoted above it doing double duty, full squad available on demand) — not a redesign of the individual rows, which are fine.

### Navigation between Player → Team → Match

**Current experience:** direct links now exist everywhere (recent work) — player hero → club → team page; team page → opponent/match history → match; match centre → both team crests → team pages; team page → player rows → player pages.

**What works:** the actual link graph is now genuinely there and was verified end-to-end in the previous task (click-through tests passed for all of these). The idea of "Player → Team → Match → Opponent → Player" as an exploration loop is structurally *possible* right now.

**What doesn't:** there is no "back to where I came from" affordance beyond the browser/OS back gesture and each page's own single "← Gameweek 2" / "← Top performers" / "← Premier League table" breadcrumb-style link — and those three breadcrumbs are inconsistent in what they point to (one goes to the gameweek you came from, one always goes to the homepage regardless of where you actually came from, one always goes to the full teams list). On mobile, where swipe-back gestures are common but not universal (depends on OS/browser chrome), a user who followed Player → Team → Match → Opponent Team → Opponent Player has no way to retrace that specific chain except the system back button multiple times — the in-page breadcrumb links don't reflect the path actually taken, only a fixed default.

**Severity:** Medium. **Classification:** D (architecture/navigation-model problem, shared between desktop and mobile, but felt much more on mobile since swipe-back reliability varies and there's no persistent chrome to reorient with).
**Recommended direction:** not a new nav system — just making each page's existing "back" link honest about *actual* provenance where feasible (e.g. a match reached via a team's match history could say "← Back to Arsenal" instead of always "← Gameweek 2"), which is a small, targeted fix, not a redesign.

---

## Cross-cutting problems

- **Header overflow (see finding #1)** — present on every page, single root cause, single fix location (`components/layout/site-header.tsx`). This is the highest-leverage fix in this entire audit: one component, every page benefits.
- **Column-hiding tables that don't recompute their remaining width budget** — Top Performers is the one real offender found; Teams list and League Position got this right. The difference is worth studying: the working ones committed to *fewer* remaining columns and simpler per-cell content than Top Performers did.
- **Split avatar/name click targets** — found in Top Performers; worth checking for the same pattern anywhere else a `PlayerIdentity`-style avatar-plus-badge sits next to (rather than inside) a link, though this was the only confirmed instance in this pass.
- **No visual affordance for horizontally-scrollable regions** (the category tab strip, the header nav's own internal scroll) — technically functional, not discoverable.
- **Breadcrumb links reflect a fixed default, not actual navigation history** — low-severity individually, compounds as the Player↔Team↔Match graph gets more interconnected (see Roadmap implications).
- **Long, uniform list sections with no differentiation** — Match Centre's Squad Performance is the clear example; worth checking again once Best XI ships, since that feature will also fundamentally be "a list of players" and should learn from this rather than repeat it.

---

## Quick wins

*(Not to be implemented in this task — listed for the follow-up implementation prompt.)*

1. **Fix the header overflow.** The nav+My Football cluster needs to actually fit or genuinely scroll within the viewport rather than silently overflowing the body. Single component, affects every page. Highest ratio of impact to effort in this whole audit.
2. **Fix Top Performers' clipped score/label.** Either commit to a narrower cell layout (score and label stacked vertically in less horizontal space, as the Team page's Players Driving row already does successfully) or drop to an even more reduced column set on the narrowest widths.
3. **Make the whole Top Performers row one tap target** (avatar included), matching the pattern `TeamPlayersDriving` and `PerformanceLeaders` already use correctly elsewhere.
4. **Add a subtle scroll affordance** to the category tab strip and any other horizontally-scrolling row (a soft right-edge fade is the lowest-effort version).
5. **Increase the header nav links' effective touch target height** (padding, not necessarily visual size) — an easy, contained change.

## Deeper UX changes

*(Not to be implemented in this task.)*

1. **Rethink Top Performers as a mobile-first row component**, not a table with columns toggled by breakpoint — reusing the row pattern already proven in `TeamPlayersDriving`/`PerformanceLeaders` rather than inventing a third pattern.
2. **Progressive disclosure for Match Centre's Squad Performance** — collapse full squads behind a disclosure, keeping whichever few players are already flagged elsewhere on the page (Standout, "Who ran the show") visible without needing to open it. This is a content-architecture change, not a style one, so it deserves its own design pass rather than a quick CSS fix.
3. **Provenance-aware back links** instead of fixed-default breadcrumbs, once the Player↔Team↔Match graph is used enough that this starts to matter (it will matter more, not less, as Best XI and Player Comparison add more cross-linking).
4. **A considered pass on Match Centre's overall length/rhythm** beyond just Squad Performance — Match Events and Squad Performance sit back-to-back and could plausibly be reordered or partially merged once Key Moments/Match Intelligence exists and gives the page a stronger narrative spine to hang shorter sections off.

## Things NOT to change

- **The Player page's structure and density**, post the recent condensation work — it is the best evidence in the app that "same information, better hierarchy" works, and should be the template, not a target for further change.
- **The Team page's structure**, same reasoning — Players Driving the Team's row pattern in particular should be *copied*, not redesigned.
- **Discover's category grid + list pattern** — already mobile-appropriate, no evidence of a problem.
- **The football voice's current presentation** (Season Story prose, Match Standout narrative) — text-first, evidence-alongside, no oversized joke card; this relationship is intact on mobile today and nothing found in this audit threatens it. Any future mobile work should actively avoid disturbing this.
- **Fixture cards' three-way link split** (home team / match / away team) from the recent navigation work — already correctly sized and unambiguous on mobile; don't revisit.

---

## Roadmap implications

- **Discover Rework:** inherit the *existing* Discover row/grid pattern rather than reinventing one — it already works. Do not let the rework accidentally introduce a table-with-hidden-columns pattern for anything resembling a ranking, given what that did to Top Performers.
- **General UX Rework:** the header overflow should be fixed as part of (or before) this, since it's the one true "shared component, every page affected" issue found — doing it once here is strictly better than doing it N times inside N other feature workstreams that all sit inside the same header.
- **Best XI + Friends:** this feature is fundamentally "select/display many players at once" — exactly the shape that broke in Match Centre's Squad Performance. Solve the "list of many players on a phone" problem once (progressive disclosure / row pattern), before Best XI needs the same answer under time pressure.
- **Player Comparison:** will need a genuinely mobile-native side-by-side (or stacked/toggle) layout for two players' numbers — the current column-hiding-table instinct (Top Performers) is the wrong model to copy for this; the row-based `TeamPlayersDriving` instinct is closer, but comparison is a distinct enough shape (two subjects, shared metrics) that it likely needs its own pattern, not a reuse of either existing one. Flagging this now so it isn't designed against the table-hiding instinct by default.
- **Key Moments / Match Intelligence:** an opportunity to give Match Centre the narrative spine that would make reordering/shortening the current back-half of the page (Match Events, Squad Performance) feel motivated rather than arbitrary — worth sequencing this audit's Match Centre recommendations alongside, not before, that feature's own design.
- **Competition Architecture / EFL/Cup expansion:** the header's nav row is already at its width limit with four items (Players/Discover/Matches/Teams) plus a disabled fifth (Rankings) plus My Football. Adding competition-switching UI to a header that already overflows at mobile widths would make finding #1 materially worse — fix the header before this lands, not after.

---

## Recommended implementation sequence

1. **Fix the header overflow** (Quick win #1). Every other mobile improvement is easier to evaluate honestly once the whole app isn't silently scrollable sideways.
2. **Fix Top Performers' clipped score and split tap target** (Quick wins #2–3). This is the single highest-severity, most visible bug found, on the app's most-used page.
3. **Progressive disclosure for Match Centre's Squad Performance** (Deeper change #2). Second-highest severity; more design effort than the header fix, but bounded to one section of one page.
4. **Scroll affordances + nav touch-target sizing** (Quick wins #4–5). Low effort, meaningfully improves the "premium/tactile" feel asked about, no dependency on anything else.
5. **Provenance-aware back links** (Deeper change #3). Lower urgency today; rising in importance as more cross-linking ships, so worth doing before (not long after) Best XI/Player Comparison add more of it.
6. **Revisit Match Centre's broader rhythm** (Deeper change #4) — sequence this alongside Key Moments/Match Intelligence rather than in isolation, since that feature will change what the "right" order of sections even is.

This sequence front-loads the two genuine bugs (header overflow, clipped scores) ahead of the more subjective rhythm/architecture work, and places the Match Centre length problem before Best XI specifically so the same "many players, one screen" problem isn't solved twice under different names.
