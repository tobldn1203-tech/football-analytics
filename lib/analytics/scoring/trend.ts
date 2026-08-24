/**
 * Turns a sequence of already-displayed match values (oldest → newest) into
 * a plain "improving / steady / declining" read — the same judgement a fan
 * would make glancing at the chart, computed instead of eyeballed. No new
 * data, no hidden statistic: this describes exactly what's on screen.
 */
export type TrendDirection = "up" | "down" | "steady";

export interface TrendSummary {
  direction: TrendDirection;
  label: string;
}

export function describeTrend(values: number[]): TrendSummary {
  if (values.length < 2) {
    return { direction: "steady", label: "Not enough matches yet" };
  }

  const mid = Math.max(1, Math.floor(values.length / 2));
  const earlier = values.slice(0, mid);
  const recent = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / arr.length;
  const earlierAvg = avg(earlier);
  const recentAvg = avg(recent);
  const delta = recentAvg - earlierAvg;
  const threshold = Math.max(earlierAvg * 0.2, 3);

  if (delta > threshold) return { direction: "up", label: "Improving" };
  if (delta < -threshold) return { direction: "down", label: "Declining" };
  return { direction: "steady", label: "Steady" };
}

/** Cheap directional read for table rows, from scores already computed — no extra data needed. */
export function directionFromScoreDelta(delta: number): TrendDirection {
  if (delta > 0.5) return "up";
  if (delta < -0.5) return "down";
  return "steady";
}
