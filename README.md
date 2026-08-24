# Premier League Analytics

A premium football performance and analytics platform. Start here:

- [`docs/PROJECT_PROPOSAL.md`](docs/PROJECT_PROPOSAL.md) — product architecture, tech stack,
  folder structure, database/provider/analytics/AI architecture, phases, risks.
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — live investigation of every free data source
  considered, and what's actually confirmed available vs. deferred.

## Status

Database + ingestion pipeline built (PostgreSQL via Prisma — see `prisma/schema.prisma`). The FPL
provider now feeds a normalized database (`lib/ingestion/fpl`), and both the homepage and the new
Player Profile pages (`/players/[slug]`) read only from `lib/analytics/scoring/repository.ts` —
the provider is no longer something the UI depends on directly. Scoring is still the same
**provisional** methodology (see `/methodology`); the full multi-season, opponent-adjusted engine
is future work.

Deployed on Vercel with a PostgreSQL production database — see "Deployment" below.

## Development

Local development uses its own PostgreSQL database (not a local file) — see "Deployment" for how
that database is provisioned. Once you have a `DATABASE_URL` in `.env` (copy `.env.example`):

```bash
npm install
npx prisma migrate dev   # first time only — creates the schema in your database
npm run ingest           # pulls current PL season from FPL into the database
npm run dev               # http://localhost:3000
npm test                  # analytics engine unit tests (Vitest)
npm run build
```

`npm run ingest` is safe to run repeatedly (everything upserts by provider + external id).

## Deployment

- **GitHub** — the source of truth Vercel builds from.
- **Vercel** — hosts the Next.js app. Auto-detects the `vercel-build` script
  (`prisma generate && prisma migrate deploy && next build`), so every deploy applies any pending
  migrations before building.
- **PostgreSQL** — one database for local development, a separate one for production. Both are
  set as `DATABASE_URL` — locally in `.env` (gitignored, never committed), in production as a
  Vercel project environment variable (set in the Vercel dashboard, never committed either).

Required environment variables (see `.env.example`), set in Vercel's project settings for
production and in your own `.env` for local dev:

- `DATABASE_URL` — a PostgreSQL connection string.
- `CRON_SECRET` — secures `/api/ingest`; generate a random value (e.g. `openssl rand -hex 32`).

## Automatic ingestion

`app/api/ingest/route.ts` triggers the same ingestion pipeline over HTTP, secured by the
`CRON_SECRET` bearer token. `vercel.json` schedules it once daily via Vercel Cron. Vercel
automatically sends `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests once
`CRON_SECRET` is set as a project environment variable — this is Vercel's own documented pattern,
not a bespoke scheme.

You can also refresh data manually at any time:

```bash
npm run ingest         # one-off, against whatever DATABASE_URL is in your .env
npm run ingest:watch   # repeats on an interval (default 30 min) — leave running in a terminal
```
