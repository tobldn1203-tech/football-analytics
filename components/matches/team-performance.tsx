import { TeamCrest } from "@/components/identity/team-crest";
import { getTeamColor } from "@/lib/competitions/teamBranding";
import type { TeamPerformanceSummary } from "@/lib/analytics/scoring/matchRepository";

/**
 * A side-by-side read on which TEAM performed better — deliberately just
 * two numbers and a bar, not a breakdown. The number itself is a
 * minutes-weighted average of the same Match Ratings shown throughout this
 * page (see `computeTeamPerformance` in matchRepository.ts) — not a new
 * team-rating methodology, so both numbers use the same cyan
 * Match-Rating-family colour as everywhere else on this page. Each side's
 * own club colour is used only as a subtle accent (crest ring, bar
 * segment) reinforcing WHICH team a number belongs to — never as the
 * number's own colour, so "this is a Match Rating" stays unambiguous.
 */
export function TeamPerformance({
  home,
  away,
  homeTeam,
  awayTeam,
}: {
  home: TeamPerformanceSummary;
  away: TeamPerformanceSummary;
  homeTeam: { shortName: string; crestUrl: string | null };
  awayTeam: { shortName: string; crestUrl: string | null };
}) {
  if (home.rating === null && away.rating === null) return null;

  const homeScore = home.rating ?? 0;
  const awayScore = away.rating ?? 0;
  const total = homeScore + awayScore || 1;
  const homePct = (homeScore / total) * 100;
  const homeColor = getTeamColor(homeTeam.shortName);
  const awayColor = getTeamColor(awayTeam.shortName);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <TeamRatingBlock team={homeTeam} rating={home.rating} align="left" accent={homeColor} />
        <TeamRatingBlock team={awayTeam} rating={away.rating} align="right" accent={awayColor} />
      </div>
      <div className="mt-2.5 flex h-[6px] overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className="h-full" style={{ width: `${homePct}%`, backgroundColor: homeColor }} />
        <div className="h-full" style={{ width: `${100 - homePct}%`, backgroundColor: awayColor }} />
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
        Team Performance — a minutes-weighted average of each side&rsquo;s Match Ratings.
      </p>
    </div>
  );
}

function TeamRatingBlock({
  team,
  rating,
  align,
  accent,
}: {
  team: { shortName: string; crestUrl: string | null };
  rating: number | null;
  align: "left" | "right";
  accent: string;
}) {
  const content = (
    <>
      <span className="rounded-full ring-2" style={{ ["--tw-ring-color" as string]: accent }}>
        <TeamCrest crestUrl={team.crestUrl} shortName={team.shortName} size="md" />
      </span>
      <span className="text-[13px] font-medium text-[var(--color-ink-soft)]">{team.shortName}</span>
    </>
  );
  return (
    <div className={`flex flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}>
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>{content}</div>
      <span className="font-display text-[28px] font-semibold leading-none tabular text-[var(--color-info)]">
        {rating !== null ? rating.toFixed(1) : "—"}
      </span>
    </div>
  );
}
