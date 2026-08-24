import { prisma } from "@/lib/db/client";
import type { FplPlayer } from "@/lib/providers/fpl/types";
import { FPL_ELEMENT_TYPE_TO_POSITION } from "@/lib/competitions/premier-league";
import { slugify } from "@/lib/utils/slug";
import { PROVIDER } from "./context";

/** FPL's `photo` field is like "154561.jpg" — the numeric part is the asset code the official photo CDN uses. */
function photoCodeFrom(photo: string): string | null {
  const match = photo.match(/^(\d+)\./);
  return match ? match[1] : null;
}

/** Upserts all players, resolving each one's team by provider externalId. Safe to run repeatedly. */
export async function ingestPlayers(players: FplPlayer[], competitionId: string) {
  const teams = await prisma.team.findMany({ where: { provider: PROVIDER } });
  const teamIdByExternalId = new Map(teams.map((t) => [t.externalId, t.id]));

  let written = 0;
  for (const p of players) {
    const teamId = teamIdByExternalId.get(String(p.team));
    if (!teamId) continue; // team not ingested yet — skip rather than fail the whole run

    const position = FPL_ELEMENT_TYPE_TO_POSITION[p.element_type] ?? "MID";
    const displayName = p.web_name;
    const slug = slugify(`${displayName}-${p.id}`);
    const photoCode = photoCodeFrom(p.photo);

    await prisma.player.upsert({
      where: { provider_externalId: { provider: PROVIDER, externalId: String(p.id) } },
      create: {
        provider: PROVIDER,
        externalId: String(p.id),
        slug,
        firstName: p.first_name,
        lastName: p.second_name,
        displayName,
        position,
        status: p.status,
        photoCode,
        teamId,
        competitionId,
      },
      update: {
        firstName: p.first_name,
        lastName: p.second_name,
        displayName,
        position,
        status: p.status,
        photoCode,
        teamId,
      },
    });
    written++;
  }
  return written;
}
