import { TeamCrest } from "./team-crest";

/** Crest + name, used everywhere a team needs to be identified. */
export function TeamIdentity({
  crestUrl,
  name,
  shortName,
  size = "md",
  showFullName = true,
}: {
  crestUrl: string | null;
  name: string;
  shortName: string;
  size?: "sm" | "md" | "lg";
  showFullName?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <TeamCrest crestUrl={crestUrl} shortName={shortName} size={size} />
      <span className="text-[inherit]">{showFullName ? name : shortName}</span>
    </span>
  );
}
