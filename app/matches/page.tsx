import { redirect, notFound } from "next/navigation";
import { getAvailableGameweeks } from "@/lib/analytics/scoring/matchRepository";
import { pickDefaultGameweek } from "@/lib/analytics/scoring/currentGameweek";

export const revalidate = 300;

export default async function MatchesLandingPage() {
  const gameweeks = await getAvailableGameweeks();
  if (gameweeks.length === 0) notFound();

  // The gameweek closest to right now, by real fixture kickoff dates — see
  // currentGameweek.ts. Not "the highest gameweek with a finished match":
  // that previous rule could leave /matches pointed at last week's
  // gameweek for hours after today's fixtures kick off, simply because
  // today's results hadn't been ingested yet (see
  // docs/PRODUCTION_DATA_PIPELINE_AUDIT.md).
  const target = pickDefaultGameweek(
    gameweeks.map((g) => ({
      gameweek: g.gameweek,
      earliestKickoff: new Date(g.earliestKickoff),
      latestKickoff: new Date(g.latestKickoff),
    }))
  );
  if (target === null) notFound();

  redirect(`/matches/${target}`);
}
