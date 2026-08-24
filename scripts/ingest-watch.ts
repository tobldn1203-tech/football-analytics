/**
 * Local-development convenience: repeats `npm run ingest` on an interval so
 * gameweek data refreshes automatically while you have this running in a
 * terminal — the closest equivalent to the Vercel Cron trigger
 * (see vercel.json, app/api/ingest/route.ts) that works without deploying
 * anywhere. This is NOT what runs in production; it's a stand-in for local
 * sessions. Stop with Ctrl+C.
 */
import { runFplIngestion } from "@/lib/ingestion/fpl/runIngestion";

const INTERVAL_MINUTES = Number(process.env.INGEST_INTERVAL_MINUTES) || 30;

async function tick() {
  const startedAt = new Date().toISOString();
  try {
    const summary = await runFplIngestion();
    console.log(`[ingest-watch] ${startedAt} — ok:`, summary);
  } catch (err) {
    console.error(`[ingest-watch] ${startedAt} — failed:`, err);
  }
}

console.log(
  `[ingest-watch] starting — will ingest now, then every ${INTERVAL_MINUTES} minute(s). Ctrl+C to stop.`
);

tick();
const timer = setInterval(tick, INTERVAL_MINUTES * 60_000);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("\n[ingest-watch] stopped.");
  process.exit(0);
});
