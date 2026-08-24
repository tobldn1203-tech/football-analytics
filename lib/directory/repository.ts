import { prisma } from "@/lib/db/client";
import { getTeamCrestUrl } from "@/lib/assets/images";

/**
 * Lightweight identity-only lookups — team names/crests, no scoring
 * involved. Distinct from lib/analytics/scoring/repository.ts on purpose:
 * this is "who exists", not "how are they performing", so it's cheap
 * enough to fetch once per session (see
 * components/personalisation/personalisation-provider.tsx) and reuse
 * everywhere a preference needs to resolve a club id into something
 * displayable — the club picker, the header's "My Football" widget, the
 * homepage's personalised section.
 */

export interface TeamSummary {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export async function getAllTeams(): Promise<TeamSummary[]> {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } });
  if (!season) return [];

  const teams = await prisma.team.findMany({
    where: { competitionId: season.competitionId },
    orderBy: { name: "asc" },
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    crestUrl: getTeamCrestUrl(t.crestCode),
  }));
}
