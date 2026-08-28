# Production Data Pipeline Audit — Why GW2's Result Hasn't Appeared

**Investigation only. No code, configuration, or production data was changed to produce this report** — the one write-adjacent action taken was a read-only `vercel env pull` into a local temp file, which was deleted immediately after inspection. Verified directly against the live Vercel project (`football-analytics1/football-analytics-44pa`), the live production database, and the live FPL API — nothing here is assumed from earlier reports.

## Headline answer

**Nothing is broken.** The ingestion pipeline, the cron, the secret, the database connection, and the FPL provider are all working correctly. GW2's opening result (finished 22:07 UTC check: kicked off 19:00 UTC today, FPL already shows it `finished_provisional` with a final score of 1–4) simply **hasn't been ingested yet because it happened after today's one-and-only scheduled ingestion run**, and the next one isn't due until tomorrow morning. This is a **scheduling/frequency gap**, not a failure.

## Findings, in the order asked

**1–3. What database is production connected to, and is it suitable?**
Pulled the real production `DATABASE_URL` from Vercel (`vercel env pull`) and compared its host against the local `.env` used throughout development: both point to the exact same database — `pooled.db.prisma.io` (Prisma Postgres, the same managed, pooled PostgreSQL instance this whole project has used since the SQLite→Postgres migration). It is real PostgreSQL, not SQLite, and it is the persistent, already-proven-suitable-for-Vercel database — not a throwaway or mismatched one. Confirmed by literally querying it: it already holds 616 players, 20 teams, 687 fixtures, and every gameweek of history built up over this whole project.

**4–6. Is the Vercel Cron deployed, active, on what schedule, and has it executed?**
`vercel.json` (committed, present in the repo):
```json
{ "regions": ["fra1"], "crons": [{ "path": "/api/ingest", "schedule": "0 6 * * *" }] }
```
That's **once daily, at 06:00 UTC**. Querying the production database's own `IngestionLog` table (written by every real ingestion run, not a log file that could be stale) shows it firing reliably, every day, at ~06:01 UTC:

```
2026-08-28T06:01:42Z–06:01:49Z  → teams, players, player-news, fixtures, gameweek-stats — all "success"
2026-08-27T06:01:42Z–06:01:50Z  → same, all "success"
2026-08-26T06:01:41Z–06:01:48Z  → same, all "success"
```
The cron is deployed, active, and has executed correctly on schedule every day since deployment. **This is not the problem.**

**7–9. Is `/api/ingest` reachable, is `CRON_SECRET` configured, does ingestion reach the FPL API?**
- `vercel env ls production` confirms both `DATABASE_URL` and `CRON_SECRET` are set as Production config values.
- Hit the route directly (unauthenticated, no side effect — the route checks the secret before doing anything): `football-analytics-44pa-neon.vercel.app/api/ingest` → **401 Unauthorized**, correctly returned by our own code (`X-Matched-Path: /api/ingest`, JSON body), proving the route is reachable and the secret check is live and working.
- One nuance found along the way, not a cause of this issue: the *other* auto-generated alias, `football-analytics-44pa-football-analytics1.vercel.app`, redirects unauthenticated requests to Vercel's own SSO login (`vercel.com/sso-api`) rather than reaching the app at all — that alias has Vercel's **Deployment Protection** switched on. Vercel's own cron invocations bypass deployment protection internally (confirmed empirically: the `IngestionLog` history above proves the cron reaches the route regardless), so this hasn't blocked ingestion. It would only matter if you ever tried to trigger ingestion by hand by visiting that particular URL in an incognito/non-team browser session — see "Recommended fix" for a clean way around that.
- Every logged run wrote real, non-zero record counts (614–616 players, 687 fixtures, 310 gameweek-stat rows) — the endpoint is genuinely reaching and parsing the live FPL API, not failing silently.

**10–11. Does production currently contain GW2's completed fixture / player performances?**
No, checked directly:
- GW2's 10 fixtures are all still `status: "scheduled"`, `score: null–null` in the database.
- `PlayerMatchPerformance` rows for GW2: **0**.
- But the live FPL API, checked at the same moment: the opening GW2 fixture (kickoff `2026-08-28T19:00:00Z`) is already `finished_provisional: true` with a final score of `1–4`. **The result exists and is ready to ingest — it just hasn't been pulled in yet.**

**Why**: today's only ingestion run happened at **06:01 UTC**, and the match kicked off at **19:00 UTC** — thirteen hours later. The daily cron ran, succeeded, and correctly found nothing new for a match that hadn't been played yet. The next run is scheduled for tomorrow, ~06:01 UTC.

**12. Do the analytics automatically reflect newly ingested rows, or is a separate rebuild needed?**
Automatically — confirmed by reading the code, not assumed. `computeProvisionalRankings()`, Match Rating, Team Intelligence etc. are all computed live, on each request, straight from the database (`getCurrentSeasonPerformanceInputs()` → live Prisma queries). There is no separate "rebuild" or "recalculate" step, no materialized snapshot, and nothing cached at the analytics layer. The instant the next ingestion run writes GW2's rows, the very next page request will compute rankings that include them.

**13. Could Next.js/Vercel caching make the UI look stale even after the database updates?**
A minor factor, but not the current cause. Static-ish routes (homepage, `/discover`, `/matches`, `/teams`, `/methodology`) use `revalidate = 300` (5-minute ISR) per the build output — so after new data lands, those pages could lag by up to 5 minutes. The player page (`/players/[slug]`) also sets `revalidate = 300`. Fully dynamic routes (`/match/[matchId]`, `/matches/[gameweek]`, `/teams/[teamId]`) render on every request with no caching layer at all. None of this explains today's gap — the database itself has no GW2 result to serve yet, cached or not. Once ingestion actually writes the rows, expect the dynamic pages to reflect it instantly and the ISR ones within 5 minutes.

## The actual current architecture, in simple terms

```
Premier League plays a match
        │
        ▼
FPL's public API updates (usually within minutes of full time)
        │
        ▼
Vercel Cron fires "/api/ingest" — but ONLY once a day, at 06:00 UTC
        │  (this is the actual bottleneck for same-day results)
        ▼
runFplIngestion() fetches bootstrap-static + fixtures + gameweek live stats,
writes players/teams/fixtures/performances/news to the production Postgres DB
        │
        ▼
Analytics (rankings, Form, Match Rating, archetypes, etc.) are computed
LIVE from that database on every request — no separate build/rebuild step
        │
        ▼
Next.js renders the page — instantly fresh on dynamic routes,
up to 5 minutes stale on the few ISR-cached routes
        │
        ▼
User sees it in the browser
```

**Where the chain is actually breaking right now:** nowhere structurally — every link works. The gap is purely in the second link's *frequency*: a once-a-day ingestion schedule cannot reflect a match that kicks off in the evening until the following morning's run. Today's match will appear automatically tomorrow around 06:01 UTC, with no action needed from you.

## What needs to happen for future results to appear automatically, without a manual redeploy

Redeploying was never actually part of this loop, and doesn't need to be — ingestion already runs independently of deployments, on its own schedule, against the live database. The only thing to decide is **how often that schedule should run**, since that's the entire gap:

- **Do nothing** — tomorrow's 06:01 UTC run will pick up today's result on its own. This is already how the system is designed to self-heal, just on a 24-hour cadence.
- **Increase cron frequency** (e.g. every 30–60 minutes, or only on matchdays) so same-day evening results land within an hour or two of full time instead of the next morning. This is a one-line change to `vercel.json`'s `schedule`, no ingestion logic changes needed. Worth checking your Vercel plan first — Hobby-tier projects are generally restricted to once-daily cron execution; more frequent schedules typically require a Pro plan.
- **Manually trigger `/api/ingest` on demand** when you want fresher data immediately (e.g. right after watching a match), using the `-neon` alias with the `CRON_SECRET` bearer token so you don't hit the SSO-protected alias by mistake: `curl -H "Authorization: Bearer $CRON_SECRET" https://football-analytics-44pa-neon.vercel.app/api/ingest`. No code change required — the route already supports this exactly as documented in its own file header.

## Recommended fix (not yet implemented)

Increase the Vercel Cron frequency in `vercel.json` — e.g. to run every hour, or every 30 minutes during typical Premier League matchday windows — so same-day results are picked up within roughly an hour of full time instead of waiting for the next morning. This is a single-line schedule change, touches no ingestion, analytics, or UI code, and is the natural, minimal fix for the actual gap identified above. Subject to your current Vercel plan's cron-frequency limits, which is worth confirming in the Vercel dashboard before picking an exact interval.

**Waiting for your approval before making this or any other change.**
