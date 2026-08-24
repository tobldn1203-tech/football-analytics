# Data Source Assessment

Investigated 2026-08-23 by directly querying each source (not from documentation alone).
Raw sample responses referenced here were fetched live; endpoints marked "confirmed" returned
real HTTP 200 payloads inspected during this investigation.

**Update (same day, discovered during ingestion + UI work):**

- `ict_index` (and `influence`/`creativity`/`threat`) on `/event/{gw}/live/` reports `0` for
  every player until FPL finalizes a gameweek — the same kind of lag as `finished_provisional`
  below, just on a different field. `bps` does not have this lag and updates immediately, so the
  scoring engine's Impact/Form categories read `bps`, not `ict_index`. See the comment at the top
  of `lib/analytics/scoring/provisional.ts`.
- The Premier League's own media CDN serves both team crests
  (`resources.premierleague.com/premierleague/badges/{size}/t{team.code}.png`) and player photos
  (`.../photos/players/{size}/p{code}.png`, `code` from the numeric prefix of the `photo` field) —
  confirmed with real HTTP 200s. This is the same CDN premierleague.com and the FPL app use, not a
  scrape of an unrelated site. In practice, a meaningful minority of player photo codes are
  blocked in-browser (`ERR_BLOCKED_BY_ORB`) even though `curl` fetches them fine — some asset IDs
  appear to carry a stricter resource policy. `lib/assets/images.ts` + the `PlayerAvatar` component
  degrade to a generated initial avatar in that case; crests have not shown this issue.

## 1. Fantasy Premier League public API — CONFIRMED, primary source for v1

Base: `https://fantasy.premierleague.com/api/`

Unofficial (no published ToS/SLA — must be treated as "best effort," not a guaranteed contract).
No API key required. No documented rate limit; poll politely (once per gameweek cycle + occasional
manual refresh), not per-request-per-user.

Endpoints confirmed live:

- `GET /bootstrap-static/` — all players (`elements`), all teams, all gameweeks (`events`),
  position types (`element_types`), stat definitions (`element_stats`).
  Player fields include: identity, team, position (`element_type`: 1 GK / 2 DEF / 3 MID / 4 FWD),
  minutes, goals, assists, cards, saves, bonus, bps, `influence`/`creativity`/`threat`/`ict_index`,
  `expected_goals`, `expected_assists`, `expected_goal_involvements`, `expected_goals_conceded`
  (season totals and **per-90 variants**), `defensive_contribution_per_90` (new 2025/26 field —
  tackles/interceptions/blocks/recoveries proxy), `form`, `status`/`news` (injury flags).
- `GET /fixtures/?event={gw}` — fixtures with kickoff time, scoreline, `team_h`/`team_a`,
  and a `stats[]` block attributing goals/assists/cards/bonus/bps **to player IDs per fixture**
  (aggregate counts, no minute-of-event).
- `GET /event/{gw}/live/` — every player's stat line for a single gameweek, plus an `explain[]`
  breakdown of how bonus points were built up per fixture.
- `GET /element-summary/{player_id}/` — **the key endpoint for this product**: `history[]` is
  one row per fixture the player has featured in this season (opponent, home/away, kickoff time,
  scoreline, minutes, goals, assists, cards, saves, bonus, bps, xG, xA, xGI, xGC, defensive actions).
  `history_past[]` gives prior-season *season totals* only (not match-by-match) for players with
  FPL history. `fixtures[]` gives the remaining fixture list with a 1–5 "difficulty" rating usable
  as a rough opponent-strength signal.

**Available:** player identity, position, team, per-match minutes/G/A/cards/saves/bonus,
per-match and per-90 xG/xA/xGI/xGC, aggregate defensive actions, season aggregates, current-season
gameweek structure.

**Not available:** shot counts, shot/pass locations, key passes, progressive passes/carries,
minute-of-event, any data before the current FPL season, any competition other than Premier League.

## 2. football-data.co.uk — CONFIRMED, secondary/team-level source

Base: `https://www.football-data.co.uk/mmz4281/{season}/E0.csv` (E0 = Premier League).
Free CSV downloads, no key, explicitly free for personal use. Fetched `2024/25` season file live
(197KB, 380 rows) and inspected the header row directly.

**Available (team-level, per match):** date, kickoff time, both teams, full-time/half-time score
and result, shots, shots on target, corners, fouls, yellow/red cards (all home vs away, no
per-player attribution), referee, and an extensive set of pre-match and closing bookmaker odds
(match result, over/under 2.5, Asian handicap, multiple bookmakers).

**Not available:** any player-level data, any event timestamps, any locations, any competition
other than declared leagues (has other European leagues, not Champions League).

**Coverage:** Premier League back to 1993/94. Historically strong for validating team-level
season trends and building a long-run baseline (e.g. opponent strength models), but cannot
support player analytics or Key Moments on its own.

## 3. football-data.org — CONFIRMED via docs, free tier is materially limited

Free tier: **10 calls/minute**, ~12 competitions including Premier League and Champions League,
but explicitly **excludes** lineups, goal scorers, and cards/bookings — those are gated behind the
"Free + Deep Data" (€29/mo) tier and above. Free tier gives fixtures, results, and league tables
only.

**Verdict:** useful later as a lightweight, multi-competition fixtures/results/standings source
(this is genuinely useful for the Champions League expansion, since it's the only source here that
even lists UCL) but cannot support player analytics or Key Moments on the free tier.

## 4. Understat — INVESTIGATED LIVE, downgraded to "not a v1 dependency"

Understat has historically been a well-known community source for shot-level xG/xA data embedded
as `JSON.parse(...)` blobs directly in page HTML. I fetched `understat.com/team/Arsenal/2024`
directly (not just read about it) and the classic embedded data blob is no longer present in the
raw HTML — the page has moved to loading data via `team.min.js`/AJAX rather than server-rendered
inline JSON. I could not confirm a stable, scrapable contract in this session.

**Verdict:** do not build Key Moments or the analytics engine on top of Understat for v1. Worth a
dedicated, deliberate re-investigation later (inspecting actual network calls in a real browser)
if shot-level data becomes a priority — but it must not become a silent hard dependency discovered
only when it breaks in production.

## 5. api-football (RapidAPI) — UNVERIFIED, candidate for Key Moments v2

Documented (not independently confirmed live — pricing/docs pages returned 403 to automated
fetch in this session and need a real signed-in check) to offer a free tier of ~100 requests/day,
covering fixtures, lineups, and **fixture events with minute + player + type** (goals, cards,
substitutions) for major competitions including Premier League and Champions League, plus
per-fixture player statistics (shots, passes, duels, tackles, rating).

This is the only realistic free candidate identified for genuine minute-level Key Moments. It must
be verified with a real account and a handful of live test calls before any architectural
dependency is taken on it. ~10 PL matches/week keeps it plausibly within a 100/day budget if
ingestion is batched once per matchday, but this needs to be measured, not assumed.

## Summary verdict for v1 architecture

| Need | Source |
|---|---|
| Player identity, position, team | FPL |
| Player match/season performance (minutes, G/A, xG/xA, defensive actions) | FPL |
| Team match-level stats + long historical baseline | football-data.co.uk |
| Multi-competition fixture/result scaffolding (incl. Champions League later) | football-data.org (free tier) |
| Minute-level Key Moments | **Deferred** — candidate: api-football, unverified |
| Shot-level xG/xA | **Deferred** — candidate: Understat, unverified/fragile |

The `DataProvider` abstraction (see PROJECT_PROPOSAL.md) exists specifically so that adding or
swapping any of the deferred sources later touches one adapter, not the analytics engine or UI.
