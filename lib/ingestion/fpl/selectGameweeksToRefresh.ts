/**
 * MATCHDAY INGESTION — bounding the per-gameweek live-stats refetch
 * ==========================================================================
 * See docs/PRODUCTION_DATA_PIPELINE_AUDIT.md and
 * docs/MATCHDAY_INGESTION_AUDIT.md. Without this, `runIngestion.ts` would
 * re-fetch FPL's `event/{gw}/live` endpoint for EVERY gameweek that has
 * ever finished this season, on every single ingestion run — 1 extra
 * request at GW2, but 38 extra requests by GW38, forever re-processing
 * matches settled months ago. That's real, growing, unnecessary cost with
 * zero benefit: a gameweek's stats don't change once FPL has finalised
 * them.
 *
 * The fix is a small, bounded trailing window rather than new state/schema
 * to track "is this gameweek fully final yet" — deliberately, since
 * FPL's own `finished_provisional` can be true for hours before bonus
 * points/BPS are fully locked in (see docs/DATA_SOURCES.md), a
 * just-finished gameweek's stats can still shift slightly after the fact.
 * Keeping the most recent REFRESH_WINDOW gameweeks in scope (not just the
 * single latest one) is a safety margin for that late-settling case,
 * without ever re-touching gameweeks from further back.
 */
export const GAMEWEEK_REFRESH_WINDOW = 2;

/**
 * Given every gameweek FPL currently reports as having at least one
 * finished_provisional fixture, returns only the most recent
 * `GAMEWEEK_REFRESH_WINDOW` of them — the ones whose stats could still
 * plausibly be settling. Pure, no I/O, fully deterministic.
 */
export function selectGameweeksToRefresh(finishedGameweeks: number[]): number[] {
  return [...new Set(finishedGameweeks)]
    .sort((a, b) => b - a)
    .slice(0, GAMEWEEK_REFRESH_WINDOW);
}
