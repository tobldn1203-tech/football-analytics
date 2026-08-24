import { PlayerAvatar } from "./player-avatar";
import { TeamCrest } from "./team-crest";
import { NationalityFlag } from "./nationality-flag";

/**
 * Photo + name + a small club crest badge, used in every ranking/list
 * context. The crest is the accessory here; PlayerProfileHeader (the
 * player page) uses a larger, standalone treatment instead.
 */
export function PlayerIdentity({
  photoUrl,
  name,
  crestUrl,
  teamShortName,
  nationality,
  nationalityCode,
  size = "md",
  subtitle,
  showTeamBadge = true,
}: {
  photoUrl: string | null;
  name: string;
  crestUrl: string | null;
  teamShortName: string;
  nationality?: string | null;
  nationalityCode?: string | null;
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  showTeamBadge?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative inline-flex shrink-0">
        <PlayerAvatar photoUrl={photoUrl} name={name} teamShortName={teamShortName} size={size} />
        {showTeamBadge && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--color-surface)] p-[1.5px]">
            <TeamCrest crestUrl={crestUrl} shortName={teamShortName} size="sm" />
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="inline-flex items-center gap-1.5">
          <NationalityFlag code={nationalityCode} country={nationality} size="xs" />
          <span className="font-medium text-[var(--color-ink)]">{name}</span>
        </span>
        {subtitle && (
          <span className="text-[12px] text-[var(--color-ink-faint)]">{subtitle}</span>
        )}
      </span>
    </span>
  );
}
