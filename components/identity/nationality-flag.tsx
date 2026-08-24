const SIZE_PX: Record<"xs" | "sm" | "md", number> = { xs: 13, sm: 16, md: 20 };

/**
 * A small flag badge for a player's football nationality (see
 * prisma/schema.prisma's Player.nationalityCode comment, and
 * lib/ingestion/nationality/match.ts for how it's sourced). Renders
 * nothing at all when `code` is null — the deliberate fallback for a
 * player we don't have reliable nationality data for, rather than a
 * placeholder or a guess. Country name is exposed via `title` for a
 * native tooltip, and via `aria-label` — no separate label text sits next
 * to it, so it never competes visually with the player's name.
 */
export function NationalityFlag({
  code,
  country,
  size = "sm",
}: {
  code: string | null | undefined;
  country?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  if (!code) return null;
  const width = SIZE_PX[size];
  const height = Math.round((width * 3) / 4);

  return (
    <span
      className={`fi fi-${code} inline-block shrink-0 rounded-[2px] ring-1 ring-inset ring-black/10`}
      style={{ width, height }}
      title={country ?? undefined}
      aria-label={country ? `${country} flag` : undefined}
      role="img"
    />
  );
}
