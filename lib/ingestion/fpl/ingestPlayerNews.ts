import { prisma } from "@/lib/db/client";
import type { FplPlayer } from "@/lib/providers/fpl/types";
import { PROVIDER } from "./context";

/**
 * NEWS LAYER — PHASE 1 INGESTION
 * ==========================================================================
 * See docs/NEWS_LAYER_RESEARCH.md for why this is built on FPL's own player
 * `news`/`news_added` fields rather than a general news API or RSS feed —
 * every multi-publisher option investigated either forbids production use
 * on its free tier or requires a paid business licence. This uses data
 * already inside the bootstrap-static payload `ingestPlayers.ts` fetches
 * on every run — no new API call, no new licensing question.
 *
 * Deliberately conservative: FPL's `status` code is the only signal used
 * to classify a note (never text-sniffing the note itself for keywords),
 * and a note with no `news_added` timestamp is skipped rather than
 * assigned a fabricated one — see classifyPlayerNews and mapPlayerNews
 * below, both pure and independently testable.
 */

export type NewsCategory = "injury" | "suspension" | "transfer" | "availability" | "general";

const CATEGORY_BY_STATUS: Partial<Record<string, NewsCategory>> = {
  i: "injury",
  s: "suspension",
  u: "transfer", // FPL's "unavailable" status — observed in practice to mean a departure/loan (see research doc §6)
  d: "availability",
};

const TITLE_BY_CATEGORY: Record<NewsCategory, string> = {
  injury: "Injury update",
  suspension: "Suspension",
  transfer: "Transfer",
  availability: "Availability update",
  general: "Update",
};

/** Pure: FPL's own status code -> our category. Never inferred from the note's text. */
export function classifyPlayerNews(status: string): NewsCategory {
  return CATEGORY_BY_STATUS[status] ?? "general";
}

export interface MappedPlayerNews {
  externalId: string; // dedup key, unique per (provider, externalId)
  category: NewsCategory;
  title: string;
  description: string;
  publishedAt: Date;
}

/**
 * Maps one FPL player's current news note into a NewsItem-shaped record, or
 * null when there's nothing usable — an empty note, or a note with no
 * timestamp we can trust (skipped rather than defaulted to "now", which
 * would misrepresent how current it actually is).
 */
export function mapPlayerNews(player: Pick<FplPlayer, "id" | "news" | "news_added" | "status">): MappedPlayerNews | null {
  const text = player.news?.trim();
  if (!text) return null;
  if (!player.news_added) return null;

  const publishedAt = new Date(player.news_added);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const category = classifyPlayerNews(player.status);
  return {
    externalId: `${player.id}-${player.news_added}`,
    category,
    title: TITLE_BY_CATEGORY[category],
    description: text,
    publishedAt,
  };
}

/**
 * Upserts a NewsItem for every player with a current, timestamped note.
 * Idempotent: re-running with the same news_added value updates the same
 * row (no duplicate); FPL changing the note (a new news_added) creates a
 * new, distinct row, preserving history rather than overwriting it.
 */
export async function ingestPlayerNews(players: FplPlayer[]): Promise<number> {
  const dbPlayers = await prisma.player.findMany({ where: { provider: PROVIDER } });
  const playerIdByExternalId = new Map(dbPlayers.map((p) => [p.externalId, p.id]));

  let written = 0;
  for (const p of players) {
    const mapped = mapPlayerNews(p);
    if (!mapped) continue;

    const playerId = playerIdByExternalId.get(String(p.id));
    if (!playerId) continue; // player not ingested yet — skip rather than fail the whole run

    await prisma.newsItem.upsert({
      where: { provider_externalId: { provider: PROVIDER, externalId: mapped.externalId } },
      create: {
        provider: PROVIDER,
        externalId: mapped.externalId,
        category: mapped.category,
        title: mapped.title,
        description: mapped.description,
        sourceName: "Fantasy Premier League",
        publishedAt: mapped.publishedAt,
        playerId,
      },
      update: {
        // Content for a given (provider, externalId) never actually changes —
        // the key already encodes the exact text-change moment — but keep the
        // upsert symmetrical with the rest of the ingestion pipeline's style.
        category: mapped.category,
        title: mapped.title,
        description: mapped.description,
        sourceName: "Fantasy Premier League",
        publishedAt: mapped.publishedAt,
        playerId,
      },
    });
    written++;
  }
  return written;
}
