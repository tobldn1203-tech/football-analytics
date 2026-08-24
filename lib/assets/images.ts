/**
 * Player and club imagery — a single, deliberate seam between "where images
 * come from" and everywhere they're used in the UI.
 *
 * Currently backed by the Premier League's own official media CDN (the
 * same one the FPL app and premierleague.com use), keyed off asset codes
 * ingested alongside the rest of the FPL data (`Team.crestCode`,
 * `Player.photoCode`). If that source ever needs replacing — a different
 * provider, self-hosted assets, Champions League clubs it doesn't cover —
 * this is the only file that changes; nothing else in the app constructs
 * an image URL directly.
 *
 * Every function degrades to `null` rather than a broken image when an
 * asset code is missing — callers (PlayerAvatar, TeamCrest) fall back to a
 * generated placeholder, never a 404.
 */

const CREST_SIZES = { sm: 25, md: 50, lg: 70 } as const;
const PHOTO_SIZES = { sm: "40x40", md: "110x140", lg: "250x250" } as const;

export type CrestSize = keyof typeof CREST_SIZES;
export type PhotoSize = keyof typeof PHOTO_SIZES;

export function getTeamCrestUrl(crestCode: number | null, size: CrestSize = "md"): string | null {
  if (!crestCode) return null;
  return `https://resources.premierleague.com/premierleague/badges/${CREST_SIZES[size]}/t${crestCode}.png`;
}

export function getPlayerPhotoUrl(photoCode: string | null, size: PhotoSize = "md"): string | null {
  if (!photoCode) return null;
  return `https://resources.premierleague.com/premierleague/photos/players/${PHOTO_SIZES[size]}/p${photoCode}.png`;
}
