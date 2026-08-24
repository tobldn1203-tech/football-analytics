import { redirect, notFound } from "next/navigation";
import { getAvailableGameweeks } from "@/lib/analytics/scoring/matchRepository";

export const revalidate = 300;

export default async function MatchesLandingPage() {
  const gameweeks = await getAvailableGameweeks();
  if (gameweeks.length === 0) notFound();

  const withResults = gameweeks.filter((g) => g.finishedCount > 0);
  const target = withResults.length > 0 ? withResults[withResults.length - 1] : gameweeks[0];

  redirect(`/matches/${target.gameweek}`);
}
