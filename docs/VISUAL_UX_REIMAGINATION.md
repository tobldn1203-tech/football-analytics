# Visual & UX Reimagination — Design Exploration

**Status: ideation only.** No production code changed. Everything below is grounded in the actual current codebase (exact file/component names, exact token values, exact data available) — not aspirational hand-waving. Where a claim depends on a fact (a colour value, an image URL pattern, a component's existing behaviour), that fact was verified by reading the real source, referenced inline.

This document does not recommend touching scoring, methodology, data, or routes. It is a presentation-layer reimagining of an application whose analytics are already sound.

---

## 1. Current visual/UX diagnosis

Not "the colours could be better." Twelve specific, verifiable problems:

1. **No focal point on entry.** The homepage's actual first content (`app/page.tsx`) is: a collapsed `<details>` disclosure ("Preview build") → `MyFootballWidget` (renders **nothing** — returns `null` — for any visitor without a supported club, which is every first-time visitor) → `DiscoverTeaser` (one link-sized callout) → the Top Performers table. A first-time visitor's actual first *visible* content is a small link and then a data table. Nothing on the page is built to produce a reaction.

2. **The one cinematic idea the app has is reused identically three times, which cancels its own effect.** `TopPerformers`, the player page, and the team page each independently build a `data-hero` block: `bg-[var(--hero-bg)]` + one absolutely-positioned `blur-3xl` radial glow circle + a Fraunces headline. Same recipe, same glow shape, same size band (`h-64 w-64` / `h-56 w-56` / `h-40 w-40`), three places. By the third repetition it reads as "the header component," not a moment.

3. **Density arrives with no lead-in.** The homepage goes from a nav bar straight into a 15-row, 6-column table with category tabs. Powerful, correct, and exactly what the brief calls "opening a statistics dashboard" rather than "opening a sophisticated piece of intelligence software."

4. **Typography is decorative, not architectural.** Fraunces (the serif, `--font-display`) appears in maybe six isolated spots — H1s, score numerals. Everything else sits in an 11–16px band of Geist Sans. There's no real type *scale* — nothing but colour/weight currently separates "the most important number on the page" from "a caption," because they're often the same size.

5. **Card sameness.** `MyFootballWidget`, `DiscoverTeaser`, `TeamWorthKnowing`, and others independently converge on the same shape: `rounded-xl border`, a 3px left-accent stripe, `hover:bg-[var(--color-surface-2)]`. Correct and consistent — but by the fourth instance the page reads as a stack of similar containers, not a composed environment.

6. **One glow is the app's entire depth vocabulary.** No layering, no parallax, no z-axis storytelling — a blurred circle at three sizes is the extent of it.

7. **Light mode was never designed — it was derived.** `app/globals.css`'s `:root` block defines the *light* palette first; dark mode is a `@media (prefers-color-scheme: dark)` override of exactly 12 tokens (surfaces, ink, the four semantic accent pairs). The `--hero-*` band (`#0b0e1c`, the dark editorial masthead) is **pinned to the same values in both themes** — it never inverts, by design, which is fine for a masthead but means dark mode's one genuinely atmospheric idea never touches light mode at all. Light mode is `--color-canvas: #faf8f3`, `--color-surface: #ffffff`, `--color-border: #e1e3e8` — warm-neutral, low-contrast, zero gradient, zero atmosphere. This is precisely the "conventional SaaS light mode" the brief names as the thing to leave behind.

8. **No manual theme control.** Theme is 100% `prefers-color-scheme`-driven (confirmed: no `data-theme` attribute, no class toggle, no switch UI anywhere in the codebase). Whatever direction is chosen, light mode has to earn its own atmosphere — it can't lean on "well, dark mode already looks good."

9. **Motion is micro, never macro.** The only two animations that exist are `grow-bar` (a 0.6s bar-fill `scaleX`) and `animate-reveal` (an 18ms-ease row-expand). Both are genuinely well-judged, purposeful micro-interactions. But there is zero entrance choreography, zero scroll-driven reveal, zero cross-page transition — moving from a League Leader to their Player page to their Club page is three independent document loads, not one continuous experience.

10. **League → Club → Player has no persistent visual thread.** Each page rebuilds the same masthead recipe from scratch; nothing carries an identity across the navigation, even though the data relationship (this player, at this club) is exactly what the user is following.

11. **Real imagery is used at avatar scale only.** `lib/assets/images.ts` confirms the app has access to real, licensed Premier League player photography — the same CDN the official FPL app uses (`https://resources.premierleague.com/premierleague/photos/players/...`). Three fixed sizes are defined (`PHOTO_SIZES = { sm: "40x40", md: "110x140", lg: "250x250" }`), but **every call site in the app today defaults to `md` (110×140) — `lg` (250×250) is defined and available but is not requested anywhere** (confirmed by grep across every `getPlayerPhotoUrl(...)` call). The biggest rendering of any of it is a 108px circular avatar (`PlayerAvatar`'s `"xl"` size, used once, on the player-page hero). A real, higher-resolution asset is already one argument away and is never used.

12. **Personality currently lives in emoji.** Archetype icons (`🧤🧱🏃⚖️🎯🔁⚽🌟`), Discover category icons, the "⚽ My Football" fallback button — all emoji. Fast to ship, has real character, but renders inconsistently across platforms and can't carry brand colour, weight, or motion the way an owned icon system can. Worth flagging, not urgent to fix.

**What is *not* broken and must not regress:** mobile has had serious, specific engineering already (`BottomNav`, icon-only category tabs below `sm`, `table-fixed` layouts with measured column budgets, horizontal-scroll fade affordances, safe-area padding) — documented across `docs/MOBILE_FIRST_PRODUCT_AUDIT.md` and `docs/MOBILE_EXPERIENCE_AUDIT.md`. The gap this document addresses is **emotional/atmospheric**, not structural. The job is to add cinematic identity on top of an already-solid responsive foundation, not to fix broken mobile UX.

---

## 2. What the product should feel like

**North star:** opening a piece of football intelligence built by people who were *at* the stadium, not people who were looking at a spreadsheet of it.

Concretely, the product should feel:
- **Lit, not decorated.** Every glow, gradient, or rim-light should read as *light falling on something real* (a player, a pitch, a club colour) — never as an abstract "futuristic" texture applied on top.
- **Confident in stillness.** Most of the interface should be quiet, precise, legible — cinematic doesn't mean busy. The spectacle is concentrated in a small number of deliberate moments (League Leaders, a page transition), not smeared across every card.
- **Continuous.** League → Club → Player should feel like moving through one place, not opening three documents.
- **Honest at every resolution.** The same intelligence, expressed at the right density for the surface — a phone gets the full emotional hit, not a cropped desktop leftover.

**Explicit translation of the brief's constraints into design principles** (so directions can be graded against something concrete):
- If an effect doesn't communicate hierarchy, performance, or discovery, it doesn't ship — regardless of how "futuristic" it looks in isolation.
- Nothing invents data, imagery, or claims. Every visual must trace back to a number or sentence the engine already produces.
- Motion answers "why is this moving" or it doesn't move.
- Light mode gets its own lighting concept — not the dark palette with the values flipped.

---

## 3. Five design directions

Each direction is graded honestly, including the user-proposed one — see its risk assessment below, and §4 for how its best idea survives into the recommendation without the direction itself being adopted wholesale.

### A — Broadcast Graphics ("Matchday Graphics Package")

- **Philosophy:** the product as the on-screen graphics package of a Sky/Amazon/DAZN broadcast — lower-thirds, team-of-the-week reveals, scoreboard numerals.
- **Visual language:** full-width broadcast-safe colour bars, bold tabular numerals (the app already has `.tabular` / `font-variant-numeric: tabular-nums`), sharp geometric dividers instead of rounded cards, name-plates that slide in like a broadcast lower third, a small "live" dot for the current gameweek.
- **Homepage structure:** League Leaders as a sequential "Team of the Week" reveal strip (#1 slides in, holds, #2, #3); League Table as the "standings graphic"; My Football as a personalised lower third.
- **Navigation:** a persistent top "channel strip," section tabs styled like broadcast idents.
- **Mobile experience:** genuinely strong — lower-thirds are natively narrow-format graphics, they translate to phone width without adaptation.
- **Motion language:** sequential *cut/wipe* reveals (not fades), odometer-style stat count-ups.
- **Strengths:** instantly legible "sports intelligence broadcast" register; leans on tabular-numeral discipline already in the codebase; very mobile-friendly by construction.
- **Risks:** broadcast graphics are designed to be on screen for four seconds, not browsed — risks feeling like a TV-overlay mockup rather than a lingering product; can tip into "just a scoreboard," losing the "intelligence software" half of the brief.

### B — Orbital Performance Universe (the brief's own proposed idea, evaluated honestly)

- **Philosophy:** literalise "performance as spatial phenomenon" — players as bodies with mass, metrics as orbiting satellites, trends as literal trajectories through space.
- **Visual language:** deep space-black canvas, star-field texture, glowing connected nodes, a radial "gravity well" sized to score, orbital rings for percentile bands.
- **Homepage structure:** League Leaders as three "planets" in a star-field, each with orbiting satellite icons for standout metrics; scrolling reads as the camera travelling deeper into the universe.
- **Navigation:** a literal star-map / hub, sections as distant clusters you travel between.
- **Mobile experience:** the weakest of the five. Genuine spatial depth and orbit-drag interactions need screen real estate a phone doesn't have; an orbit diagram on a 375px screen becomes a cramped blob, and drag-to-rotate gestures collide with normal scrolling.
- **Motion language:** parallax star drift, continuously orbiting satellites, zoom transitions between pages.
- **Strengths:** the most visually unclaimed territory of the five — nothing in football software looks like this; strongest "futuristic" signal in isolation.
- **Risks — the decisive ones:**
  - Fails the brief's own test twice over: "do not create fake 3D or unnecessary animation simply because it sounds futuristic," and an orbit has no intrinsic football meaning — a satellite circling a striker doesn't communicate anything about his finishing without invented justification.
  - A continuously-orbiting satellite is animation with no "why is this moving" answer other than "it looks cool" — the brief explicitly rules this out.
  - To look genuinely good (not like a CSS pastiche of the idea) it realistically needs a canvas/WebGL layer — this codebase has **zero** 3D/animation dependencies today (`package.json` confirmed: no `three`, `framer-motion`, `gsap`, or equivalent). That's the single largest new-dependency, new-failure-surface commitment of any direction here.
  - Continuous ambient motion is battery-hostile on mobile and the first thing `prefers-reduced-motion` has to defeat — the direction's *signature* effect is the one most at odds with the brief's own accessibility instruction.
  - Ends up in the same trap as "another SaaS dashboard with glassmorphism" — just a fancier, more expensive version of "abstract sci-fi texture bolted onto cards."

### C — Editorial Cinema

- **Philosophy:** prestige sports documentary / print magazine. The app already has this DNA — its own module comment literally calls the current Top Performers header "a dark editorial masthead." Push that identity all the way instead of treating it as one recycled header recipe.
- **Visual language:** huge serif numerals as the actual visual anchor (not a decorative flourish), an asymmetric editorial grid rather than symmetric cards, full-bleed **duotone** player photography tinted with club colour (also the honest answer to the 250×250 resolution ceiling — strong duotone reads as intentional art direction at low source resolution in a way a small full-colour photo never does), pull-quote-scale intelligence sentences in serif italic, thin hairline rules instead of boxed borders.
- **Homepage structure:** League Leaders as a magazine "cover story" — one dominant #1 with a huge duotone portrait and giant serif numeral, #2/#3 as smaller "also in this issue" sidebars. A real hierarchy, not three equal cards.
- **Navigation:** minimal, text-led, closer to a magazine's running section headers than app tabs.
- **Mobile experience:** very strong — magazine layouts collapse naturally to one scrolling column; large serif type gets *more* room to breathe on a phone, not less.
- **Motion language:** restrained — cross-fades, a slow parallax on the hero photo (photo moves slower than the text over it, a standard editorial/documentary technique), score count-ups as the one kinetic flourish.
- **Strengths:** lowest implementation risk of the five (builds on an identity already half-present); scales beautifully to mobile; typography-led design is accessible and ages well by construction.
- **Risks:** "premium editorial" can read as *sleepy* if not paired with real energy somewhere — risks under-delivering on "futuristic"/"cinematic" if executed too quietly; leans entirely on the duotone treatment's execution quality to feel premium rather than plain.

### D — Floodlit (Night Match)

- **Philosophy:** the product's atmosphere *is* football at its most cinematic real moment — walking out of the tunnel into a floodlit stadium on a European night. Every visual decision maps to something that actually exists in football, not to an abstract "space/tech" metaphor.
- **Visual language:** near-black stadium-night ground (this already exists almost verbatim — `--hero-bg: #0b0e1c`); floodlight "beams" as directional vertical gradient shafts (not radial blobs — a beam, not a bubble); players rim-lit in their own **club colour** (an art-directed evolution of the spotlight `color-mix(in srgb, ${getTeamColor(...)} 35%, transparent)` trick already used, verbatim, on the player-page hero today); faint pitch-line hairlines as a background texture/divider motif; turf-green used as a rare, precise accent, reframed as "the exact green of the pitch under lights" rather than an arbitrary brand lime.
- **Homepage structure:** League Leaders as three players walking out under their own club-coloured floodlight, standing on one shared "pitch" baseline — a composed scene, not three cards.
- **Navigation:** the active section can genuinely be "lit" — a soft glow under the active nav icon rather than a flat accent underline.
- **Mobile experience:** the strongest fit of the five. A vertical floodlight beam and a rim-lit portrait cutout are *inherently* portrait-format — a fan's phone photo of a floodlit ground is already a vertical cinematic shot. This is the one direction whose signature motif gets *better*, not worse, on a phone.
- **Motion language:** an extremely slow, near-imperceptible floodlight "breathe" (intensity pulse, not a spin), score numerals count up once on entrance, trend lines draw in as a single light-trail on scroll-into-view (not a loop).
- **Strengths:** distinctly football — immune to the "generic sci-fi dashboard" trap; builds almost entirely on tokens/patterns that already exist (`--hero-bg`, `--hero-glow`, `getTeamColor`, `color-mix`) — the most ambitious *visual* leap with the *lowest* engineering risk of the five; elevates club colour from a 3px accent stripe to a genuine per-entity identity light, a much bigger use of data the app already has.
- **Risks:** without real restraint and football-specific anchoring (turf lines, tunnel framing, a genuine beam shape), rim-lit dark UI can drift toward generic "gaming/esports dark mode." A fully dark-first visual identity needs an equally strong, *independently designed* light mode (not "dark, but paler") or it risks being gorgeous at night and disappointing in daylight — precisely the light-mode failure the brief is most worried about (see §12/§14 for how this is resolved).

### E — Command Deck / Instrument Cluster

- **Philosophy:** an F1 pit-wall / flight-deck reading of "intelligence" — precision and density *are* the premium feeling, the way a chronograph feels expensive because of its precision, not its size.
- **Visual language:** hairline grids, tabular/monospace numerals everywhere (not just scores), 1px dividers instead of rounded borders, small-caps labels, a subtle digit-roll on live-updating figures, near-zero border-radius, minimal colour outside sharp semantic accents.
- **Homepage structure:** League Leaders as a compact three-up telemetry strip — precise readouts, not portraiture.
- **Navigation:** a persistent thin cockpit-style status bar, never a big hero banner.
- **Mobile experience:** good — dense instrument UI is naturally compact — but real risk of dropping below comfortable legibility/tap-target size at true "instrument" density on a phone.
- **Motion language:** odometer-style digit-rolls, a small pulsing "live" dot on actively-updating data, sharp linear (not eased) transitions for a mechanical, not organic, feel.
- **Strengths:** leans hardest into the "intelligent" half of the brief; naturally accessible via real information-density-through-grid rather than visual noise; cheapest to render (flat colour, thin lines, no blur/glow budget).
- **Risks:** weakest on "cinematic" of the five — a cockpit is precise, not spectacular, and risks under-delivering the "this looks incredible" reaction entirely, landing closer to a Bloomberg terminal; least distinctly *football* — this could be an F1, tennis, or finance product with the accent colours swapped.

---

## 4. Recommended direction

**Floodlit (Direction D), with one deliberate graft from Direction B: connected light-trail lines for trajectory/trend data — never literal 3D orbits, a starfield, or a "camera travels through space" scroll metaphor.**

That graft is smaller than it sounds: `MatchTrend` (`components/charts/match-trend.tsx`) already draws a form/rating trend as an inline SVG line. Floodlit's version of "orbital" is an art-direction pass on that *same existing component* — a glowing stroke instead of a plain one, so recent form reads as "a trail of light across the last few matches" — not a new subsystem, not a new dependency, and not the starfield/orbit/gravity-well apparatus Direction B would actually require to look real. This is explicitly **not** adopting Direction B; it is taking its one idea with genuine football meaning (a trajectory is a real thing — recent form over time) and rejecting the rest (orbiting satellites, a literal universe, camera-travel navigation) for the reasons in §3's risk assessment.

**Against the brief's own criteria:**

- **User experience** — builds on patterns that already exist and already work (`data-hero`, `--hero-glow`, the player-hero club-colour spotlight) — the lowest-regression path to something dramatically more ambitious, not a rebuild from zero.
- **Distinctiveness** — no Premier League product currently uses a literal night-match/floodlight language this directly. FPL, Sofascore, FBref, and the official PL app all sit closer to Direction E (data-dense) or generic SaaS. This is genuinely unclaimed territory *and* unambiguously football.
- **Usability** — the base palette stays monochrome-at-night, so the app's existing semantic colour system (accent/info/attention/negative — see §14) keeps meaning what it already means. Directions A (broadcast colour bars) and B (a rainbow star-field) would compete for the same colour budget currently reserved for signal; Floodlit doesn't.
- **Scalability** — club-colour-as-floodlight is free: the full 30-club hex map already exists (`lib/competitions/teamBranding.ts`) and is already read from five-plus call sites. Works identically for League Leaders, Player, Team, and (later) Match Centre.
- **Performance** — entirely CSS (linear/radial gradients, `blur()`, `mix-blend-mode`) plus the existing inline-SVG `MatchTrend` and the browser's native View Transitions API. No WebGL, no canvas engine, no animation library — unlike Direction B, which realistically needs one to look genuinely good rather than a CSS pastiche.
- **Mobile suitability** — the one direction whose signature motif (a vertical beam, a portrait-format rim-lit cutout) gets *better*, not worse, on a phone. Directly answers the brief's "might actually work better on mobile if designed correctly."
- **Future intelligence features** — the "light under a colour" grammar extends cleanly: availability → a flickering/dimming light; player comparison → two beams side by side; competition context → a wider stadium shot. Nothing here needs inventing from scratch per feature.

---

## 5. Homepage information architecture (recommended direction)

The brief's proposed hierarchy (League Leaders → My Football → League Context → Discovery) is directionally right and is **kept**, with two specific challenges resolved:

**Challenge 1 — "does League Table belong beside My Football?"** Yes, for a visitor with a supported club, on desktop: a two-column split, My Football's (now Floodlit-skinned) vignette on the left, a **compact** League Table on the right answering "where does my club actually stand." This reuses `LeagueTable`'s existing `compact={{ aroundTeamId }}` mode verbatim — zero new data logic. Collapses to stacked on mobile, matching the `flex-col sm:flex-row` pattern already dominant across this codebase.

**Challenge 2 — "should My Football float/become interactive?"** No. A persistent floating panel competes with `BottomNav`'s own dedicated "My Football" tab and eats screen real estate on the one surface the brief insists must be first-class (mobile). Instead: keep it in-flow, but give it the *same* Floodlit visual grammar as League Leaders, one register smaller — a continuation of the same system, not a lesser "widget" bolted underneath a hero.

**Resolving the League Leaders / Top Performers duplication.** Building League Leaders as a genuinely new hero *directly above* the existing Top Performers dark-hero-band would mean two different top-3 treatments stacked back to back, showing the same three names twice in two different costumes. The clean fix: **retire only the `data-hero` masthead portion of `TopPerformers`** (the kicker/headline/glow), and let the new `LeagueLeadersHero` become that section's masthead instead. The category tabs and the full ranked table underneath (`CategoryTabs`, `PerformanceTable`, `WhyPanel`) are **kept exactly as they are today** — same interaction, same data, restyled only.

**Persistent visual thread, League → Club → Player.** The mechanism is the club-colour rim-light itself. A League Leader lit in Sunderland red on the homepage → the same red, at hero scale, on the player's own page → the same red again on the club's page. This is not a new concept for the app (`getTeamColor` is already called from at least five places); it becomes the connective tissue between pages instead of a small incidental accent. Concretely enabled via the native browser **View Transitions API** (`document.startViewTransition`) with the glow itself as the shared/named element — zero new dependency, degrades to a plain navigation on browsers without support (progressive enhancement, not a requirement).

**Final homepage order:**
```
Header (unchanged)
↓
Preview-build disclosure (unchanged, already minimal)
↓
LEAGUE LEADERS  → category tabs → full ranked table   (replaces today's TopPerformers)
↓
MY FOOTBALL  |  LEAGUE CONTEXT   (two columns desktop / stacked mobile; My Football column absent with no supported club)
↓
DISCOVER TEASER (unchanged in substance and size)
```

---

## 6. Interaction ideas (recommended direction)

- **League Leaders, mobile:** native CSS `scroll-snap-x` between the three players as full-bleed takeover panels — no gesture library needed, no JS drag logic.
- **League Leaders, desktop:** hovering a player lights them fully and dims the other two slightly — same data already in memory, pure CSS/state, no refetch.
- **Score count-up:** on first paint of League Leaders and the player-page hero numeral, once — not on every scroll re-entry.
- **Cross-page identity thread:** View Transitions crossfade the club-colour glow specifically on League Leaders → Player and Player → Club navigations — the one macro transition in the app, and it has an explicit "why": it's showing the identity connecting the two pages, not decoration.
- **Category tabs:** unchanged interaction (existing underline-indicator logic in `TopPerformers`'s `CategoryTabs`) — it already works, restyled only.
- **"Why" expand-in-place:** unchanged (`WhyPanel` accordion) — restyled only.
- **Trend lines:** `MatchTrend`'s path draws in once, as a light-trail, when scrolled into view (`IntersectionObserver`, `{ once: true }`), never looping.

---

## 7. Mobile implications (recommended direction)

- League Leaders becomes an edge-to-edge, horizontally swipeable set of three vertical panels (`scroll-snap-x`), one per player, with a small dot indicator — the same "hint that there's more to scroll" instinct already used for the category-tab and table scroll-fade affordances, applied to a new context rather than reinvented.
- `BottomNav` is kept **structurally identical** (already thumb-tested at 375–430px per its own code comments) — only re-skinned: a soft glow under the active icon in place of a flat accent-colour icon.
- The personal Floodlit vignette (My Football) collapses to the exact single-column pattern `MyFootballWidget` already uses at `sm:` — no new responsive logic.
- The My Football / League Context two-column desktop split stacks vertically on mobile, using the same `LeagueTable compact` component and the same `flex-col sm:flex-row` convention already dominant in this codebase.
- Motion amplitude is *reduced*, not added, on mobile: the floodlight breathe and light-trail draw-ins get shorter duration / lower amplitude — consistent with this app's existing discipline of measuring real behaviour at real widths rather than assuming desktop timing travels unchanged.

---

## 8. Desktop implications (recommended direction)

- More room lets the three League Leaders share one continuous floodlit baseline — a genuine wide-format composed scene, closer to a broadcast "team of the week" graphic than three stacked mobile takeover cards.
- The My Football / League Context two-column split is desktop-only (see §5); mobile stacks.
- Hover carries more interaction weight than on mobile (dim-the-others-on-hover, tab hover, row hover) — reusing the *existing* `hover:bg-[var(--color-surface-2)]` base layer under the new Floodlit skin rather than inventing a second hover language.

---

## 9. Accessibility considerations

- Every glow/rim-light/beam is **additive**, never the sole carrier of information — the app already treats colour this way (`confidenceTone` pairs a dot *and* a tooltip sentence; `TrendBadge` pairs an icon *and* a label) and Floodlit must hold that line: club-colour light is atmosphere, not the only signal.
- Every new keyframe (floodlight breathe, light-trail draw-in, score count-up, View Transition crossfade) goes inside the **same** `@media (prefers-reduced-motion: reduce)` block `globals.css` already uses for `.animate-reveal` — one convention, not two.
- Text overlaid on duotone/rim-lit portraits sits on a fixed dark gradient scrim, not per-photo contrast tuning — the same separation already proven in production (`--hero-ink` on `--hero-bg` is a verified high-contrast pair today).
- Keyboard focus: the existing `[data-hero] :focus-visible` rule (a lighter focus ring specifically for dark surfaces) already solves this for exactly this kind of surface — Floodlit is an extension of `data-hero`, so this carries over unchanged; any *new* dark surface just needs the same `data-hero` attribute.
- **Light mode ("Day Match," see §14) is contrast-checked independently, not assumed fine because dark mode is fine** — warm sunlit gradients are the easiest way to accidentally erode contrast. Body text stays on a flat, high-contrast surface even where the background decoration is warm/gradient, mirroring the existing separation between the (`pointer-events-none`, absolutely-positioned) glow layer and the real content sitting on top of it.
- If emoji icons are eventually replaced with an owned icon set (§11), each replacement keeps the exact `aria-hidden="true"` + adjacent-text pattern already used everywhere emoji appear today (e.g. `archetype-card.tsx`).

---

## 10. Performance considerations

- **Zero new heavyweight dependencies.** No WebGL/three.js/canvas engine, no animation library. Every Floodlit effect is CSS gradients, `blur()`, `mix-blend-mode`, the existing inline-SVG `MatchTrend`, and the native View Transitions API (progressive enhancement — zero JS cost where unsupported).
- **Duotone/rim-light via CSS filter/blend**, not server-side image processing — the existing `unoptimized` `next/image` + official-CDN pipeline (`lib/assets/images.ts`) stays completely untouched.
- **Glow layers stay cheap:** `pointer-events-none`, absolutely positioned, capped to roughly the size already proven not to jank in production (`h-64 w-64` / `h-56 w-56`) rather than scaled up for extra spectacle.
- **Looping/ambient motion only animates `transform`/`opacity`** (GPU-composited) — never `filter`, `width`/`height`, or anything layout-affecting every frame, the same rule `grow-bar` already follows correctly.
- **Entrance animations fire once** (`IntersectionObserver { once: true }` or a mount-ref guard) — never replaying on every scroll re-entry.
- **Switch to the `lg` photo size that already exists but is unused.** Every current call site defaults to `PHOTO_SIZES.md` (110×140) — `lg` (250×250) is already defined in `lib/assets/images.ts` and needs only a `size="lg"` argument at the League Leaders/hero call sites, not new capability. Worth a five-minute manual check of whether the same Premier League CDN also serves something larger still (an unlisted size) before finalising the hero treatment — but 250×250 is the confirmed floor to design against. Either way, the duotone/rim-light direction (Directions C/D) is specifically chosen because it disguises a modest source resolution far better than a full-colour photo blown up would.

---

## 11. Existing components/data that can be reused as-is

Data, logic, and routes are **entirely untouched** by this document — presentation layer only.

- `PlayerAvatar`, `TeamCrest` — fallback logic (monogram/initials on missing or failed photo) is sound; a new *rendering size/variant* is added for hero-scale portraits, not a rewrite.
- `getTeamColor` (`lib/competitions/teamBranding.ts`) — becomes far more central; the map itself needs no changes.
- `MatchTrend` — the actual line-drawing math is kept; only the stroke/glow art direction changes.
- `CategoryBar`, `TrendBadge`, `NationalityFlag`, `ArchetypeBadge` — logic/data untouched, restyled to new tokens.
- `BottomNav`, `HeaderNav`, `isSectionActive` — structurally sound and already mobile-tested; re-skinned only.
- `LeagueTable`, including its existing `compact` mode — reused verbatim for the new League Context placement.
- `explainPlayer`, `qualityLabelFor`, `classifyArchetype`, every scoring/analytics/repository function — completely untouched.

## 12. Existing UI to retire

- The `TopPerformers` `data-hero` masthead markup (kicker + headline + single glow) — superseded by `LeagueLeadersHero`; its category tabs and table are kept.
- "`rounded-xl border` + 3px left-accent stripe" as the **default** treatment for anything meant to feel like a moment (currently `MyFootballWidget`/`DiscoverTeaser`'s shared look) — kept only for genuinely secondary/utility rows (e.g. the availability-watch strip), not for anything in the new primary hierarchy.
- Emoji as the sole vehicle for "characterful" moments (archetype icons, Discover category icons, the "⚽ My Football" fallback button) — a real candidate for an owned minimal icon set, but **explicitly out of scope for the prototype** (§15).

Nothing analytical is retired. No page or route is removed.

---

## 13. Concrete homepage composition

```
HEADER
  Logo · season switcher · nav links — unchanged structure, re-skinned only

↓ Preview-build disclosure
  Unchanged — already a collapsed <details>, correctly minimal from the prior tightening pass

↓ LEAGUE LEADERS  (new masthead, replaces TopPerformers' data-hero block)
  Stadium-night canvas (--hero-bg). Three current #1/#2/#3 by Overall Performance
  — real data, straight from getTopPerformers().players.slice(0, 3), nothing new
  to compute.
  Desktop: three players sharing one continuous "pitch baseline," each individually
    rim-lit in their own club colour (getTeamColor).
  Mobile: same three, as scroll-snap full-bleed takeover panels with a dot indicator.
  Each player shows: duotone/rim-lit portrait, name, club, Performance score
    (large Fraunces numeral — the new Display XL scale, see §14), and ONE real
    intelligence line — explainPlayer's existing top-strength sentence for that
    player. No new copy system.

  ↓ Category tabs (existing CategoryTabs logic, restyled only)
  ↓ Full ranked table (existing PerformanceTable + WhyPanel, restyled only)

↓ MY FOOTBALL  │  LEAGUE CONTEXT
  Desktop: two columns — personal Floodlit vignette (club identity + the existing
    worthKnowing headline/context/voice lines) left, compact LeagueTable
    (compact={{aroundTeamId}}) right.
  Mobile: stacked, same components.
  My Football column absent entirely when no club is supported — same
    `if (!club) return null` pattern MyFootballWidget already uses.

↓ DISCOVER TEASER
  Unchanged in substance and size — already correctly minimal per the brief's own
  "smaller pathway" framing.
```

---

## 14. Visual language specification

Everything here **extends** the existing token system in `app/globals.css`; nothing existing is deleted or renamed.

### Typography
Fraunces (`--font-display`) and Geist Sans/Mono are kept exactly as configured in `app/layout.tsx`. A named scale is added (previously ad hoc per-component sizing):

| Token | Size / weight | Use |
|---|---|---|
| Display XL | 64/72px, Fraunces 600 | League Leaders hero numerals only — new, nothing today uses a numeral this large |
| Display L | 40/48px, Fraunces 600 | Page hero headlines — formalises the existing player/team H1 size |
| Display M | 24/28px, Fraunces 500 | Section mastheads |
| Body L | 16px, Geist | Lead paragraphs (Season Story is already 16.5px — rounds to this) |
| Body M | 14px, Geist | Default UI text — the current dominant size |
| Body S | 12.5px, Geist | Secondary/meta text |
| Label | 11px, uppercase, 0.08–0.16em tracking, Geist Medium/Semibold | Formalises the kicker pattern already used everywhere (e.g. `text-[11.5px] uppercase tracking-[0.16em]`) |
| Mono/tabular | Geist Mono | Genuinely tabular data only — **not** expanded app-wide (that's Direction E, not adopted) |

### Colour
Every existing `--color-*` / `--hero-*` token is kept at its current value. New tokens, all derived from values already in production:

```css
/* Dark — Night Match */
--floodlight-beam: linear-gradient(to bottom, rgba(203,244,58,0.18), transparent);
  /* directional version of the existing --hero-glow colour, reused not reinvented */
--pitch-line: rgba(246,246,242,0.06);
  /* hairline turf-marking dividers on dark surfaces */

/* Light — Day Match */
--sunlight-glow: rgba(255,214,140,0.16);
  /* top-anchored warm radial wash — light mode's OWN atmosphere, not dark-mode-inverted */
--pitch-accent: #2f7d32;
  /* confident daylight grass green — a rare accent, never replacing --color-accent's existing meaning */
--shadow-day: 0 12px 32px -12px rgba(120,90,40,0.18);
  /* the one new drop-shadow, hero-equivalent light-mode surfaces only, single light-source direction (top-left) */
```

Club colour (`getTeamColor`) is elevated from a 3px border accent to a per-entity rim-light/beam tint, via the same `color-mix(in srgb, var(--team-color) X%, transparent)` technique already used on the player-page hero today — applied at hero scale, not widget scale.

*Implementation note:* Tailwind v4's `@theme inline` block in `globals.css` only bridges a handful of tokens (`--color-canvas/surface/border/ink`, the three font vars) into generated utility classes — everything else, including every semantic accent and every `--hero-*` token, is already consumed via arbitrary-value syntax (`bg-[var(--color-accent)]`, inline `style`) rather than a real Tailwind class. The new tokens above follow that same existing convention; there's no need to expand `@theme inline` to use them.

### Surfaces
- Dark "stadium" surface: the existing `--hero-bg`/`--hero-bg-2`, unchanged, now used for League Leaders as well as page heroes.
- Light "Day Match" surface: **not** flat `--color-surface` — a subtle top-anchored `--sunlight-glow` wash sits behind hero-equivalent light-mode sections, giving light mode a real, independent atmosphere token.
- Ordinary card surfaces (`--color-surface`/`--color-surface-2`) are unchanged — the visual ambition is concentrated in hero/moment surfaces, matching the brief's "enhance hierarchy, not decorate everywhere."

### Borders / radii
Existing `rounded-xl`/`rounded-t-xl` card scale is unchanged. Pitch-line hairlines (new) supplement, never replace, `--color-border`.

### Shadows / gradients
No drop-shadows added to dark surfaces (glow already does that job). Light mode gets exactly one new shadow token (`--shadow-day`, above), used sparingly — hero-equivalent light-mode cards only.

### Spacing
Unchanged base scale — the diagnosed problem was page-composition rhythm (§1), not the base unit. Addressed via the new hero section's own generous padding (e.g. `pt-10 pb-12` vs today's `pt-8 pb-0`), not a new spacing token set.

### Iconography
Lucide (`lucide-react`, already in use — `TrendingUp`, `Compass`, `Users`, etc.) stays the base functional-icon system. Emoji-for-personality is the one open item noted in §12 — out of scope for the prototype.

### Motion
```css
--ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1);   /* entrance choreography only */
--duration-entrance: 700ms;                          /* portrait / numeral entrance */
--duration-microinteraction: 200ms;                  /* matches existing transition-colors durations, unchanged */
--duration-breathe: 6000ms;                          /* floodlight ambient pulse — deliberately near-imperceptible */
```
All new keyframes live inside the same `@media (prefers-reduced-motion: reduce)` block `globals.css` already uses for `.animate-reveal` — the convention to extend. (Note: `grow-bar`, the app's *other* existing keyframe, currently has no such guard — an existing gap, out of scope here, but not one to copy forward into anything new.)

### Active / hover states
Existing conventions are the base layer, unchanged: `hover:bg-[var(--color-surface-2)]`, the accent-colour underline for active tabs/nav, the `group-hover` avatar scale-up already used in the Top Performers table. Floodlit adds one new variant — a soft glow under the active `BottomNav`/`HeaderNav` icon — as an evolution of the existing 2px underline, not a parallel system.

### Mobile behaviour
`scroll-snap-x` is the one new interaction primitive (League Leaders swipe). Every other component keeps its existing, already-audited mobile behaviour (`table-fixed` layouts, icon-only category tabs, scroll-fade affordances) completely untouched.

---

## 15. Prototype recommendation

**Build `LeagueLeadersHero` first**, as a standalone component that replaces today's `TopPerformers` `data-hero` masthead on the real homepage — table and category tabs beneath it untouched. This is the smallest slice that can actually answer "does this finally feel like the product we want?"

**Scope, precisely:**
- Both real breakpoints, not "desktop first" — the mobile scroll-snap takeover and the desktop shared-scene layout, both built, both using real current data (`getTopPerformers().players.slice(0, 3)`).
- Real player photos at the largest size the PL CDN actually serves (spike this first, §10), with the duotone/rim-light CSS treatment.
- Real club-colour rim-lighting via the existing `getTeamColor`.
- One real intelligence line per player, from the existing `explainPlayer` output — no new copy.
- Score count-up entrance, gated by `prefers-reduced-motion`.

**Explicitly deferred, not part of this prototype:**
- View Transitions cross-page colour thread (§5/§6) — a cross-page concern; this prototype is homepage-only.
- The `MatchTrend` light-trail re-skin (§6) — a refinement to a different section.
- Any new icon set (§12) — cosmetic, independent of the core hero.
- The My Football / League Context two-column rework (§5) — a separate, smaller piece of work once the hero direction is validated.

**Success test:** put the new homepage's first viewport side-by-side with the current one, in both light and dark mode, on a real phone and a real desktop, before touching anything else in the app. If it doesn't produce "this looks incredible, I want to explore this" at that point, the direction gets revised before it spreads to Player/Team pages — not after.
