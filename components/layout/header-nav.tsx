"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { MyFootballNav } from "@/components/personalisation/my-football-nav";

/**
 * HEADER NAVIGATION — active-state aware
 * ==========================================================================
 * Split out of site-header.tsx (a server component, which has no reliable
 * way to read the current pathname) so the four primary links and My
 * Football can share one `usePathname()` call and one, single-source-of-
 * truth notion of "which section is the user in" — one route-matching
 * function per section below, not scattered string checks at each call site.
 *
 * Route → section mapping, deliberately prefix-based (not exact-match) so
 * nested routes keep their parent section active:
 *   Players  — "/" and any "/players/..." page
 *   Discover — "/discover" and any nested route under it
 *   Matches  — "/matches" (the gameweek list) AND "/match/..." (Match
 *              Centre) — a deliberate choice: Match Centre has no nav item
 *              of its own, and it's reached from and returns to the
 *              gameweek view, so "Matches" is its logical parent section.
 *   Teams    — "/teams" and any "/teams/..." page — EXCEPT the user's own
 *              supported club's page, which is claimed by My Football
 *              instead (see below), so the two never light up together.
 *
 * My Football has no route of its own (it's a dropdown, not a page) — it's
 * "active" specifically on the supported club's own Team Intelligence
 * page, `/teams/[supportedClubId]`. Deliberately NOT active for every
 * `/teams/*` page: seeing Chelsea's page while supporting Arsenal should
 * light up "Teams" (you're browsing the section), not "My Football" (which
 * is specifically about your club).
 */
// Exported — components/layout/bottom-nav.tsx (mobile-only persistent nav,
// see docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #4) reuses both this list
// and the route-matching logic below rather than keeping its own copy, so
// the two navs can never quietly disagree about which section is active.
export const NAV_ITEMS = [
  { label: "Players", href: "/", active: true },
  { label: "Discover", href: "/discover", active: true },
  { label: "Matches", href: "/matches", active: true },
  { label: "Teams", href: "/teams", active: true },
  { label: "Rankings", href: "#", active: false },
] as const;

export function isSectionActive(label: (typeof NAV_ITEMS)[number]["label"], pathname: string, myFootballHref: string | null): boolean {
  switch (label) {
    case "Players":
      return pathname === "/" || pathname.startsWith("/players/");
    case "Discover":
      return pathname === "/discover" || pathname.startsWith("/discover/");
    case "Matches":
      return pathname === "/matches" || pathname.startsWith("/matches/") || pathname.startsWith("/match/");
    case "Teams":
      // Excludes the supported club's own page — that's My Football's, see above.
      return (pathname === "/teams" || pathname.startsWith("/teams/")) && pathname !== myFootballHref;
    default:
      return false;
  }
}

export function HeaderNav() {
  const pathname = usePathname();
  const preferences = usePreferences();
  const myFootballHref = preferences.supportedClubId ? `/teams/${preferences.supportedClubId}` : null;
  const myFootballIsActive = myFootballHref !== null && pathname === myFootballHref;

  return (
    <>
      <nav className="flex min-w-0 items-center gap-2 overflow-x-auto sm:gap-7">
        {NAV_ITEMS.map((item) => {
          const isActive = item.active && isSectionActive(item.label, pathname, myFootballHref);
          return (
            <span key={item.label} className={`relative shrink-0 ${item.active ? "" : "hidden sm:inline"}`}>
              {item.active ? (
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-block py-2 text-[13.5px] transition-colors sm:py-0 sm:text-[14px] ${
                    isActive
                      ? "font-semibold text-[var(--color-ink)]"
                      : "font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="inline-block py-2 text-[13.5px] font-medium text-[var(--color-ink-faint)] sm:py-0 sm:text-[14px]"
                  title="Coming soon"
                >
                  {item.label}
                </span>
              )}
              {/* The active indicator — a single quiet accent line, not a
                  pill/background/border. Absolutely positioned within this
                  already-`relative` wrapper so it never affects the link's
                  own box/line-height (no layout shift when it appears or
                  disappears on navigation). */}
              {isActive && (
                <span
                  className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-[var(--color-accent)]"
                  aria-hidden="true"
                />
              )}
            </span>
          );
        })}
      </nav>
      <span className="shrink-0 border-l border-[var(--color-border)] pl-2 sm:pl-5">
        <MyFootballNav isActive={myFootballIsActive} />
      </span>
    </>
  );
}
