import Link from "next/link";
import { PlayerAvatar } from "@/components/identity/player-avatar";
import { NationalityFlag } from "@/components/identity/nationality-flag";
import { POSITION_LABEL } from "@/lib/competitions/premier-league";
import { classifyArchetype } from "@/lib/analytics/archetypes/archetypes";
import type { RankedPlayer } from "@/lib/analytics/scoring/types";

/**
 * PLAYERS DRIVING THE TEAM
 * ==========================================================================
 * See docs/TEAM_NAVIGATION_AND_PLAYER_DRIVERS_REFINEMENT.md. A compact,
 * scannable list — not a grid of FIFA-style attribute cards. No new
 * analytics: every "why" phrase below names one of the same five
 * existing category picks this component always used (standout/in-form/
 * attack/creation/defence), just as plain football language instead of a
 * dashboard label. The one addition is the player's existing Archetype
 * (lib/analytics/archetypes) shown as a light, secondary line — already
 * computed elsewhere in the app, not a new score.
 *
 * A player who qualifies for more than one slot (e.g. the team's standout
 * performer is ALSO its biggest attacking threat) gets ONE row combining
 * both reasons, not two separate, duplicate-looking rows — a presentation
 * choice, not a new dedup "algorithm".
 */

type SlotKey = "standout" | "inForm" | "attackingThreat" | "creativeLeader" | "defensiveStandout";

const SLOTS: Array<{ key: SlotKey; why: string }> = [
  { key: "standout", why: "Standout performer this season" },
  { key: "inForm", why: "In red-hot form" },
  { key: "attackingThreat", why: "Leading the attack" },
  { key: "creativeLeader", why: "Creating the chances" },
  { key: "defensiveStandout", why: "Anchoring the defence" },
];

export function TeamPlayersDriving({
  players,
}: {
  players: Partial<Record<SlotKey, RankedPlayer | null>>;
}) {
  // Group by player: someone filling multiple slots gets one row with
  // every reason they qualify, in the SLOTS list's own priority order —
  // never a repeated avatar/name for the same person.
  const rows: Array<{ player: RankedPlayer; whys: string[] }> = [];
  const rowByPlayerId = new Map<string, (typeof rows)[number]>();
  for (const slot of SLOTS) {
    const player = players[slot.key];
    if (!player) continue;
    let row = rowByPlayerId.get(player.playerId);
    if (!row) {
      row = { player, whys: [] };
      rowByPlayerId.set(player.playerId, row);
      rows.push(row);
    }
    row.whys.push(slot.why);
  }

  if (rows.length === 0) {
    return <p className="text-[13.5px] text-[var(--color-ink-faint)]">Not enough matches yet to single anyone out — too early to call.</p>;
  }

  return (
    <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
      {rows.map(({ player, whys }) => {
        const archetype = classifyArchetype(player);
        return (
          <Link
            key={player.playerId}
            href={`/players/${player.slug}`}
            className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <PlayerAvatar photoUrl={player.photoUrl} name={player.name} teamShortName={player.teamShortName} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-[14.5px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                <NationalityFlag code={player.nationalityCode} country={player.nationality} size="xs" />
                <span className="truncate">{player.name}</span>
              </div>
              {/*
                MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #1b):
                `truncate` alone was cutting this sentence off mid-word at
                375-430px — measured, the worst real row needed 453px of
                text against a 158px budget, losing roughly two-thirds of
                it, with no way to recover the rest on a touch device. The
                exact same content already rendered in full at `sm` and up
                (the row is wide enough there), so `sm:truncate` keeps
                desktop pixel-identical; below `sm` it wraps onto up to 2
                lines instead, which is enough room for every real
                combined-reason string measured, and still won't grow the
                row unboundedly if a future combination is longer.
              */}
              <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--color-ink-faint)] sm:line-clamp-none sm:truncate">
                {POSITION_LABEL[player.position]} · {whys.join(" · ")}
              </div>
              {archetype.key && (
                <div className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--color-ink-faint)] sm:line-clamp-none sm:truncate">
                  {archetype.label}
                  {archetype.qualifier && ` · ${archetype.qualifier}`}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-display text-[18px] font-semibold tabular text-[var(--color-ink)]">
                {(player.scores.overall ?? 0).toFixed(1)}
              </div>
              <div className="text-[10px] uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">Performance</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
