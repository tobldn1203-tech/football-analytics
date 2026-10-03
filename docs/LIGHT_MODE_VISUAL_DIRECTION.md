# Light Mode — Visual Direction Exploration

**Status: ideation only.** No production code changed by this document. The forced-dark-default change from the previous task has been cleanly reverted (`git revert` of "Make dark (Floodlit) the default theme...") — the app is back to its proper `prefers-color-scheme`-driven architecture, no toggle, no `lib/theme/`, no leftover scaffolding. This document is the investigation and concept exploration for a **separate, deliberate light-mode redesign** — dark mode (Floodlit) is untouched and stays exactly as it is.

Every diagnostic claim below is grounded in a real screenshot of the current app (light mode, post-revert) at `/`, `/players/[slug]`, `/teams`, `/discover`, `/matches` — not assumption.

---

## 1. Diagnosis — specifically, not "the colours need improving"

**1.1 Light mode's personality is trapped in a strip at the top of every page.** Every non-homepage page (`/players/[slug]`, `/teams`, `/discover`, `/matches`) opens with the same fixed-dark `data-hero` masthead (`--hero-bg: #0b0e1c`, unchanged by theme by design — see `globals.css`'s own comment: "intentionally does not invert with theme"). That's correct and deliberate for that one element. But the consequence, confirmed by screenshot on every page checked, is structural: **90%+ of each page's vertical space, in light mode, is a flat off-white body with no dark/atmospheric treatment anywhere in it.** Light mode isn't a full theme here — it's "whatever's left below the one element that stayed dark." That's the single biggest reason it reads as secondary rather than designed.

**1.2 Extreme, literal card sameness.** Not a vague impression — a count, from real screenshots:
- `/discover`: 7 nearly-identical `rounded-xl border bg-white` category cards, followed by 12 nearly-identical bordered rows, all in one screen.
- `/matches`: 10 visually-identical white fixture cards in a grid — a 5-3 thriller (Man City vs Sunderland) and a 0-0 draw (Leeds vs Crystal Palace) are indistinguishable in weight, colour, or scale.
- `/teams`: a 20-row table that is, literally, a spreadsheet — sortable-looking columns, thin grey rules, no visual event marking a promotion/relegation zone, a title race, or anything else that matters about *where* in the table you're looking.

**1.3 Club colour — already a rich, real asset (`lib/competitions/teamBranding.ts`'s 27-club hex map) — is almost entirely dormant in light mode.** It shows up as a tiny crest and, in a few places, a 3px border accent. Nowhere does it structure a layout, a background, or a typographic treatment. Dark mode's League Leaders hero uses club colour as a genuine rim-light; light mode's equivalent (Day Match) does too, but that's the *only* place in the entire app light mode uses colour as anything more than a label.

**1.4 Typography has no hierarchy outside the trapped dark strip.** Fraunces (the serif "personality" typeface — see `app/layout.tsx`'s own comment, "used sparingly for headlines and hero numerals") appears in the dark hero's `<h1>` and score numeral, and almost nowhere else in light mode's body content. Below the hero, everything reverts to a narrow 11–16px Geist Sans band — confirmed on the player page (Season Story paragraph, category bars, match table) and Discover (every card title is the same 15px weight).

**1.5 Zero depth system.** Dark mode has glow, blur, rim-light. Light mode has exactly one visual device: a 1px `--color-border` line. No shadow, no elevation, no layering — confirmed by `grep` of `globals.css`: the only `box-shadow` values anywhere are the dark-hero-only `PlayerAvatar` glow ring and the League Leaders hero's `--leaders-shadow` (Day Match only, homepage only). Every other light-mode surface is flat.

**1.6 Iconography reads as generic consumer-app, not football-native.** Discover's category icons are emoji (🔥📈💎🎯⚡🎨🛡️) inside pastel-tinted circles — a specific, very recognisable "startup dashboard" pattern, not a look with any relationship to football.

**1.7 Nothing in light mode currently evokes football at all.** Not stadium, not pitch, not broadcast, not print — strip away the crests and player names, and light mode could be any generic sports-adjacent SaaS product. This is the gap the four concepts below are built to close.

**What's *not* broken, and shouldn't be treated as broken:** the underlying information architecture, data density, and mobile responsiveness are all sound (see `docs/VISUAL_UX_REIMAGINATION.md` for the prior full audit) — this is specifically a light-mode *surface/atmosphere/hierarchy* problem, not a structural one.

---

## 2. Cross-cutting principles (apply to every concept below)

**Not a mirror of dark mode.** Floodlit's language is night, atmosphere, glow, depth-through-darkness. None of the four concepts below try to reproduce that in reverse. Each has its own light-native reason to exist — the relationship to dark mode is "same product family, same intelligence, different time of day / different medium," not "same design, inverted."

**Beyond colour, every concept commits to:**
- **Composition** — genuine asymmetry and grouping-without-containers where it earns its keep, not a uniform card grid everywhere.
- **Scale** — something on every page gets deliberately large (a number, a name, a result) so the page has a focal point the way the homepage's League Leaders hero already does.
- **Depth** — a real elevation system (not necessarily shadows — see each concept), so surfaces relate to each other in a Z-axis, not just a flat list.
- **Imagery** — real player photography and club colour used as structure, not decoration (see §11 for the resolution/licensing facts already established in `docs/VISUAL_UX_REIMAGINATION.md` §1/§10).
- **Shape** — an intentional container language distinct from `rounded-xl border`, used consistently enough to feel designed rather than incidental.

---

## 3. Four light-mode concepts

### Concept A — "Matchday Programme"

**Philosophy.** The physical football matchday programme — the printed booklet handed out at the ground: team sheets, a manager's notes column, sponsor-block ads, halftone player photography. A beloved, specifically football artefact with zero overlap with any SaaS dashboard. Light mode becomes something you'd genuinely enjoy holding, not just a paler dashboard.

**Background treatment.** A warm, faintly textured off-white — not `#ffffff`, closer to uncoated matte paper (`#faf7f0`-family, close to the app's *existing* `--color-canvas: #faf8f3`, which already leans this direction and is worth keeping as the base). A very subtle, almost imperceptible halftone-dot texture (a repeating SVG pattern at ~2–3% opacity) on section backgrounds only — evoking cheap newsprint reproduction of a photo, never applied to text-bearing surfaces.

**Surface treatment.** Thick (2–3px) rules instead of thin hairline borders — a programme's actual page-division weight. Sections separated by a printed "fold line" motif (a dashed rule with a small die-cut circle, like a programme's perforated ticket stub) rather than a bordered box. Pull-quote treatment for intelligence sentences: large Fraunces italic, in a dedicated column, the way a programme sets a manager's-notes quote.

**Colour system.** Club colour becomes a "team sheet" stamp — a solid, saturated colour tab in the corner of anything about a specific team (not a 3px border, an actual filled rectangle, like a programme's team-colour running head). Performance colour (the existing `--color-accent`/`--color-positive`/etc. semantic system) stays exactly as-is — this concept doesn't touch meaning, only how identity colour is deployed.

**Typography.** Fraunces becomes the primary voice throughout, not just hero numerals — headlines, pull-quotes, even table "mastheads" (section titles set like a programme's page headers, tracked caps + a printed-look rule beneath). Geist stays for genuinely tabular data (scores, tables) — the contrast between the two is the whole point, mirroring a real programme's mix of display type and stat blocks.

**Motion.** Minimal, deliberately "print-like" — a page turn/cross-fade between Discover categories, not glow or blur (which have no place in a print metaphor). A number "stamping in" on load (a quick scale+opacity settle, like ink hitting paper) for hero numerals only.

**Mobile (375–430px).** Strong fit — programmes are already a compact, single-column reading format. The halftone texture and thick rules read fine at small scale; the pull-quote column collapses to a full-width block, same as a compact-format matchday programme naturally would.

**Risks.** Can tip into pastiche ("cosplay of a vintage programme") if the paper/halftone texture is pushed too far — needs to stay a whisper, not a filter. Thick rules risk feeling heavy/dated if not paired with generous whitespace. Needs real restraint to read as "premium editorial," not "kitsch retro."

---

### Concept B — "Stadium Daylight"

**Philosophy.** The direct light-mode sibling of Floodlit, using the *same* underlying idea (a real stadium, rendered honestly) at a different time: a bright Saturday 3pm kickoff instead of a European night game. Where Floodlit is atmosphere-through-darkness, this is atmosphere-through-brightness — sky, sun, sharp shadows, pitch green as a structural colour, not just an accent.

**Background treatment.** A very subtle vertical gradient, sky-to-pitch, used ONLY behind hero-equivalent sections (mirroring exactly how the homepage's existing `--leaders-bg` Day Match token already works) — pale sky-blue-white at the very top easing into the existing warm canvas. Everywhere else stays a flat, bright, near-white surface — the sky gradient is a rare event, not a page-wide wash.

**Surface treatment.** Real elevation via a single, consistent hard-edged drop shadow (short blur, defined offset — like midday sun, not the soft ambient shadow a SaaS app would use) on anything meant to feel "raised off the pitch": the League Leaders hero, a match's headline card, a team's crest block. Ordinary rows/lists stay flat and shadow-free — shadow is reserved for genuine focal points, never applied everywhere (which is exactly the "excessive gradients/shadows" trap the brief warns against).

**Colour system.** Pitch green (a genuine, confident green — distinct from the brand lime accent, exactly the role `--leaders-accent: #1f7a3d` already plays on the homepage) becomes a real structural colour: touchline-style rules as section dividers (a thin green line with small perpendicular tick marks, echoing pitch markings), not just text. Club colour renders as a "shirt" block — a solid rectangle behind a crest, sized like a kit swatch, most visible in the Teams table and Match Centre.

**Colour system, continued.** The Teams table specifically gets redesigned around this: instead of a flat spreadsheet, each row's club-colour swatch sits at genuine visual weight (not a tiny dot), and the top-4/relegation zones get a *real* pitch-marking-style divider line across the whole table, not just a colour change.

**Typography.** Large, confident Fraunces numerals wherever a real result lives — scorelines on `/matches`, standings points — the way a stadium scoreboard makes the number the entire point. Geist stays for everything structural/navigational.

**Motion.** A short, sharp "settle" on cards entering view (translate + fade, ~200ms, mirroring how a stadium graphic snaps into place) rather than Floodlit's slow cinematic breathe — daylight is energetic, not atmospheric-slow. Hover states get a firmer, faster response than dark mode's softer glow-hover.

**Mobile (375–430px).** The sky gradient and touchline dividers both work at any width (they're horizontal/vertical rules, not spatial compositions) — this concept doesn't rely on room the way a layered composition would, so it scales down cleanly. Match cards keep their current single-column stack; the club-colour swatch becomes the row's left edge instead of a separate block.

**Risks.** The closest of the four to accidentally becoming "dark mode inverted" if not executed carefully — needs the sky gradient, hard-edge shadow, and pitch-marking motifs to stay genuinely distinct devices, not just "the same layout, lighter."

---

### Concept C — "Broadcast Ticker"

**Philosophy.** Live sports broadcast graphics — Sky Sports News, a Match of the Day score bug, a transfer-deadline-day ticker. High-contrast, kinetic, unapologetically energetic — the polar opposite of a muted dashboard. Where Floodlit is cinematic and slow, this is live and fast.

**Background treatment.** Near-white, genuinely high-contrast (not the current warm off-white, which is closer to this concept's *text* colour than its background) — closer to true broadcast-graphic white, so bold black text and saturated colour blocks have somewhere to actually pop.

**Surface treatment.** Thick, saturated colour bars as section dividers and headers — not a 3px accent stripe, a full-weight "breaking news"-style bar (think a lower-third's coloured band), in club colour where the content is club-specific, in brand lime where it's a section masthead. Cards get squared-off corners (a broadcast graphic has none of the soft `rounded-xl` a dashboard defaults to) and sit directly adjacent, edge-to-edge, rather than floating with gaps — the ticker/bulletin-board feel.

**Colour system.** The most colour-confident of the four: club colour is used at full saturation, not tinted, wherever a single club is the subject (a team's own page masthead, a match's own two team-colour halves). League-wide lists (Discover, Top Performers) stay restrained — colour is reserved for "this is specifically about this club," exactly the discipline broadcast graphics already use (a team's own graphics package is in their colours; the league-wide bulletin isn't).

**Typography.** Bold, condensed, tabular numerals everywhere a live number lives — scores, points, form — mimicking an on-screen score bug. A genuine "ticker" component for something time-sensitive (e.g. Discover's "In Form" or the homepage's `sampleNote`) — a slow, continuous horizontal scroll of short facts, the one place in this concept where literal broadcast-ticker motion earns its name.

**Motion.** The most kinetic of the four, deliberately: numbers count up fast and snap (not ease gently), section headers can "wipe" in from the edge like a broadcast lower-third, and the ticker (above) scrolls continuously but slowly — the one intentionally *ambient* motion in this concept, clearly justified by its own metaphor (a real ticker is always moving).

**Mobile (375–430px).** Very strong — broadcast lower-thirds are natively narrow-format graphics, and edge-to-edge squared cards need no padding-and-gap layout math to shrink well. The horizontal ticker is a natural mobile pattern (already proven elsewhere in this app via the existing scroll-fade affordance on category tabs).

**Risks.** The highest-energy concept of the four — risks feeling loud/busy if the "restrained on league-wide views" discipline slips, and risks the continuous ticker motion becoming the one animation in the whole app that doesn't clearly answer "why is this moving" if it's used anywhere beyond a genuinely live/time-sensitive fact.

---

### Concept D — "Tactics Board"

**Philosophy.** A coach's tactics whiteboard, rendered light rather than as a chalkboard — the visual language of precision, structure, and analysis rather than atmosphere or spectacle. Where the other three concepts lean cinematic/editorial/broadcast, this one leans into the "intelligence" half of the brief hardest: it should look like a tool an analyst trusts, not a magazine or a TV graphic.

**Background treatment.** A cool, near-white surface with an extremely faint pitch-grid texture — thin, precise lines at a low enough opacity to read as "structure," never as decoration (closer to graph paper than a football pitch photograph). No gradient, no atmosphere — flatness is the point here, in service of legibility and precision.

**Surface treatment.** No cards in the conventional sense — grouping happens through the grid itself (whitespace and alignment do the work a border currently does), with a restrained set of thin, precise rules only where a genuine boundary exists (e.g. separating "Full rankings" from "League context"). Where a container is genuinely needed, it's a sharp-cornered, thin-bordered block, closer to a diagram's box than a dashboard's card.

**Colour system.** The most restrained of the four — colour is reserved almost entirely for semantic meaning (the existing accent/info/attention/negative system) and small, precise club-colour markers (a filled dot, sized like a tactics board's player marker, not a swatch or a stripe). This concept explicitly does NOT try to make every page colourful — its distinctiveness comes from precision and structure, not saturation.

**Typography.** Leans on Geist Mono (already in the codebase, currently used only for genuinely tabular figures) far more than the other three concepts — small-caps labels, monospaced data, a real typographic "instrument panel" quality. Fraunces is used sparingly and specifically for the few moments that deserve real weight (a match result, a season summary line), so it stays meaningful rather than becoming wallpaper.

**Motion.** The quietest of the four, and the most literal about "why is this moving": a value updates via a precise digit-roll (like an odometer), a selection state snaps instantly (no easing) rather than glowing or fading — motion here signals "this number just changed," nothing more.

**Mobile (375–430px).** Needs the most care of the four — a grid-based, border-light layout that relies on whitespace for grouping can collapse ambiguously on a narrow screen if whitespace itself has to shrink. Mitigation: at mobile widths, reintroduce a minimal hairline rule between grid regions (exactly the discipline the app already applies elsewhere — a treatment that's implicit at desktop becoming explicit only where space is tight).

**Risks.** The furthest from "engaging/energetic" of the four — risks reading as cold or under-designed if the precision isn't paired with genuinely confident typography and spacing; the "no cards" approach is the hardest of the four to execute well and the easiest to accidentally regress into looking unfinished rather than intentional.

---

## 4. How these differ from each other (not just accent swaps)

| | Metaphor family | Colour role | Depth device | Motion character |
|---|---|---|---|---|
| A — Matchday Programme | Print / editorial | Identity stamps | Print texture, rule weight | Page-turn, ink-settle |
| B — Stadium Daylight | Environmental / atmospheric | Structural (pitch, kit) | Hard-edge sun shadow | Sharp, energetic settle |
| C — Broadcast Ticker | TV graphics | Full-saturation, contextual | Edge-to-edge, colour bars | Fast, kinetic, one literal ticker |
| D — Tactics Board | Technical diagram | Restrained, semantic-first | Grid/whitespace, no cards | Instant, precise, digit-roll |

Each answers "what does light mode feel like" with a genuinely different real-world reference, a different relationship to club colour, a different depth mechanism, and a different reason to move — not four palettes on the same layout.

---

## 5. Football-context grounding used (not decoration)

- **Matchday programmes, stadium architecture/daylight, broadcast graphics, and tactics boards** — four different real football contexts, one per concept, each chosen because it has its own honest visual logic (paper, sunlight, on-air graphics, whiteboard) rather than a football sticker slapped onto a SaaS template.
- **Club shirts/kit identity** informs Concepts A, B and C's use of colour as a *block/stamp/bar*, not a tint — the way a kit's colour is worn with confidence, not applied as a 3% background wash.
- **Pitch geometry** informs both B (touchline dividers) and D (grid/whitespace-as-structure) — two very different readings of the same source (one atmospheric, one diagrammatic), which is itself evidence these are genuinely distinct directions rather than variations on a theme.
- Deliberately **not used**: literal ball/goal/trophy iconography, generic "football graphics" clip-art, or anything that would read as decorative rather than structural — consistent with the brief's explicit "not cheesy football graphics" instruction.

---

## 6. What's reused vs. new, per concept (grounding, not commitment)

All four concepts are compatible with keeping, unmodified: the scoring/analytics layer, routes, `PlayerAvatar`/`TeamCrest`'s fallback logic, `lib/competitions/teamBranding.ts`'s colour map, and the League Leaders hero's existing real-photo pipeline (`lib/assets/images.ts`, the duotone mask technique already proven in Floodlit/Day Match). None require a new dependency — texture (A), gradients/shadows (B), colour bars (C), and grid/whitespace (D) are all achievable in plain CSS, consistent with this app's existing zero-animation-library, zero-3D-library discipline.

---

## 7. A note on recommendation

Not choosing one yet — that's a decision worth making with the actual screens in front of you, not from a written description. If a lean is useful: **B (Stadium Daylight)** has the most direct, legible relationship to the *already-loved* Floodlit dark mode (same underlying idea — an honest stadium — at a different time of day), which most directly answers the brief's own "conceptual relationship, not inversion" instruction; **A (Matchday Programme)** is the most distinctive and lowest-risk of becoming generic, at the cost of being the furthest departure from what exists today. Happy to prototype whichever one direction (or a deliberate hybrid) you want to see built first, the same way League Leaders was validated as a single focused prototype before it became the whole homepage.
