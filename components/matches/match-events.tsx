import Link from "next/link";
import { TeamCrest } from "@/components/identity/team-crest";
import type { CardEntry, MatchEventEntry } from "@/lib/analytics/scoring/matchRepository";

interface Sides {
  home: { shortName: string; crestUrl: string | null };
  away: { shortName: string; crestUrl: string | null };
}

export function MatchEvents({
  scorers,
  assistProviders,
  cards,
  sides,
}: {
  scorers: MatchEventEntry[];
  assistProviders: MatchEventEntry[];
  cards: CardEntry[];
  sides: Sides;
}) {
  const hasAny = scorers.length > 0 || assistProviders.length > 0 || cards.length > 0;
  if (!hasAny) {
    return <p className="text-[13.5px] text-[var(--color-ink-faint)]">No goals or cards in this match.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <EventColumn icon="⚽" title="Goals" entries={scorers} sides={sides} />
      <EventColumn icon="🅰️" title="Assists" entries={assistProviders} sides={sides} />
      <EventColumn
        icon="🟨"
        title="Cards"
        entries={cards.map((c) => ({ ...c, count: 1, suffix: c.red ? "Red" : "Yellow" }))}
        sides={sides}
      />
    </div>
  );
}

function EventColumn({
  icon,
  title,
  entries,
  sides,
}: {
  icon: string;
  title: string;
  entries: Array<MatchEventEntry & { suffix?: string }>;
  sides: Sides;
}) {
  if (entries.length === 0) {
    return (
      <div>
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          {icon} {title}
        </h4>
        <p className="text-[12.5px] text-[var(--color-ink-faint)]">None.</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        {icon} {title}
      </h4>
      <ul className="space-y-1.5">
        {entries.map((e) => {
          const side = sides[e.teamSide];
          return (
            <li key={e.playerId} className="flex items-center gap-1.5 text-[13.5px]">
              <TeamCrest crestUrl={side.crestUrl} shortName={side.shortName} size="sm" />
              <Link href={`/players/${e.slug}`} className="text-[var(--color-ink)] hover:text-[var(--color-accent)]">
                {e.name}
              </Link>
              {e.count > 1 && <span className="text-[var(--color-ink-faint)]">×{e.count}</span>}
              {e.suffix && <span className="text-[var(--color-ink-faint)]">({e.suffix})</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
