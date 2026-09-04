import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { CompetitionSeasonSwitcher } from "./competition-season-switcher";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } }).catch(() => null);

  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-4 px-5 py-3.5 sm:px-8">
        <div className="flex shrink-0 flex-col gap-0.5">
          <Link href="/" className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)] sm:text-[14px] sm:tracking-[0.14em]">
            Premier League
          </Link>
          <CompetitionSeasonSwitcher seasonLabel={season?.label ?? null} />
        </div>
        {/* overflow-x-auto is scoped to just the link list — an absolutely
            positioned dropdown (MyFootballNav) living inside an overflow
            container gets clipped to it, so that widget sits outside this
            scroll region entirely rather than sharing it.

            The actual nav links + My Football live in header-nav.tsx, a
            client component — this stays a server component (it fetches
            the season) but has no reliable way to read the current
            pathname for the active-state work, so that part moved out.

            MOBILE NAV SIMPLIFICATION (docs/MOBILE_FIRST_PRODUCT_AUDIT.md
            §12 follow-up): header-nav.tsx's four-link `<nav>` is now
            `hidden` below `sm` — BottomNav duplicates it — leaving only
            MyFootballNav there, a small icon-only button. That single
            small element no longer needs the two-row, wrap-onto-its-own-
            line layout the ORIGINAL mobile fix (docs/MOBILE_EXPERIENCE_
            AUDIT.md finding #1) built for a much wider 405px cluster: this
            container's old `w-full` forced it to keep claiming an entire
            second row even once its only remaining content was a ~35px
            crest button, measured, so the header barely got shorter (132
            → 129px) despite the nav row's content actually disappearing.
            Dropping `flex-wrap`/`w-full` (this row is now `w-auto`, sized
            to its own content, like it already was at `sm` and up) lets
            the logo/switcher stack and the crest button share ONE row —
            confirmed by measurement to fit with real width to spare at
            every mobile width tested (375-430px). `justify-between` on
            the outer flex still anchors this row to the right edge.
            `sm:` behaviour is completely unaffected: `<nav>` still
            expects — and gets — this same one-row layout at `sm` and up,
            which is exactly what it already had before this pass. */}
        <div className="flex w-auto min-w-0 items-center gap-2 sm:gap-5">
          <HeaderNav />
        </div>
      </div>
    </header>
  );
}
