import { prisma } from "@/lib/db/client";
import type { FplTeam } from "@/lib/providers/fpl/types";
import { PROVIDER } from "./context";

/** Upserts all Premier League teams. Safe to run repeatedly. */
export async function ingestTeams(teams: FplTeam[], competitionId: string) {
  let written = 0;
  for (const t of teams) {
    await prisma.team.upsert({
      where: { provider_externalId: { provider: PROVIDER, externalId: String(t.id) } },
      create: {
        provider: PROVIDER,
        externalId: String(t.id),
        name: t.name,
        shortName: t.short_name,
        crestCode: t.code,
        competitionId,
      },
      update: { name: t.name, shortName: t.short_name, crestCode: t.code },
    });
    written++;
  }
  return written;
}
