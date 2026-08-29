# Matchday Ingestion / Data Freshness — Investigation & Outcome

Companion to `docs/PRODUCTION_DATA_PIPELINE_AUDIT.md`, which established that ingestion works correctly but only once daily. This investigates whether/how to improve freshness, and what was actually changed.

## Findings

**Current schedule:** `vercel.json` → `0 6 * * *`, once daily. Confirmed reliably executing (`IngestionLog`).

**Current ingestion cost:** Two requests per run regardless of season stage (`bootstrap-static`, `fixtures`), plus one `event/{gw}/live` request **per gameweek FPL has ever marked `finished_provisional`, recomputed from scratch on every run.** At GW2 this is 1–2 extra requests; by GW38 it would have been 38 — an unbounded, purely-wasteful cost that grows for the rest of the season, since a long-finished gameweek's stats never change again.

**Idempotency:** Verified directly, not assumed — ran the real pipeline twice in immediate succession against the shared database and compared row counts:

| | Run 1 | Run 2 |
|---|---|---|
| players | 622 | 622 |
| teams | 20 | 20 |
| matches | 380 | 380 |
| performances | 342 | 342 |
| news | 135 | 135 |
| IngestionLog | +5 | +5 (expected — one audit row per task, per run) |

Zero drift anywhere except the intentional audit log. Every write is a Prisma `upsert` on a real unique constraint; safe to run any number of times.

**Vercel plan — the decisive constraint.** Queried the Vercel account API directly: this project is on the **Hobby (free) plan**. Per Vercel's own current documentation (fetched directly, 2026-07-15 revision): *Hobby accounts are limited to cron jobs that run once per day — a more frequent cron expression fails at deployment*, and even the one daily run has no timing guarantee (±59 minutes). **Hourly cron is not available on this plan without upgrading**, which is exactly why the naive "just make it hourly" answer was wrong to assume.

**FPL API considerations:** No documented rate limit — it's an unofficial, undocumented public API with no published SLA. A 30–60 minute polling cadence is well within what community tools commonly do.

**Decision:** presented three realistic paths — (a) GitHub Actions scheduled workflow calling the existing `/api/ingest` endpoint, (b) upgrade to Vercel Pro for native per-minute cron, (c) stay on the daily cron and rely on the existing manual-trigger endpoint when fresher data is wanted sooner. **Chosen: (c), stay daily + manual trigger.** No new external service, no new cost, no change to the deployed schedule.

## What was changed

Given (c), the schedule itself (`vercel.json`) is unchanged. The one code change made is independent of frequency and worth doing regardless: **bounding the unbounded per-gameweek-stats cost** identified above.

- **New: `lib/ingestion/fpl/selectGameweeksToRefresh.ts`** — a small, pure function. Of every gameweek FPL reports as having a finished fixture, only the most recent `GAMEWEEK_REFRESH_WINDOW` (2) are actually re-fetched. Two, not one, because `finished_provisional` can be true for hours before bonus points/BPS are fully locked in (see `docs/DATA_SOURCES.md`) — a gameweek that only just finished can still shift slightly, so the previous one stays in scope as a safety margin. Anything older than that is never touched again — it was already correctly ingested the first time it was in-window.
- **`runIngestion.ts`** — one line: `ingestGameweekStats(gameweeksToRefresh, ...)` instead of the full unbounded list.

At the current point in the season (GW2), this changes nothing observable (both gameweeks are already within the window) — its value is entirely about keeping every future daily run fast and cheap instead of slower every single week for the rest of the season.

## Manual ingestion mechanism

**Already exists — no new code needed.** `app/api/ingest/route.ts`, protected by `CRON_SECRET` (`Authorization: Bearer <secret>`), calls the exact same `runFplIngestion()` the cron uses — not a separate, divergent path. Verified live against production today:

```
curl https://football-analytics-44pa-neon.vercel.app/api/ingest
→ 401 {"error":"Unauthorized"}   (no secret — correctly rejected)

curl -H "Authorization: Bearer <CRON_SECRET>" https://football-analytics-44pa-neon.vercel.app/api/ingest
→ 200 {"ok":true,"authenticated":true,"season":"2026/27", ...}
```

`IngestionLog` immediately showed the resulting run. This is the answer to "how do I get fresher data sooner without waiting for tomorrow's cron" — run that command (the secret is in the Vercel dashboard's environment variables, or via `vercel env pull`) any time after a match finishes. It is not exposed anywhere in the UI, requires the secret, and does nothing a normal user could trigger by accident.

## Deployment verification

1. **Cron schedule now configured:** unchanged, `0 6 * * *` (daily). No change was made per the decision above.
2. **Does Vercel accept it:** yes — it's within Hobby's once-daily limit (confirmed via Vercel's own account API and docs).
3. **Is the cron endpoint protected:** yes, verified live (401 without the secret, 200 with it).
4. **Does a production invocation succeed:** yes, verified live against the actual deployed function today (not a local simulation).
5. **What appeared in `IngestionLog`:** all 5 tasks (`teams`, `players`, `player-news`, `fixtures`, `gameweek-stats`), all `"success"`, matching record counts.
6. **Expected freshness after a match:** automatically, up to ~24 hours (next scheduled run) — or within minutes, manually, using the command above. Once ingested, every page reflects it immediately (dynamic routes) or within 5 minutes (the few ISR-cached routes) — there is no separate rebuild/recalculation step; see `docs/PRODUCTION_DATA_PIPELINE_AUDIT.md` §12.
7. **Remaining platform limitation:** the daily cron's own timing isn't precise even at once-per-day (±59 minutes per Vercel's Hobby-tier guarantee) — not fixable without a plan change, and not in scope given the decision above.
