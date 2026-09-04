"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ComponentType } from "react";
import { Users, Compass, CalendarDays, Shield } from "lucide-react";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "@/components/personalisation/personalisation-provider";
import { PreferencesModal } from "@/components/personalisation/preferences-modal";
import { TeamCrest } from "@/components/identity/team-crest";
import { NAV_ITEMS, isSectionActive } from "./header-nav";

/**
 * PERSISTENT MOBILE NAVIGATION
 * ==========================================================================
 * See docs/MOBILE_FIRST_PRODUCT_AUDIT.md §5/§10 #4. The audit's single
 * largest navigation-model finding: zero `position: sticky`/`fixed`
 * elements existed anywhere in the app, measured across all 9 pages
 * tested — on a 2,819px Match Centre or a 2,574px Player page, reaching
 * Players/Discover/Matches/Teams/My Football again meant scrolling all
 * the way back to the top. This is the fix: a bottom bar, mobile-only,
 * that's always one thumb-reach away regardless of scroll position.
 *
 * Deliberately mobile-only (`sm:hidden`) and purely additive — the
 * existing top header (logo, season switcher, the four nav links, My
 * Football's own dropdown) is untouched, still renders at every width,
 * and is still the only nav on desktop, where it already works well (the
 * audit found no desktop navigation problems). This is not a responsive
 * variant of that header; it's a second, mobile-specific surface.
 *
 * Reuses header-nav.tsx's own NAV_ITEMS and isSectionActive rather than a
 * second copy of the route-matching rules — including its deliberate
 * "My Football and Teams never both light up" logic for a supported
 * user's own club page.
 *
 * My Football here is a direct link to the supported club's Team
 * Intelligence page (or opens the same club-picker modal the header uses,
 * if none is set yet) rather than reusing MyFootballNav's popover — that
 * popover is positioned to drop down from a top-of-screen anchor
 * (`top-full`, `right-0`); anchored to a fixed bottom bar instead, it
 * would want to open upward, not down off the bottom of the viewport.
 * Five direct destinations, no nested menu, matches how the other four
 * items already behave here.
 */
const ICON_FOR: Record<string, ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>> = {
  Players: Users,
  Discover: Compass,
  Matches: CalendarDays,
  Teams: Shield,
};

export function BottomNav() {
  const pathname = usePathname();
  const preferences = usePreferences();
  const { teams } = useDirectory();
  const [picking, setPicking] = useState(false);

  const club = teams.find((t) => t.id === preferences.supportedClubId);
  const myFootballHref = club ? `/teams/${club.id}` : null;
  const myFootballIsActive = myFootballHref !== null && pathname === myFootballHref;

  const itemClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium transition-colors ${
      isActive ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]"
    }`;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {NAV_ITEMS.filter((item) => item.active).map((item) => {
          const isActive = isSectionActive(item.label, pathname, myFootballHref);
          const Icon = ICON_FOR[item.label];
          return (
            <Link key={item.label} href={item.href} aria-current={isActive ? "page" : undefined} className={itemClass(isActive)}>
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
              {item.label}
            </Link>
          );
        })}

        {club ? (
          <Link href={myFootballHref!} aria-current={myFootballIsActive ? "page" : undefined} className={itemClass(myFootballIsActive)}>
            <TeamCrest crestUrl={club.crestUrl} shortName={club.shortName} size="sm" />
            My Football
          </Link>
        ) : (
          <button type="button" onClick={() => setPicking(true)} className={itemClass(false)}>
            <span aria-hidden="true" className="text-[19px] leading-none">
              ⚽
            </span>
            My Football
          </button>
        )}
      </nav>

      {picking && <PreferencesModal onClose={() => setPicking(false)} />}
    </>
  );
}
