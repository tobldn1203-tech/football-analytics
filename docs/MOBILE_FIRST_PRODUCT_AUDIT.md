# Mobile-First Product Experience Audit

Investigation only. Nothing in the application was changed to produce this document — no code, tests, schemas, or analytics were touched. Conducted ahead of Custom Best XI to decide what, if anything, needs to change about the mobile product before more features are built on top of it.

Audited the **actual running application** (`npm run dev`, port 3000, real `dev.db` 2026/27 season data) with Playwright — real DOM measurements (bounding boxes, `scrollWidth`/`clientWidth`, computed styles), real screenshots, real navigation clicks — at **375px, 390px, 430px**, compared against **1280px** desktop. Tested both the no-supported-club and supported-club (Man City) states, several real players, a played match and an unplayed match, and a gameweek chosen specifically because it contains several long club names (Crystal Palace, Coventry City, Nott'm Forest, Sunderland, Aston Villa), not the short ones a lucky sample could hide behind.

This is a **follow-up**, not a first pass. `docs/MOBILE_EXPERIENCE_AUDIT.md` (Phase 2 §8) already found and — per this session's own re-testing — the team already fixed several real bugs: header overflow, the Top Performers avatar/name split tap target, Match Centre's squad-list length, and the category-tab scroll affordance. Section 3 below verifies each of those fixes against the live app rather than assuming the prior document is still accurate, and finds one of them (Top Performers' clipped score column) is **not actually fixed** — the header-overflow fix removed one contributor to it, but not the one that was actually clipping the column.

Every finding below is labeled **Observed** (seen directly), **Measured** (a specific pixel/DOM number), **Inferred** (a reasonable conclusion not directly tested), or **Subjective** (a design judgment call) — per the task's explicit request to keep these distinct.

---

## 1. Executive summary

1. **Two real, measured information-loss bugs exist on mobile that don't exist on desktop**, both P0: the Top Performers table clips its own Performance score/quality label at 375–390px (Measured), and `TeamPlayersDriving`'s "why" text is silently cut off mid-sentence at 375–430px, losing over half the sentence in the worst case (Measured). Both show the *complete* text on desktop. Both are new-to-this-audit or mis-diagnosed-by-the-prior-audit findings — see §3.
2. **Fixture cards truncate most real club names into an ellipsis at every mobile width** (Measured, screenshotted, and directly contradicts the prior audit's "no clipping observed" — see §3): "Crysta…", "Nott'm…", "Newca…", "Ipswic…". The component already has the fix sitting one file away (`TeamMatchHistory` uses `shortName`; `FixtureCard` uses the long `name`).
3. **There is no persistent navigation anywhere in the app** (Measured: zero `position: sticky`/`fixed` elements found on any of the 9 pages tested, at any width). On a 2,819px-tall Match Centre page or a 2,574px player page, reaching Players/Discover/Matches/Teams/My Football again means scrolling all the way back to the top. This is the single largest *navigation-model* gap between "responsive website" and "feels like it was designed for a phone" — see §5.
4. **The things the product has already deliberately redesigned for mobile are genuinely good**, and should be the reference bar, not further work: the Player page, the Team page's overall shape, Discover's category grid, Match Centre's collapsed squad lists, the Top Performers icon-only tab strip, and this session's own My Football module rework. See §11.
5. **A repeating content pattern** — identical caveat sentences repeated verbatim three times in a row on the Player page ("Based on 2 matches so far — an early signal, not yet a proven strength.") — exists equally on mobile and desktop (Observed). It's not a mobile bug, but it directly works against "feels intelligent," which the product context explicitly calls out as core value. Worth a product decision, not a CSS fix.
6. **Small tap targets are a systemic, low-severity pattern**, not a single bug: the season/competition switcher (27px tall), the icon-only "My Football" header button (19×36px), every page's "← back" breadcrumb (~17–20px tall), and the club picker's "Skip for now" link (74×19px) are all below a comfortable ~32–44px touch target, everywhere in the app, all the time (Measured). None of these are broken — they're all tappable — but none of them are comfortable for a thumb.
7. **The one genuinely reusable disclosure primitive the app already built — `CollapsibleSection`, a native `<details>` wrapper — is under-used relative to how useful it clearly is.** It already solved Match Centre's squad-length problem well. It is the direct answer to "how does Custom Best XI show 11+ players on a phone without repeating that problem" — see §7 and §8.
8. **Desktop is not at risk from any of the above.** Every fix identified in this audit is either invisible at desktop widths already (the truncation bugs only trigger under ~440px) or is a `sm:`-gated addition that leaves the existing desktop layout untouched. None of the findings ask "make desktop behave like mobile" — see §9.
9. **Discover, again, is the best mobile page in the app** (Observed, consistent with the prior audit) — bounded category grid, capped top-12 lists, a personalised "Because you follow [club]" tile that ties Discover to My Football without extra chrome. Nothing here needs fixing before the Discover Tab Rework; that rework should treat this page's existing row/grid pattern as its baseline, not a target to change.

---

## 2. Methodology

- Real running app at `http://localhost:3000`, Next.js 16 dev server, live `dev.db` (2026/27 season, gameweeks 1–4 seeded, gameweek 3 in progress as of the app's "current" date).
- Playwright (`chromium.launch()`), fresh `BrowserContext` per test to control `localStorage` (`pl-analytics:preferences:v2`) precisely for the no-club / Man-City-supporter states.
- Widths tested: 375, 390, 430 (mobile), 1280 (desktop). Every page was measured at all four; screenshots were taken at 375 and 1280 for every page, plus targeted crops/scroll-states where a finding needed closer proof.
- Pages covered: Home/Players (`/`), Teams list (`/teams`), Team detail (`/teams/[id]`, Man City), Player detail (`/players/palmer-154`), Matches list (`/matches`), Gameweek view (`/matches/2`), Match Centre for an **unplayed** fixture and a **finished** fixture (`/match/[id]` ×2 — the unplayed one specifically to confirm its short page is a correct empty state, not a bug), Discover (`/discover`), and the personalisation surfaces (header "My Football" dropdown, the club-picker modal, and this session's own My Football module).
- Automated per-page measurement: `document.documentElement` overflow (`scrollWidth` vs `clientWidth`), every interactive element under a 32×24px bounding box, every `overflow-x: auto/scroll` container whose content actually overflows, every `<table>`'s rendered width, every `position: sticky`/`fixed` element, and the page's heading outline.
- Where a metric alone couldn't settle a question (does truncated text actually lose information, does a click really navigate), it was checked directly: `scrollWidth` vs `clientWidth` on the specific text node, `page.click()` + `waitForURL()`, keyboard `Tab`/`Enter` on disclosure controls.
- Source code was read *after* observing behaviour, to find the precise file:line responsible — never used as a substitute for looking at the real page.

---

## 3. Current mobile experience assessment

**The honest headline: this product is closer to "mobile-first" than most web apps at this stage, and it got there through real, targeted work — but two of that work's own fixes are incomplete, and the navigation *model* (not any single page) hasn't been reconsidered yet.**

Nothing catastrophic was found. No page has real horizontal *page* overflow any more (confirmed at every width, every page — the prior audit's header-overflow bug, finding #1 in `MOBILE_EXPERIENCE_AUDIT.md`, is fixed and stayed fixed). No console errors on any page tested, in either personalisation state. The Player and Team pages the prior audit called out as "already right" still are. Discover still is too.

What's left falls into three buckets:

1. **Two real information-loss bugs** (Top Performers score clipping, `TeamPlayersDriving` text truncation) that look like polish issues from a screenshot but are actually the product hiding its own numbers and its own words from a phone user by default, with no affordance that anything is missing.
2. **One data-sampling gap in the prior audit** (fixture card team-name truncation) that a broader test — specifically choosing long club names instead of whatever gameweek happened to be open — surfaced.
3. **One structural, product-level question the prior audit only touched in passing**: there is no persistent chrome anywhere. Every "which section am I in, and how do I get to another one" answer requires either scrolling back to the top or using the browser's own back button. This is the biggest genuine gap between "a responsive website" and "a product that was designed mobile-first."

None of this requires new technology, a new design system, or new components beyond what's already proven in the app (`CollapsibleSection`, the `shortName`+`TeamCrest` identity pattern, `overflow-x-auto` with a fade edge). It requires finishing work that's already half-done, and one real product decision about navigation.

---

## 4. Page-by-page findings

### Home / Players (`/`)

**What's there:** Preview Build disclosure → My Football module (if a club is set) → Discover teaser → Top Performers ranking table with an icon-only category tab strip.

**Already good (Observed):** the My Football module and Preview Build line, both reworked this session, are compact, single-link, and read cleanly at every width tested — no overflow, no nested links, visible focus states (all re-confirmed fresh in this audit, not just carried over from that task's own report). The category tab strip (`components/home/top-performers.tsx:102-171`) is icon-only below `sm`, and **all 7 icons fit with no scrolling needed** at 375/390/430 (Measured) — this is a stronger fix than the prior audit's own suggestion of "add a scroll affordance"; it removed the need to scroll at all. A soft fade-edge affordance still ships for anyone who does need it (`top-performers.tsx:114-117`), so the fix is layered, not just lucky.

**P0 — Top Performers clips its own score column (Measured, screenshotted, contradicts "fixed"):** at 375px, the table wrapper (`top-performers.tsx:184`, plain `<div className="overflow-x-auto">`) needs 332px but has 309px available — at 390px it needs 332px against 324px available. Both clip the right edge of the **Performance** column: the quality label renders as "EXCELLE" instead of "EXCELLENT", and the **Form** column (`hidden ... sm:table-cell`, so correctly absent from layout at these widths) is not the cause — scrolling the wrapper fully right confirms the *Performance* column itself doesn't fit its own content by ~8–23px. At 430px it fits exactly (0px short) — this is a narrow, content-width-driven overflow, not a design-scale problem, which makes it a small, targeted fix rather than a rework. No visual affordance hints that scrolling reveals the rest, unlike the tab strip one section above it. This is the single highest-severity finding in the whole audit: it affects the homepage's core content, at the two most common real phone widths (iPhone SE/13/14/15 and 14/15 Pro), silently.
**P1 — no persistent way back to the tab strip / to Player once scrolled past the table.** Minor relative to the above; folded into §5's navigation finding rather than repeated per page.

### Player detail (`/players/[slug]`)

**Already good (Observed):** the hero (photo, flag, name, club·position, archetype pill, big rating, form pill, sample-size caveat) delivers identity + quality + context in one glance, at every width. "Season Story," "Player Profile," and "Analytical breakdown" are compact, single-purpose blocks with no clipping. The "Key moments" placeholder is honest about why it doesn't exist yet rather than faking data — directly relevant to the future Key Moments/Match Intelligence feature (§8).

**P1 — identical caveat sentence repeated three times verbatim (Observed, equally present at 1280px — not mobile-specific):** the "What stands out" section's three bullets each end with the exact same sentence, "Based on 2 matches so far — an early signal, not yet a proven strength." This isn't a layout bug — it's the underlying insight-voice content repeating itself when a player has a short sample. It reads as noticeably less "intelligent" than the rest of the page precisely because it's a template artifact, and the product's own stated value proposition is "feels intelligent, trustworthy." Flagging for a product/content decision (e.g., one shared caveat above the three bullets), not proposing a fix here — out of this audit's "investigation only" scope, and it isn't mobile-first work at all.
**P1 — "Recent matches" table needs horizontal scroll to see the Rating column, with no affordance (Measured):** at 375/390, the table wrapper needs 365px against 333/348px available; at 430 it fits. Same shape of problem as the Top Performers table, smaller stakes (2 rows, one late-page table) — worth fixing with the same technique, not separately.
**Subjective, low stakes — the Performance Journey chart is visually heavy (a full-width line chart) for 2 data points this early in the season.** This will resolve itself as the season lengthens; not proposing UI work for a data-volume problem.

### Team detail (`/teams/[teamId]`)

**Already good (Observed):** the hero, "Team Overview" prose, "Match History" rows, and the "League Position" mini-table (which correctly drops to `# Club P GD Pts` below `sm` — a genuinely good example of *column reduction* rather than clipping or scrolling) all work well at every width tested, matching the prior audit's assessment.

**P0 — "Players driving the team" truncates real intelligence text mid-sentence (Measured, screenshotted, desktop comparison confirms it's mobile-only):** `components/teams/team-players-driving.tsx:78-80` and `:82-85` both apply Tailwind's `truncate` (`overflow:hidden; white-space:nowrap; text-overflow:ellipsis`) to the "why" reasons line and the archetype line, inside a `min-w-0 flex-1` squeezed between a fixed avatar and a fixed score block. Measured directly on Man City's page at 375px: the worst-case row needs 453px of text but has 158px — **it loses roughly two-thirds of the sentence**, mid-word, with no ellipsis-hover-equivalent on touch (a title attribute isn't reachable without a mouse). The exact same content renders in full on desktop (screenshotted, 1280px, `sm`+ layout gives the row far more room). The prior audit saw this same truncation and called it "sensible... on long combined reason text" — this pass's harder measurement disagrees: this component's own doc comment says its entire purpose is *"plain football language instead of a dashboard label"* — cutting that language off mid-sentence defeats the reason the component was written the way it was.
**P1 (lower-confidence, same pattern, not confirmed to actually trigger with real data) — `TeamWorthKnowing`'s availability-context line** (`components/teams/team-worth-knowing.tsx:52`) uses the identical squeezed-truncate shape. Availability strings tend to be shorter ("Thigh injury · 75% chance of playing"), so this may not currently overflow in practice — flagged because it's the same risky pattern in a second file, worth checking once/if availability text gets longer.

### Teams list (`/teams`)

**Already good (Observed, Measured):** the full league table already reduces to fewer columns below `sm` and never overflows at any width tested — no findings.

### Matches list / Gameweek view (`/matches`, `/matches/[gameweek]`)

**P0 — fixture cards truncate most real club names (Measured, screenshotted, corrects the prior audit):** `components/matches/fixture-card.tsx:26-29` renders `fixture.homeTeam.name` / `fixture.awayTeam.name` — the **full** club name — next to a 40px crest and a score block, with `truncate` on the name span. Tested against Gameweek 2's real fixtures at 375px: "Crystal Palace" → "Crysta…", "Nott'm Forest" → "Nott'm…", "Coventry City" → "Coven…", "Newcastle" → "Newca…", "Brentford" → "Brentf…", "Brighton" → "Bright…", "Ipswich Town" → "Ipswic…", "Man Utd" → "Man U…", "Aston Villa" → "Aston …" — **9 of 10 fixture rows** in the tested gameweek truncate on at least one side. At 1280px, the same component shows every name in full (more horizontal room per card). The fix is already proven elsewhere in the same app: `components/teams/team-match-history.tsx` renders the identical kind of row using `opponentShortName` ("CRY", "NFO", "COV") instead of the full name, and never truncates. This reads as a real, if narrow, inconsistency — one fixture-row component picked the long name, a near-identical one picked the short one, and only the long-name choice breaks on a phone. The prior audit tested a gameweek with shorter names by chance and reported "no clipping observed" for this exact component — this is a correction to that finding, not a new regression.
**Already good (Observed):** the gameweek prev/next controls, the fixture rows' three independent tap targets (home team / match / away team, ~38-40px tall — confirmed still comfortably sized), and the overall page rhythm are otherwise fine.

### Match Centre — unplayed fixture (`/match/[id]`)

**Already good (Observed, Measured):** for a fixture that hasn't kicked off, the page correctly renders a minimal state — score header, "UPCOMING," kickoff date/time, one sentence ("This match hasn't been played yet.") — and nothing else. Document height was exactly the viewport height at every width tested; zero headings beyond the score header, by design, not by bug. Confirmed this is the correct behaviour, not a broken page, by testing a second, finished match.

### Match Centre — finished fixture (`/match/[id]`)

**Already good (Observed, the single strongest confirmation in this audit that the prior audit's fix landed):** at 375px, the page is 2,819px tall and covers "What happened" (one-sentence narrative), 4 snapshot stat tiles, a Match Standout card, a Team Performance bar, "Who ran the show," Match Events, Squad Performance, and the Match Timeline placeholder — and it's genuinely readable end to end, not a wall of near-identical rows. **Squad Performance — the prior audit's ~4,600px, "over 11 screens" finding — is now two `CollapsibleSection` disclosures per team (Starting XI, Substitutes), collapsed by default on mobile** (confirmed: `open` attribute absent at 375px) **and fully expanded, side-by-side, on desktop** (confirmed: both XIs and both bench lists fully visible, unwrapped, at 1280px). This is exactly the right shape of fix — same information, presented differently per width, nothing removed — and it's the strongest evidence in the app that the "responsive, not shrunk" instinct works when it's actually applied.
**P2, Subjective — "Who ran the show" stacks the two teams' 4-row blocks vertically on mobile (8 rows total) where desktop shows them side by side (4 rows tall):** roughly double the scroll for the same content. Not a bug — every row is legible and the section isn't long in absolute terms (~350–400px) — but a natural candidate for a segmented/tab control (see §6) if Match Centre's overall length becomes a priority again.
**Native-mobile relevant (Inferred):** the Match Timeline "Coming soon" placeholder — honest about the data-source gap rather than guessing — is the natural anchor point for Key Moments/Match Intelligence; see §8.

### Discover (`/discover`)

**Already good (Observed, Measured — reconfirms the prior audit, which called this "the best mobile page in the app"):** the 2-column category tile grid (6 tiles, ~140px tall each — comfortably above any touch-target minimum) reflows to the same grid at every mobile width without overflow; the selected category's result list is a clean, capped-at-12, single-line-per-row list with no truncation, no clipping, identical row count at 375px and 1280px (just 1-column vs 3-column). The personalised "Because you follow MCI" tile — Discover surfacing something specific to the user's own supported club, without any extra chrome — is a good, already-working tie between Discover and My Football.
**No findings.** Per the task's explicit instruction, Discover was not redesigned or deeply critiqued here — only assessed for constraints the forthcoming Discover Tab Rework should inherit (see §7's closing note and Roadmap-style guidance folded into §12).

### My Football / personalisation surfaces

**Already good (Observed, Measured, re-verified fresh in this audit rather than assumed from the prior session's own report):** the club-picker modal's crest buttons are 94×86px — genuinely excellent touch targets, no finding needed. The header's icon-only "My Football" affordance correctly shows the supported club's own crest once one is picked (more recognisable than a generic icon). The home-page My Football module (this session's own rework) is a single link with a visible focus ring, no nested anchors, and a compact secondary facts row — confirmed still true under this audit's independent re-test.
**P2 — the picker's "Skip for now" link is small (74×19px, Measured)** — the one soft spot in an otherwise well-sized modal, and the first interaction most new users on mobile actually have with the app if they land without a club pre-selected.

---

## 5. Navigation assessment

**Is it obvious where the user is?** Yes, on desktop (an accent underline on the active nav item, confirmed for Players/Discover/Matches/Teams and for My Football specifically on the supported club's own page — `components/layout/header-nav.tsx:44-58` deliberately keeps Teams and My Football from both lighting up on the same page). On mobile, the same logic runs, but the *nav itself* is reduced to a single icon-only "My Football" affordance below `sm` — the four primary section links (Players/Discover/Matches/Teams) are simply not present as tappable items on a phone at all; they only exist via... nothing. There is no icon row, no hamburger, no bottom bar. **Reaching Discover, Matches, or Teams from a mobile session requires the browser's own back/forward or an in-page link that happens to go there** (a team crest, a match card). This is worth stating precisely: it's not that mobile navigation is *cramped* — the prior audit's original bug — it's that most of desktop's primary navigation **doesn't exist on mobile at all** any more, having been traded for the (correct, and needed) header-overflow fix. That fix solved the overflow; it didn't replace what was removed to achieve it.
**Comfortable with a thumb?** The things that remain (crest, competition switcher, icon-only My Football) are all reachable, but small (§4, §7). The club-picker's own crest grid, by contrast, is excellent — proof the team already knows how to size mobile touch targets well when building a mobile-specific surface from scratch.
**Reach-to-top-of-screen:** confirmed as a real, systemic issue (Measured: zero sticky/fixed elements found across all 9 pages × 4 widths). Every one of this audit's longest pages (Match Centre 2,819px, Player 2,574px, Team 1,915px) requires scrolling back to y=0 to reach the header at all.
**Buried destinations:** Discover, Matches, and Teams are not buried in the sense of being hard to find *once you know to scroll up* — they're simply absent from the viewport for the entire time a user is reading page content on a phone.
**Back-navigation:** each page has its own single "← [context]" breadcrumb (e.g. "← Top performers," "← Gameweek 2," "← Premier League table"). The prior audit already found these are fixed-default, not provenance-aware (a match reached via a team's own match history still says "← Gameweek 2," never "← Arsenal") — re-confirmed still true, not re-tested exhaustively this pass since it wasn't the audit's focus. Given finding #3 above (no persistent chrome), these breadcrumbs are now the *only* wayfinding control visible without scrolling — which raises their importance versus the prior audit's "Medium" severity call.
**Context retention:** not deeply re-tested this pass (Next.js App Router's own scroll restoration is a reasonable default and nothing observed contradicts it) — noted as an area the broader UX audit, not this one, should verify.

**Should mobile just collapse the desktop nav, or does it need a different interaction model?** Based on what's actually observed — real content on real pages, at real length — a different interaction model is the more honest answer than "collapse and hope the crumbs are enough." A **bottom navigation bar** (Players/Discover/Matches/Teams/My Football, 5 items — matching the existing primary-nav count exactly) is worth serious consideration specifically *because*:
- The app already has exactly 4–5 primary destinations, no more — a bottom bar's classic constraint (don't exceed ~5 items) is already satisfied by the existing IA, not something that would need to be invented.
- It solves the reach-to-top problem directly, is always one thumb-reach away regardless of scroll position, and is the single most literal answer to the task's own question about whether persistent navigation would help.
- It's additive, not a replacement: the existing header (logo, season switcher, breadcrumbs) can stay exactly as-is: a bottom bar does not require touching the top of the page at all.
This is a **reasoned recommendation, not an implementation** — see §9 for why this is mobile-only, and §12 for where it should sit in a sequence.

---

## 6. Information architecture assessment

**What's the first thing a user sees, and is it the right thing?** On every content page tested, yes: Player and Team pages lead with an identity+score hero; Match Centre leads with the score and a one-sentence narrative before any stats; Home leads with My Football (if relevant) then the flagship ranking. This is consistent, deliberate, and already the product's strength — nothing here needs to change.
**Do pages have a narrative, scannable without reading every card?** Mostly yes. Match Centre in particular reads as a narrative arc (what happened → who stood out → the numbers behind it → the full squad, on demand) rather than a flat stat dump — a genuinely strong example. The one place this breaks down is the Player page's "What stands out" section (§4), where three bullets *look* like three distinct pieces of intelligence but all end identically — the narrative promise ("here are three different things worth knowing") isn't quite kept once you actually read past the bold headline of each.
**Are secondary facts competing with primary intelligence?** Generally no — this is one of the product's stronger instincts (evident in this session's own My Football rework, and in Match Centre's stat-tiles-then-detail ordering). The one place secondary facts genuinely compete for space rather than attention is the Top Performers table, where the *mechanism of showing* the primary number (a `<table>` with breakpoint-toggled columns) is what's failing, not the hierarchy itself.
**Density vs importance:** the app is not over-dense for what it's showing. The League Position mini-table, Match History rows, and Team Overview prose are all appropriately compact for their importance. The genuine density problem found this pass is Player detail's "Season Story" area during a very-early-season sample (2 matches): a full narrative paragraph, a 4-stat row, and a 2-point line chart together for content that's inherently thin right now — not a bug, a temporary side-effect of early-season data volume that will resolve as more matches are played, flagged as Subjective/low-priority rather than something to build around.

---

## 7. Repeated / systemic UX patterns

Per the task's instruction to name system-level patterns rather than page-by-page fixes, four repeat across the app:

1. **"Squeeze text between a fixed avatar and a fixed score block, then `truncate` it" appears in at least two components** (`team-players-driving.tsx`, `team-worth-knowing.tsx`) and is the exact shape of both P0 truncation findings in §4. This is the pattern to fix once, as a shared instinct ("secondary description text wraps to 2 lines before it's allowed to truncate, on mobile specifically"), not per-component.
2. **"Show the full club/player name, not the short one, next to a crest" is the one place the app's otherwise-consistent identity pattern (`shortName` + `TeamCrest`, used everywhere else: header, tables, League Position, Team Match History) gets abandoned** — `FixtureCard` — and it's exactly where the truncation bug lives. The fix already has a template one file away.
3. **`overflow-x-auto` without a scroll affordance appears on two data tables** (Top Performers, Player's Recent Matches) that both clip real content at mobile widths — the exact problem the app already solved, with a fade-edge div, for the category tab strip in the very same file as one of the two tables. The fix pattern exists; it just wasn't applied to the table sitting directly below it.
4. **`CollapsibleSection` (`components/ui/collapsible-section.tsx`) is the one clearly-proven "many items, one screen" answer already in the app**, and it's currently used in exactly one place (Match Centre's squad lists). It's a small, generic, native-`<details>`-based primitive that already knows nothing about football — it just knows "a label, an optional count, some children to reveal." This is directly relevant to §8's forward-looking question: Custom Best XI (11+ players), Player Comparison (potentially many metrics per player), and any denser future Match Intelligence surface are all, structurally, "more items than comfortably fit on a phone screen at once" — the same shape of problem Match Centre already solved. The systemic recommendation is to **treat `CollapsibleSection` as the default answer to that shape of problem**, not to invent a new disclosure pattern per feature (which is exactly the risk the prior audit's own Roadmap section flagged for Best XI).

---

## 8. Native-mobile implications

Not a recommendation to build a native app — identifying where today's web-first architecture would want a fundamentally different model if/when one exists, so that direction is informed rather than retrofitted.

- **Navigation:** the header-nav model (a shared top bar, collapsing to one icon below `sm`) is a web pattern. A native app would almost certainly default to persistent bottom tabs from day one — which is exactly what §5 recommends considering for the web product too, specifically because doing so now establishes the same mental model a native app would want later, rather than teaching users one pattern on web and a different one in a future app.
- **Persistent context:** the total absence of sticky/fixed chrome (§5) is invisible in a native app, where tab bars and nav bars are structurally always present — this is a case where the web product's current gap is *more* visible than it would be natively, worth fixing regardless of any native plans.
- **Sheets/drawers for disclosure:** `CollapsibleSection`'s inline expand-in-place model works well on web. A native app would more likely use a bottom sheet or a dedicated screen for "show me the full squad" or "show me all 11 Best XI candidates at this position" — worth knowing that the *content model* (a bounded, labeled, revealable group of items) transfers directly even if the *presentation* (inline vs. sheet) would differ. Building Best XI's "many players" answer around that content model now, rather than around inline-`<details>` specifics, keeps the door open.
- **Gestures:** nothing in the current product relies on or blocks swipe gestures. The gameweek prev/next links (already text-link based, not gesture-based) and Match Centre's team-vs-team blocks are both plausible future swipe candidates, but nothing observed today would need to change to add that later — noted as a future opportunity, not a current gap.
- **Transitions between entities:** the Player → Team → Match → Opponent exploration loop (already fully linked, per the prior audit's own verification) is currently a sequence of full page loads. A native app would likely want shared-element transitions (crest morphing from a list row into a hero, for instance) — not something to build today, but worth knowing the current *link graph* is already the right shape for it; only the transition mechanics would need to change later.
- **Touch-first controls:** the systemic small-tap-target pattern (§7's cousin, listed per-instance in §4) is the one area where "make mobile web more comfortable" and "prepare for native" point at exactly the same fix — increasing padding on the season switcher, the icon-only My Football button, and back-breadcrumbs benefits both today's mobile web users and sets the right minimum-touch-target instinct for later.

---

## 9. Desktop impact assessment

Every recommendation above, classified:

| Recommendation | Classification | Why |
|---|---|---|
| Fix Top Performers' clipped score column | **Mobile-only** (`< sm`) | Desktop already shows the full table correctly; the fix is a narrower-width cell budget below `sm`, not a redesign of the table. |
| Fix `TeamPlayersDriving` text truncation | **Responsive/adaptive** | Likely: allow 2 lines instead of 1 below `sm` (desktop already has room for 1 full line; no desktop change needed, but the underlying rule — "wrap before truncating, on narrow widths" — is a width-conditional rule, not two separate implementations). |
| Fix `FixtureCard` team-name truncation | **Shared across mobile and desktop** | The actual fix (`shortName` instead of `name`) is not width-conditional — it's the same identity pattern `TeamMatchHistory` already uses everywhere, and would make the card *more* consistent with the rest of the app at every width, not just mobile. |
| Add a scroll-affordance fade to the two remaining un-affordanced tables | **Shared, low-risk** | The tab strip's existing fade (`top-performers.tsx:114-117`) is already `sm:hidden` — i.e. already scoped to mobile only, by the team's own prior choice — the same scoping is the obvious template to reuse, not a new decision. |
| Persistent/bottom navigation | **Mobile-only, avoid on desktop** | Desktop's top header nav already works well (confirmed: no findings against it at 1280px) — a bottom bar would be redundant chrome on desktop, not an improvement. This should not become a responsive variant of the same component; it's a genuinely separate, mobile-specific addition. |
| Increase small tap targets (season switcher, icon-only My Football, breadcrumbs) | **Mobile-only for sizing, shared for the underlying markup** | Desktop tap-target comfort isn't a real concern with a mouse pointer — but padding-only changes (not visual size changes) can often apply universally without desktop even looking different; where they would visibly grow a desktop element, gate to mobile. |
| Reduce the "What stands out" repeated caveat | **Shared** (it's a content/data-shaping question, not a layout one) | Not a mobile-specific bug — applies identically at every width; any fix belongs to the insight-voice content system, out of this audit's scope, not to responsive CSS. |
| Treat `CollapsibleSection` as the default "many items" pattern for Best XI / Comparison | **Shared, width-adaptive per-feature** | Match Centre's own precedent already does this correctly: collapsed on mobile, open on desktop, same component, same data — the pattern itself is inherently desktop-safe already. |

**Nothing in this audit asks desktop to behave more like mobile.** Every fix either only fires below a breakpoint that desktop never reaches, or improves consistency (the `shortName` fix) in a way that benefits every width equally.

---

## 10. Prioritised recommendations

### P0 — genuine mobile usability problems (product hides its own content)

1. Top Performers table clips the Performance score/quality label at 375–390px, with no scroll affordance. (`components/home/top-performers.tsx:184-193`)
2. `TeamPlayersDriving` truncates "why" and archetype text mid-sentence at 375–430px, losing up to ~2/3 of the sentence. (`components/teams/team-players-driving.tsx:74-86`)
3. `FixtureCard` truncates most real club names into an unreadable ellipsis at every mobile width tested. (`components/matches/fixture-card.tsx:26-51`)

### P1 — significant mobile UX problems (works, but materially less intuitive/polished)

4. No persistent navigation anywhere in the app — every section switch on a long page requires scrolling to the top. (Structural — §5)
5. Player detail's "Recent matches" table needs an un-affordanced horizontal scroll at 375–390px. (`app/players/[slug]/page.tsx` — same shape as #1, smaller stakes)
6. `TeamWorthKnowing`'s availability-context line uses the same at-risk truncation pattern as #2, unconfirmed to currently trigger with real data but worth a look. (`components/teams/team-worth-knowing.tsx:52`)
7. Back-navigation breadcrumbs are fixed-default, not provenance-aware — rising in importance now that they're effectively the *only* wayfinding control visible on a scrolled mobile page. (Carried forward from the prior audit, re-confirmed still relevant.)
8. The "What stands out" section repeats an identical caveat sentence three times — a content/voice issue, not layout, equally present on desktop, but directly relevant to the product's "feels intelligent" value proposition.

### P2 — refinements (worth doing, not worth interrupting Best XI for)

9. Systemic small tap targets: season switcher (27px), icon-only My Football button (19×36px), every page's "← back" breadcrumb (~17-20px), club-picker "Skip for now" (74×19px).
10. "Who ran the show" stacks two teams' blocks vertically on mobile (8 rows) vs. side-by-side on desktop (4 rows) — a segmented/tab control is a plausible future refinement, not urgent.
11. Season Story's 2-point performance chart is visually heavy for how little data exists this early in the season — will likely resolve itself as the season lengthens.

### Already good — explicitly do not change

- The Player page's overall structure and density (post the prior condensation pass) — still the reference bar.
- The Team page's overall structure, and `TeamPlayersDriving`'s row *pattern* specifically (only its truncation width-budget needs fixing, not its shape).
- Discover's category grid + capped-list pattern.
- Match Centre's `CollapsibleSection`-based squad disclosure — collapsed on mobile, expanded on desktop, same data.
- Top Performers' icon-only mobile tab strip and its fade-edge affordance.
- The club-picker modal's crest grid (94×86px touch targets).
- This session's My Football module rework and the Preview Build disclosure — re-verified independently in this audit, still holding up.
- `FixtureCard`'s three-way link split (home team / match / away team) — correctly sized, unambiguous; only its *text content* (full name vs. short name) needs to change, not its link structure.
- The football-voice presentation (Season Story prose, Match Standout narrative) — text-first, no oversized joke card, unchanged and working on mobile.

---

## 11. What should remain unchanged

Restated from §10's "Already good" list for visibility, per the task's explicit request that this category matter as much as the problems: **the Player page, the Team page's shape, Discover, Match Centre's disclosure pattern, the Top Performers tab strip, the club picker, and this session's My Football/Preview Build work should all be left alone.** Several of these were flagged as strengths by the *prior* audit too and have held up under this pass's harder, broader-sample re-testing — they are not "good for now," they are the parts of the product that already demonstrate the standard the rest should be brought up to.

---

## 12. Recommended implementation sequence

1. **Fix the two P0 truncation/clipping bugs together** (#1, #2) — same root shape (content that needs more room than a fixed-width flex slot gives it below `sm`), plausibly a shared small fix pattern, highest severity, both on pages every user hits early (Home, any Team page).
2. **Fix `FixtureCard`'s club-name truncation** (#3) — small, isolated, has a working template one file away (`TeamMatchHistory`), touches Matches/Gameweek/Team pages at once.
3. **Add the same scroll-affordance fade to the two remaining un-affordanced tables** (#5, part of the same pass as #1 if any residual scroll remains after the width fix).
4. **Decide on persistent/bottom navigation** (#4) — the one item here that's a product decision, not a bug fix; worth resolving before Custom Best XI adds a new primary surface that would also need to be reachable from wherever a user currently is on a phone.
5. **Tap-target sizing pass** (#9) — low-effort, contained, no dependencies on anything above.
6. **Provenance-aware back links** (#7) — carried forward from the prior audit; rising, not falling, in urgency as cross-linking increases.
7. **Content-layer items** (#8, and the broader Player/Team voice-repetition question) — route to whoever owns the insight-voice system, not the mobile UX track; unrelated implementation surface.

This front-loads the two confirmed information-loss bugs (matching the prior audit's own instinct to fix genuine bugs before rhythm/architecture work), places the navigation-model decision before Best XI specifically (a new primary feature is exactly when "how do users get here from anywhere in the app" stops being optional), and keeps the content-voice finding out of the mobile-UX implementation track entirely, since it isn't one.

---

## 13. Top 5–10 mobile-first decisions

If this product were being designed today primarily for phones, these are the structural decisions that would plausibly be made differently from where the current implementation stands:

1. **Bottom navigation would exist from day one**, not be arrived at later as a retrofit — the app already has the right item count (4–5) for it, and it would eliminate the "scroll to the top to change section" problem this audit found on every long page, rather than mitigating it per-page with breadcrumbs.
2. **Tables would not be the default shape for ranked/tabular data** — Top Performers and Player's Recent Matches both reach for a `<table>` with breakpoint-toggled columns first; `TeamPlayersDriving`'s row pattern (avatar, name, one clean number, description that wraps rather than truncates) already proves a non-table alternative works well in this exact app, for this exact kind of content.
3. **Identity would consistently mean "crest + short name," never "crest + full name," everywhere** — the one inconsistency found this pass (`FixtureCard`) is the one place that breaks on a phone; a mobile-first product wouldn't have two different answers to "how do I show a club" in the first place.
4. **Progressive disclosure (`CollapsibleSection`'s shape) would be the default answer for "more than ~5 of the same kind of item," decided once, not per-feature** — Match Centre already proves this works; a mobile-first product would reach for it by default for Best XI, Comparison, and anything else with that shape, rather than each feature re-deciding independently.
5. **Back-navigation would be built provenance-aware from the start**, not as a fixed default per page — once there's no persistent chrome to reorient with (decision #1 changes this, but a mobile-first product built after deciding on persistent nav might still want honest breadcrumbs for deep entity-to-entity exploration).
6. **Long-tail sample-size caveats would be composed once per section, not once per bullet** — the "What stands out" repetition is a symptom of building each insight card independently; a mobile-first pass (where vertical space is genuinely scarce, unlike desktop) would have surfaced this immediately rather than after the fact.
7. **Touch-target sizing would be a default (e.g. a minimum interactive-element height baked into the design tokens), not a per-component judgment call** — the season switcher, breadcrumbs, and icon-only nav button all independently landed under 32px; a shared minimum would have prevented all three at once rather than needing three separate fixes now.
8. **Match Centre's team-vs-team comparison blocks ("Who ran the show," and similarly-shaped future sections) would default to a segmented/tab control below a width threshold**, not vertical stacking — cheap on both engineering effort and vertical space, and the two-teams-compared shape recurs (Team Performance, Who Ran the Show) enough to be worth deciding once.
9. **Horizontally-scrolling regions would ship with their scroll affordance from the first version**, not added after a user reports the content "disappeared" — the tab strip got this right eventually; a mobile-first process would treat the affordance as part of the same PR as the scroll container, every time, not a follow-up.

---

*Investigation complete. No application code, tests, schemas, or analytics were modified to produce this document.*
