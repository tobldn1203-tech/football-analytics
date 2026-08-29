# Team Intelligence Refinement + Club Navigation

Design/audit note, written before implementation, per this task's own instruction.

## Part 1 — Why Performance Profile is being removed

Inspected before touching anything: `TeamPerformanceProfile` (`components/teams/team-performance-profile.tsx`) was used in exactly one place, `app/teams/[teamId]/page.tsx` — confirmed by a repo-wide search before removal. Nothing else renders it, so removing its presentation has zero blast radius elsewhere.

**What remains available:** the underlying `seasonScores` (Attack/Creation/Defence/Impact/Overall) is still computed, unchanged, inside `getTeamProfile()` (`lib/analytics/scoring/teamRepository.ts`) — it feeds `buildTeamStory()` (the Team Overview paragraph) and `detectStrengths()` (strengths/development areas) exactly as before. Only the *standalone visual section* is gone; the numbers, the story text, and the strengths/development-area detection are all untouched. The `TeamPerformanceProfile` component **file itself is left in place, unused** — the brief was explicit ("I do not want it redesigned or replaced") that this is a presentation decision, not a deletion, so the component stays available rather than being removed from the codebase.

**What answers "what's working/what isn't" now, without a dedicated section:** `buildTeamStory()` already narrates the team's strongest category in prose once confidence allows it (e.g. "driven more by chance creation than defensive performances") — verified by reading `lib/analytics/story/teamStory.ts` directly, not assumed. It never narrates the *development area* (weakness) in prose, though, so Team Overview gains exactly one small supporting line beneath the story paragraph — "Strongest area: X · Area to watch: Y" — reusing the identical `strengths`/`developmentAreas` arrays, not a new card, not a ranked list, not a new component. This is the minimum needed to keep answering that question without "compensating... by adding more sections."

## Part 2/6 — Proposed hierarchy

```
Team Identity (hero)
Team Overview  — story, + one small "what's working/what isn't" line
Players Driving the Team  — promoted well above the fold
Availability Watch / Worth Knowing  — "what should I know right now"
Performance Journey
Match History
League Position
Next Fixture
```

This adapts the brief's own suggested order in one deliberate way: Availability Watch sits right after Players Driving rather than dead last. The brief's own Part 6 comprehension list orders "what should I know right now" as step 5 of 7 — meaningfully earlier than "league position" or "what's coming next" — so keeping it near the top of the page (not buried below Match History/League Position) is truer to that comprehension order than a literal reading of the Part 2 sketch, which the brief explicitly invited deviating from ("if your inspection shows a better hierarchy").

## Part 3 — Players Driving the Team treatment

Redesigned as a compact, single-column list of rows (not a card grid) — see `components/teams/team-players-driving.tsx`. Per row: avatar, nationality flag, name (links to the player page), position, a short football-language reason ("Leading the attack" instead of a dashboard label "Biggest attacking threat"), the player's existing Archetype label where one exists (no new computation — the same `classifyArchetype()` the player page already calls), and the player's existing season Performance score on the right, consistently — never a mix of different metrics across rows, which would be harder to scan.

**One genuine presentation improvement, not a data change:** a player who qualifies for more than one slot (e.g. the team's standout performer is also its biggest attacking threat — a real, observed case on the current Arsenal squad, Saka) now gets **one row with both reasons joined**, rather than the same avatar and name appearing twice in the list. Purely a grouping decision over the same five existing slots; no new "who's driving the team" logic.

No progress bars, no meters, no giant attribute grid, no pills beyond the identity flag — the score is the only number on the row, and it's the same 0–10 Performance scale used everywhere else in the app, not a new rating.

## Part 4/5 — Navigation surfaces audited, canonical routes

**Canonical routes** (confirmed from the App Router structure, not assumed):
- Player → `/players/[slug]`
- Team → `/teams/[teamId]`
- Match → `/match/[matchId]`
- Gameweek → `/matches/[gameweek]`
- Discover → `/discover`

**Data gap found and fixed (additive only):** `RankedPlayer`, `PlayerProfileData.player`, `PlayerMatchRow`, `TeamIdentitySlim` (Match Centre), and `TeamMatchHistoryEntry`/`nextFixture` did not carry a team **id** — only `teamShortName`/crest — so nothing built on them could link to a team page at all. Added `teamId`/`opponentTeamId`/`id` as pass-through identity fields, exactly the same pattern already established for `nationality`/`nationalityCode` (see `lib/analytics/scoring/types.ts`) — never a scoring change, just plumbing an id that was already sitting on the underlying `Player`/`Match` rows through to the view layer.

**Component change:** `TeamIdentity` (`components/identity/team-identity.tsx`) gained an optional `teamId` prop — when present, it renders as a link to that club's Team Intelligence page; omitted, it renders exactly as before (a plain span). This is backward compatible with every existing call site.

**Surfaces where club navigation was added:**
- Player page hero — the player's own club identity (crest + name) now links to their Team Intelligence page. This is the brief's own worked example.
- Player page "Best Performances" — the opponent crest/name links to their team page.
- Homepage Top Performers table — the team column links to the team page.
- Match Centre hero — both team crests+names link to their team pages.
- Match Centre "Squad performance" headers — both team headers link.
- Match Centre "Team performance" (the two-number comparison) — both team blocks link.
- Match Centre "Who ran the show?" (Performance Leaders) — each side's team header links.
- Match Centre "Match standout" — the standout's club line links.
- Matches/gameweek `FixtureCard` — both team names+crests link to their team pages.
- Team page "Match history" — the opponent link to their team page.
- Team page "Next fixture" — the opponent link to their team page.
- League table (`/teams`, and the compact strip on a team's own page) — already linked every row before this task; unchanged.
- My Football widget — the club header (crest+name) already linked to the team page (the entire header row was already one `Link`); unchanged.

**Nested-link considerations — where a whole card/row used to be one link, it was restructured into sibling links, never a nested `<a>`:**
- `FixtureCard` was previously one `Link` wrapping the entire row (both teams + score). Nested `<a>` tags are invalid HTML and Next.js will not render two independently clickable link targets inside one anchor. Restructured into three sibling elements: home team `Link`, match `Link` (the score/kickoff), away team `Link`.
- `TeamMatchHistory`'s row was previously one `Link` to the match with the opponent crest/name inside it. Restructured into an outer `<div>` with two sibling `Link`s: opponent (their team page) and the rest of the row (the match).
- Season Story's "Best Performances" cards had the same shape and received the same fix.

**Surfaces deliberately left without a club link:**
- `PlayerIdentity`'s small corner crest badge (used in ranking/list rows elsewhere) — it carries no visible team name, is purely a decorative accessory to the player's own avatar, and every one of its usages already sits inside a row whose real destination is the player page. Adding a second, tiny, unlabelled nested link target here would be exactly the "noisy/confusing" outcome the brief warned against, for a badge nobody would expect to be independently clickable.
- `MatchEvents` (goals/assists/cards rows) — the crest is a small unlabelled icon identifying which side scored; the player name is already the row's real link. Same reasoning as above.
- Discover cards — the entire card is already one clear link to the player; the team crest is a small decorative accessory, not a labelled club identity moment.

## Part 7 — Mobile

`TeamPlayersDriving`'s new row layout is a single flex row at every width — avatar, text block (which truncates rather than wrapping), score — so it was never a desktop grid that needed "un-stacking" for mobile; it reads identically, just narrower, exactly the "horizontal player rows" the brief asked for. `FixtureCard`'s three-link restructuring keeps the same flex layout, so its mobile behaviour (already single-row) is unchanged. Verified in the browser at 390px width — see the final report.
