/**
 * Ranks each value in `values` as a percentile (0–100) within that same
 * array, using fractional ranking so tied values receive the same
 * percentile. Higher value = higher percentile.
 *
 * This is the core trick the provisional scoring model relies on: raw
 * per-90 metrics are on wildly different scales (a save rate vs. a goals
 * rate), but a percentile is always 0–100, so category composites can
 * average several metrics together without unit mismatches distorting the
 * result.
 *
 * Pure and deterministic — the whole reason the analytics engine can be
 * unit-tested independently of the database or UI.
 */
export function percentileRank(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [50];

  const sorted = [...values].sort((a, b) => a - b);

  // Average rank for tied values (0-indexed), then scale to 0–100.
  const rankOf = new Map<number, number>();
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && sorted[j] === sorted[i]) j++;
    const avgRank = (i + j - 1) / 2;
    rankOf.set(sorted[i], avgRank);
    i = j;
  }

  return values.map((v) => (rankOf.get(v)! / (n - 1)) * 100);
}
