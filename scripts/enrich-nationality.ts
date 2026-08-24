import { prisma } from "@/lib/db/client";
import { fetchFplBootstrap } from "@/lib/providers/fpl/client";
import { matchNationality } from "@/lib/ingestion/nationality/match";

/**
 * NATIONALITY ENRICHMENT — a separate, occasional script, not part of the
 * daily FPL ingestion cron.
 * ==========================================================================
 * Why separate? Nationality essentially never changes for an existing
 * player, so there's no value in re-querying Wikidata for ~600 players on
 * every daily ingestion run — that would just be unnecessary load on a
 * public, shared endpoint. This script only looks up players who don't yet
 * have a nationality on record, so it's cheap and safe to re-run — e.g.
 * after a transfer window brings in new signings:
 *
 *   npx tsx scripts/enrich-nationality.ts
 *
 * See lib/ingestion/nationality/match.ts for the full reasoning on data
 * source choice and matching strategy — this script is just the glue: FPL
 * bootstrap (for birth dates, used only as a matching key — never stored)
 * + Wikidata (for the actual nationality) + Prisma (to persist it).
 */

// Respectful of Wikidata's shared public endpoint — no batching API exists
// for this, so requests are sequential with a small delay between them.
const REQUEST_DELAY_MS = 800;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const players = await prisma.player.findMany({
    where: { provider: "fpl", nationality: null },
    select: { id: true, externalId: true, firstName: true, lastName: true, displayName: true },
  });

  if (players.length === 0) {
    console.log("Nothing to do — every player already has a nationality on record (or none exist yet).");
    return;
  }

  console.log(`Looking up nationality for ${players.length} player(s)...`);

  const bootstrap = await fetchFplBootstrap();
  const birthDateByExternalId = new Map(
    bootstrap.elements.map((p) => [String(p.id), p.birth_date ?? null])
  );

  let matched = 0;
  let noBirthDate = 0;
  let noMatch = 0;

  for (const player of players) {
    const birthDate = birthDateByExternalId.get(player.externalId);
    if (!birthDate) {
      noBirthDate++;
      continue;
    }

    try {
      const result = await matchNationality({
        firstName: player.firstName,
        lastName: player.lastName,
        webName: player.displayName,
        birthDate,
      });

      if (result) {
        await prisma.player.update({
          where: { id: player.id },
          data: { nationality: result.country, nationalityCode: result.code },
        });
        matched++;
        console.log(`  ✓ ${player.displayName} → ${result.country} (${result.code})`);
      } else {
        noMatch++;
      }
    } catch (err) {
      console.error(`  ✗ ${player.displayName}: ${err instanceof Error ? err.message : String(err)}`);
      noMatch++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nDone: ${matched} matched, ${noMatch} no confident match, ${noBirthDate} missing a birth date. ` +
      `${noMatch + noBirthDate} player(s) will show no flag — that's the intended fallback, not an error.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Nationality enrichment failed:", err);
    process.exit(1);
  });
