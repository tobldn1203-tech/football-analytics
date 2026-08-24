import { NextResponse } from "next/server";
import { runFplIngestion } from "@/lib/ingestion/fpl/runIngestion";

/**
 * The one trigger point for automatic ingestion.
 *
 * Locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/ingest`
 * (or the convenience script `npm run ingest:watch`, which doesn't go through
 * HTTP at all — see scripts/ingest-watch.ts).
 *
 * On Vercel: wired up via vercel.json's `crons` entry. Vercel automatically
 * sends `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests
 * when the `CRON_SECRET` environment variable is set on the project — this
 * is Vercel's own documented pattern for securing cron routes, not a
 * bespoke scheme. This route is otherwise identical to running
 * `npm run ingest` by hand; it does not duplicate or reimplement any
 * ingestion logic.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  // No secret configured at all (e.g. a fresh local checkout before anyone
  // has set one) — allow the request through rather than lock the route
  // with no way to unlock it, but say so in the response so it's obvious
  // this isn't the secured state.
  const authenticated = Boolean(secret);

  try {
    const summary = await runFplIngestion();
    return NextResponse.json({ ok: true, authenticated, ...summary });
  } catch (err) {
    console.error("Ingestion failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
