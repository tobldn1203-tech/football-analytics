# Project Proposal — Football Performance & Analytics Platform

Status: Phase 0/1 foundation. See `DATA_SOURCES.md` for the live data investigation this
proposal is based on.

## 1. Product architecture

A modular monolith with a strict one-directional data flow:

```
Raw provider data  →  Normalization  →  Analytics engine  →  Product data  →  AI interpretation  →  UI
```

Each stage only knows about the stage before it through a typed contract, never through a
provider-specific shape. Concretely:

- **Providers** (`lib/providers/*`) know about FPL/football-data.co.uk/etc. Nothing else does.
- **Normalization** maps provider payloads into our own entities (`Competition`, `Season`, `Team`,
  `Player`, `Match`, `PlayerMatchPerformance`, ...). This is the only place provider quirks are
  handled.
- **Analytics** (`lib/analytics/*`) reads only normalized data from the database. Deterministic,
  versioned, unit-tested. Produces category scores, form, consistency, key moments.
- **AI** (`lib/ai/*`) reads only analytics output plus a curated set of verified facts, and turns
  them into prose. It cannot see raw provider data and cannot compute anything.
- **UI** (`app/*`, `components/*`) renders analytics + AI output. No football logic lives here.

A `Competition` entity wraps every other entity (`Season`, `Team`, `Player`, `Match`) from day
one, even though only Premier League is populated initially. This is the specific decision that
lets Champions League be a data/config addition later rather than a rewrite.

## 2. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Single deployable app; SSR/ISR for fast, cacheable pages; API routes double as the thin backend |
| Database | PostgreSQL (Neon, serverless) | Relational fits the entity model; Neon's free tier + branching suits solo development |
| ORM | Prisma | Type-safe schema, migrations, good fit for a single developer |
| Validation | Zod | Validates provider payloads at the normalization boundary; typed all the way through |
| Styling | Tailwind CSS + hand-written CSS variable design tokens | Deliberately not a prebuilt UI kit — that's how the product avoids looking like generic SaaS |
| Charts | Hand-built SVG for simple sparklines/bars; visx if complexity grows | Full control over the editorial look; avoid heavy chart-library defaults |
| Testing | Vitest (analytics engine), Playwright (later, for critical flows) | The analytics engine is the part correctness matters for |
| Ingestion | Plain scheduled TypeScript scripts (`tsx`), triggered by Vercel Cron / GitHub Actions | No queues/workers needed at this scale — explicitly avoiding over-engineering |
| AI | Anthropic Claude, behind a provider-agnostic `AIProvider` interface | Swappable; structured-input/prose-output contract |
| Deployment | Vercel (app) + Neon (db) | Fast, simple, free tier sufficient for a personal/friends product |

## 3. Folder structure

```
football-analytics/
  app/                        Next.js App Router routes (UI only)
    (site)/
      page.tsx                Homepage — Top Performers
      players/[slug]/
      teams/[slug]/
      matches/[id]/
      rankings/
      discover/
    api/                      Thin route handlers only — no football logic here
  components/
    ui/                       Base primitives (buttons, tabs, table shell)
    charts/
    layout/
  lib/
    providers/
      types.ts                DataProvider contract
      fpl/
      football-data-co-uk/
      football-data-org/
    normalize/                Provider payload → normalized entities
    analytics/
      scoring/                Category scores, overall score
      form/                   Rolling/recent-form calculations
      keyMoments/
      __tests__/
    ai/
      provider.ts             AIProvider interface
      anthropic/
      contracts/              Typed input schemas for each AI content type
    db/
      client.ts
      repositories/
    competitions/             Competition config/registry (premier-league.ts, ...)
  prisma/
    schema.prisma
    migrations/
  scripts/
    ingest-fpl.ts
  docs/
    PROJECT_PROPOSAL.md
    DATA_SOURCES.md
    METHODOLOGY.md            (written once the scoring model is validated — Phase 4)
  tests/
```

## 4. Database architecture

Core entities, matching section 15 of the brief, with two additions to keep raw/normalized/
analytics separation real rather than aspirational:

- `IngestionRun` / `RawPayload` — every provider fetch is stored as-is with a timestamp and
  provider id before normalization touches it. This is what makes "raw vs normalized" an actual
  guarantee instead of a diagram.
- `MetricDefinition` / `MetricValue` — a generic, extensible metric store (key, scope, value,
  source, computed-at) so new analytical dimensions can be added without a schema migration,
  and so every number on screen can be traced back to how it was produced.

Entities: `Competition`, `Season`, `Team`, `Player`, `Match`, `PlayerMatchPerformance`,
`TeamMatchPerformance`, `PlayerSeasonPerformance`, `TeamSeasonPerformance`, `KeyMoment`,
`PlayerSeasonStory`, plus the provenance tables above. `Manager`, `Venue`, and fine-grained
`PlayerMatchEvent` are stubbed but deliberately left thin until a minute-level event source is
validated (see Data Sources §5) — modelling them fully now would be schema built for data we don't
have.

Position/role awareness lives at the analytics layer, not the schema: `Player.position` is stored
plainly (GK/DEF/MID/FWD initially, matching what FPL actually gives us), and the scoring engine
looks up position-specific baselines rather than the database enforcing them.

## 5. Data provider architecture

```ts
interface DataProvider {
  id: string;                 // "fpl", "football-data-co-uk"
  fetchPlayers(competition, season): Promise<RawPlayer[]>;
  fetchMatches(competition, season): Promise<RawMatch[]>;
  fetchPlayerMatchPerformances(competition, season): Promise<RawPerformance[]>;
  // providers implement only what they can actually supply
}
```

Each provider adapter returns its own raw shape; a paired `normalize*()` function maps that into
our entities. The analytics engine never imports a provider module. Adding Champions League later
means adding a provider (or extending an existing one, if football-data.org proves it) and a
normalization mapping — not touching `lib/analytics` or `app/`.

## 6. Data source assessment

See `DATA_SOURCES.md` for the full live investigation. Summary: FPL API is the primary source for
player/match/season performance data (confirmed, current PL season only). football-data.co.uk
supplements with team-level match stats and long history. football-data.org's free tier is only
usable for fixtures/results/standings, but is the one identified free source that lists Champions
League at all. Understat and minute-level event providers (e.g. api-football) are explicitly
**deferred, unverified dependencies** — Key Moments v1 is scoped around not needing them.

## 7. Analytics architecture

A layered, versioned engine:

1. **Per-match performance** — normalize each `PlayerMatchPerformance` into position-relative,
   per-90 values.
2. **Category scores** — group per-90 values into the categories the data actually supports today
   (Attack, Creation, Defence, Possession-adjacent proxies via defensive contribution, Impact via
   bonus/BPS components). "Progression" is explicitly **not implemented in v1** — we don't have
   progressive-passing data from any confirmed free source, and it will not be faked. It's
   documented as a deferred category pending a richer data source.
3. **Position-aware normalization, applied selectively** — Attack/Creation/Impact/Form are ranked
   league-wide (the metric means the same thing for everyone, so a standalone "best goal threat"
   list should surface attackers, not an outlier defender). Defence is ranked position-relative,
   because what "good defensively" means differs by role. Overall blends both, position-weighted.
4. **Overall score (0–10)** — a weighted composite of category scores, weights specific to
   position/role. Weights are a hypothesis to be validated against visible reality (do the top of
   the ranking match what a knowledgeable fan would expect?), not treated as ground truth from day
   one.
5. **Form** — rolling recent-match window of the same category scores.
6. **Consistency** — variance of match-level scores over a season.
7. **Key Moments** — match-level outlier detection using scoreline/opponent/gameweek context
   (v1), upgradeable to minute-level once a source is validated (v2).

Every score is versioned (`methodology_version`) so the model can change without silently
rewriting history, and every output is traceable to the `MetricValue` rows that produced it.
**No arbitrary weights are being hard-coded into the UI before this layer exists** — the homepage
milestone built now uses real per-90 FPL data with a clearly labeled provisional formula, not a
finished model.

## 8. AI architecture

```ts
interface AIProvider {
  generatePlayerSeasonStory(input: PlayerStoryInput): Promise<string>;
  generateMatchSummary(input: MatchSummaryInput): Promise<string>;
}
```

Inputs are typed, verified-data-only contracts (scores, categories, key moments, real match
facts) — never raw provider payloads, never free text. The Anthropic implementation is the first
`AIProvider`; swapping providers means implementing the interface again. A lightweight
post-generation check will flag any number appearing in AI output that wasn't present in the
input, as a hallucination guard. AI is not built in this pass (Phase 8) — the interface is noted
here so later work slots into the intended shape.

## 9. UI architecture

Design tokens (`styles/tokens.css`) define the palette, type scale, and spacing before any
component is built — restrained colour, one accent used sparingly, no gradients, borders over
shadows, generous whitespace. Tables are a first-class component (this product lives and dies on
whether its ranking table is excellent), not an afterthought bolted onto cards. Mobile collapses
columns rather than introducing horizontal scroll.

## 10. Development phases

Phases 0–2 (this pass): discovery, architecture, data investigation — done, documented above.
Phase 3 (ingestion) and Phase 4 (full analytics engine) are the next real engineering phases and
are **not** completed in this pass. What ships now is the Phase 5 homepage milestone the brief
asked to see immediately, explicitly built on real FPL data with a labeled provisional scoring
formula rather than a finished Phase 4 engine — so the product direction is visible without
pretending the model is done.

## 11. Risks and limitations

- **FPL API is unofficial.** No SLA, no versioning guarantee. Mitigated by the provider
  abstraction and by storing raw payloads (`RawPayload`) so a schema change is a diff, not a
  silent break.
- **Key Moments v1 is match-level, not minute-level**, because no confirmed free source gives
  minute + match-state + attribution together. This is the single biggest gap between the brief's
  vision (section 8) and what's buildable today. Flagged, not hidden.
- **"Progression" and shot-level metrics are not available** from any confirmed free source.
  Either accept the gap, revisit Understat properly (real browser network inspection, not a bare
  fetch), or budget for a paid source later.
- **Champions League data has no confirmed free player-level source yet** — only fixtures/
  standings (football-data.org free tier). The competition abstraction is ready; the data isn't.
- **api-football is unverified** — the free-tier numbers used in `DATA_SOURCES.md` come from
  public claims, not a live-tested account, and must be confirmed before anything depends on it.

## 12. What was built first

The Phase 5 homepage milestone: application shell, design tokens, and the Top Performers ranking
table using real current-season FPL per-90 data, with category tabs (Overall, Form, Attack,
Creation, Progression*, Defence, Impact) and a transparent, clearly-labeled provisional scoring
note. (*Progression is shown as "coming soon" per the data gap above, rather than populated with
invented numbers.) Compact Discover gateways are included below the fold as placeholders for
Phase 12, not built out yet.
