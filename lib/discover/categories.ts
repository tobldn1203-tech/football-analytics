import type { HomepageDiscover } from "@/lib/analytics/scoring/repository";

/**
 * The Discover taxonomy — one entry per exploration path. Shared between
 * the homepage teaser and the full /discover page so the icon/title/tint
 * for, say, "Rising" never drifts between the two places it appears.
 *
 * Every key here is backed by data the scoring engine already computes
 * (`lib/analytics/scoring/repository.ts` — `getHomepageDiscover` for the
 * first five, `topByCategory` for the last two). No new analytics; this
 * file only decides how to introduce existing numbers as football
 * questions instead of database filters.
 */
export type DiscoverCategoryKey = keyof HomepageDiscover | "creators" | "defenders";

export interface DiscoverCategoryDef {
  key: DiscoverCategoryKey;
  icon: string;
  title: string;
  /** The football question this answers — used as the card's hook. */
  question: string;
  description: string;
  tint: string;
}

export const DISCOVER_CATEGORIES: DiscoverCategoryDef[] = [
  {
    key: "inForm",
    icon: "🔥",
    title: "In Form",
    question: "It's deceeeent",
    description: "Performing exceptionally in recent matches.",
    tint: "var(--color-accent)",
  },
  {
    key: "rising",
    icon: "📈",
    title: "On the Rise",
    question: "Who's on the rise?",
    description: "Recent performances well above their own season level.",
    tint: "var(--color-info)",
  },
  {
    key: "underTheRadar",
    icon: "💎",
    title: "Hidden Gems",
    question: "Who's flying under the radar?",
    description: "Quietly excellent, before the headlines catch up.",
    tint: "var(--color-attention)",
  },
  {
    key: "mostConsistent",
    icon: "🎯",
    title: "Most Consistent",
    question: "Who can you always rely on?",
    description: "Strong performers who rarely dip below their own level.",
    tint: "var(--color-ink-soft)",
  },
  {
    key: "recentStandouts",
    icon: "⚡",
    title: "Recent Standouts",
    question: "Who stole the headlines last time out?",
    description: "Defining performances from the latest round.",
    tint: "#d9573c",
  },
  {
    key: "creators",
    icon: "🎨",
    title: "Chance Creators",
    question: "Who's creating the most for their teammates?",
    description: "The league's strongest creative output this season.",
    tint: "var(--color-accent)",
  },
  {
    key: "defenders",
    icon: "🧱",
    title: "Defensive Standouts",
    question: "Who's leading the defensive resistance?",
    description: "The league's strongest defensive performers, position for position.",
    tint: "var(--color-info)",
  },
];
