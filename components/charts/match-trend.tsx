import { TeamCrest } from "@/components/identity/team-crest";

export interface MatchTrendPoint {
  value: number;
  opponentShortName: string;
  opponentCrestUrl: string | null;
  isHome: boolean;
}

const VIEWBOX_W = 480;
const PADDING = 14;

/**
 * A restrained trend line with no axes, gridlines or numeric labels — the
 * point is the shape (rising, falling, steady), not the precise values.
 * Opponents are shown as crests beneath each point so the sequence reads
 * as "matches", not just "data". Scales to any container width.
 */
export function MatchTrend({
  points,
  height = 76,
  color = "var(--color-accent)",
}: {
  points: MatchTrendPoint[];
  height?: number;
  /** CSS color value for the line/dots — defaults to the season-Performance accent. Pass `var(--color-info)` for match-level (Match Rating) trends, matching the Match Centre's cyan-for-match-level convention. */
  color?: string;
}) {
  if (points.length === 0) {
    return <p className="text-[12.5px] text-[var(--color-ink-faint)]">No matches yet.</p>;
  }

  // A single point has no trend to draw — a compact match summary reads
  // more intentional than a lone dot stranded above an empty chart.
  if (points.length === 1) {
    const [p] = points;
    return (
      <div className="flex items-center gap-2.5 rounded-md bg-[var(--color-surface-2)] px-3.5 py-3">
        <TeamCrest crestUrl={p.opponentCrestUrl} shortName={p.opponentShortName} size="md" />
        <p className="text-[13px] text-[var(--color-ink-soft)]">
          {p.isHome ? "vs" : "@"} <span className="font-medium text-[var(--color-ink)]">{p.opponentShortName}</span>{" "}
          — only one match played so far. A trend will appear after a few more.
        </p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const usableW = VIEWBOX_W - PADDING * 2;
  const lineArea = height - 14;

  const coords = points.map((p, i) => {
    const x = PADDING + (i / (points.length - 1)) * usableW;
    const y = 4 + lineArea - ((p.value - min) / range) * lineArea;
    return { x, y };
  });

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEWBOX_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Match-by-match performance trend"
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.25 : 2.25}
            fill={i === coords.length - 1 ? color : "var(--color-surface)"}
            stroke={color}
            strokeWidth={1.25}
          />
        ))}
      </svg>
      <div className="relative h-5">
        {coords.map((c, i) => (
          <div
            key={i}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${(c.x / VIEWBOX_W) * 100}%` }}
            title={`${points[i].isHome ? "vs" : "@"} ${points[i].opponentShortName}`}
          >
            <TeamCrest
              crestUrl={points[i].opponentCrestUrl}
              shortName={points[i].opponentShortName}
              size="sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
