import { prisma } from "@/lib/db/client";
import { PREMIER_LEAGUE } from "@/lib/competitions/premier-league";
import type { FplBootstrap } from "@/lib/providers/fpl/types";

export const PROVIDER = "fpl";

/**
 * Ensures the Competition and current Season rows exist, deriving the
 * season label ("2026/27") from the bootstrap's gameweek deadlines rather
 * than hard-coding a year.
 */
export async function ensureCompetitionAndSeason(bootstrap: FplBootstrap) {
  const competition = await prisma.competition.upsert({
    where: { provider_code: { provider: PROVIDER, code: PREMIER_LEAGUE.id } },
    create: {
      provider: PROVIDER,
      code: PREMIER_LEAGUE.id,
      name: PREMIER_LEAGUE.name,
    },
    update: { name: PREMIER_LEAGUE.name },
  });

  const firstDeadline = new Date(bootstrap.events[0]?.deadline_time ?? Date.now());
  const seasonStartYear =
    firstDeadline.getMonth() >= 5 // June or later -> season starts this year
      ? firstDeadline.getFullYear()
      : firstDeadline.getFullYear() - 1;
  const label = `${seasonStartYear}/${String(seasonStartYear + 1).slice(2)}`;
  const externalId = String(seasonStartYear);

  // Only one current season at a time.
  await prisma.season.updateMany({
    where: { competitionId: competition.id, isCurrent: true },
    data: { isCurrent: false },
  });

  const season = await prisma.season.upsert({
    where: { provider_externalId: { provider: PROVIDER, externalId } },
    create: {
      provider: PROVIDER,
      externalId,
      label,
      isCurrent: true,
      competitionId: competition.id,
    },
    update: { label, isCurrent: true },
  });

  return { competition, season };
}

export async function logIngestion<T>(
  task: string,
  fn: () => Promise<{ recordsWritten: number; result: T }>
): Promise<T> {
  const log = await prisma.ingestionLog.create({
    data: { provider: PROVIDER, task, status: "running" },
  });
  try {
    const { recordsWritten, result } = await fn();
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: { status: "success", recordsWritten, finishedAt: new Date() },
    });
    return result;
  } catch (err) {
    await prisma.ingestionLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}
