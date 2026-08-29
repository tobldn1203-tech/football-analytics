import Link from "next/link";
import { TeamCrest } from "./team-crest";

/**
 * Crest + name, used everywhere a team needs to be identified. Pass
 * `teamId` to make it a navigation target to that club's Team
 * Intelligence page (`/teams/[teamId]`) — omit it where the identity is
 * purely decorative, redundant with an enclosing link, or IS the page
 * currently being viewed (no reason to link a team to itself). See
 * docs/TEAM_NAVIGATION_AND_PLAYER_DRIVERS_REFINEMENT.md for the
 * surface-by-surface decisions.
 */
export function TeamIdentity({
  crestUrl,
  name,
  shortName,
  size = "md",
  showFullName = true,
  teamId,
  className,
}: {
  crestUrl: string | null;
  name: string;
  shortName: string;
  size?: "sm" | "md" | "lg";
  showFullName?: boolean;
  /** When present, renders as a link to that club's Team Intelligence page. */
  teamId?: string;
  className?: string;
}) {
  const content = (
    <>
      <TeamCrest crestUrl={crestUrl} shortName={shortName} size={size} />
      <span className="text-[inherit]">{showFullName ? name : shortName}</span>
    </>
  );

  if (teamId) {
    // No hardcoded hover colour — this renders on both light surfaces and
    // the dark hero band, which use different accent tokens. `opacity`
    // reads correctly as "this is interactive" in both.
    return (
      <Link href={`/teams/${teamId}`} className={`inline-flex items-center gap-2 transition-opacity hover:opacity-70 ${className ?? ""}`}>
        {content}
      </Link>
    );
  }

  return <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>{content}</span>;
}
