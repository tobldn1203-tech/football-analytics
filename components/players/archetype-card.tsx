import type { PlayerArchetype } from "@/lib/analytics/archetypes/archetypes";

/**
 * Player Archetype display. Deliberately NOT styled like a score (no
 * accent-colour number, no percentile bar to headline it) — an archetype
 * is a description of a player's statistical shape, not a quality rating,
 * and the visual treatment should say that at a glance, not just the copy.
 */

const ICON: Record<string, string> = {
  shot_stopper: "🧤",
  defensive_anchor: "🧱",
  attacking_defender: "🏃",
  all_round_defender: "⚖️",
  creative_hub: "🎯",
  box_to_box: "🔁",
  goal_threat: "⚽",
  ball_winning_midfielder: "🧱",
  all_round_midfielder: "⚖️",
  complete_forward: "🌟",
  creative_forward: "🎯",
  pressing_forward: "🧱",
};

function iconFor(key: string | null): string {
  return (key && ICON[key]) || "🌱";
}

/** Compact pill for the dark hero header — identity at a glance. */
export function ArchetypeBadge({ archetype }: { archetype: PlayerArchetype }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hero-border)] bg-white/5 px-2.5 py-1 text-[12px] font-medium text-[var(--hero-ink-soft)]">
      <span aria-hidden="true">{iconFor(archetype.key)}</span>
      {archetype.label}
      {archetype.qualifier && <span className="text-[var(--hero-ink-faint)]">· {archetype.qualifier}</span>}
    </span>
  );
}

/** Fuller card for the page body — label, qualifier, description, and the raw shape for anyone curious. */
export function ArchetypeCard({ archetype }: { archetype: PlayerArchetype }) {
  const { attack, creation, defence } = archetype.dimensions;
  const showShape = archetype.key !== "shot_stopper" && archetype.key !== null;

  return (
    <section className="mt-8 rounded-xl border border-[var(--color-border)] px-5 py-5 sm:px-6">
      <h3 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
        Player Profile
      </h3>
      <div className="flex items-start gap-3">
        <span className="text-[26px] leading-none" aria-hidden="true">
          {iconFor(archetype.key)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-[var(--color-ink)]">{archetype.label}</span>
            {archetype.qualifier && (
              <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">
                {archetype.qualifier}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-soft)]">{archetype.description}</p>

          {showShape && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <ShapeBar label="Attack" value={attack} />
              <ShapeBar label="Creation" value={creation} />
              <ShapeBar label="Defence" value={defence} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ShapeBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] text-[var(--color-ink-faint)]">{label}</span>
        <span className="text-[11px] tabular text-[var(--color-ink-faint)]">{value.toFixed(1)}</span>
      </div>
      <div className="h-[4px] overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-ink-faint)]"
          style={{ width: `${Math.max(2, Math.min(100, value * 10))}%` }}
        />
      </div>
    </div>
  );
}
