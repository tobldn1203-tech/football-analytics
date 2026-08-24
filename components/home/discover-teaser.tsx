import Link from "next/link";
import { DISCOVER_CATEGORIES } from "@/lib/discover/categories";
import type { HomepageDiscover } from "@/lib/analytics/scoring/repository";
import { PlayerAvatar } from "@/components/identity/player-avatar";

/**
 * A compact, high-on-the-page hook into /discover — Discover's full
 * experience deliberately lives on its own page now (see
 * app/discover/page.tsx), so this stays small: one storyline, a few faces,
 * a link out. Not a second dashboard section.
 */
export function DiscoverTeaser({ discover }: { discover: HomepageDiscover }) {
  // Prefer "Rising" (the most inviting hook) but fall back gracefully —
  // early in a season, or a quiet week, it may be empty.
  const featured = ["rising", "inForm", "underTheRadar"]
    .map((key) => DISCOVER_CATEGORIES.find((c) => c.key === key)!)
    .find((c) => discover[c.key as keyof HomepageDiscover].length > 0);

  if (!featured) return null;
  const entries = discover[featured.key as keyof HomepageDiscover].slice(0, 4);

  return (
    <Link
      href="/discover"
      className="group mb-8 flex flex-col gap-4 rounded-xl border border-[var(--color-border)] px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)] sm:flex-row sm:items-center sm:justify-between"
      style={{ borderLeftColor: featured.tint, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]"
          style={{ backgroundColor: `color-mix(in srgb, ${featured.tint} 16%, transparent)` }}
          aria-hidden="true"
        >
          {featured.icon}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-faint)]">
            Discover something new
          </p>
          <p className="font-display text-[16px] font-semibold tracking-tight text-[var(--color-ink)]">
            {featured.question}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex -space-x-2.5">
          {entries.map((entry) => (
            <span
              key={entry.player.playerId}
              className="rounded-full ring-2 ring-[var(--color-surface)]"
              title={entry.player.name}
            >
              <PlayerAvatar
                photoUrl={entry.player.photoUrl}
                name={entry.player.name}
                teamShortName={entry.player.teamShortName}
                size="sm"
              />
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[13px] font-medium text-[var(--color-ink-soft)] group-hover:text-[var(--color-accent)]">
          Explore Discover →
        </span>
      </div>
    </Link>
  );
}
