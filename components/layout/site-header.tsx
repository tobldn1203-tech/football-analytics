import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { CompetitionSeasonSwitcher } from "./competition-season-switcher";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const season = await prisma.season.findFirst({ where: { isCurrent: true } }).catch(() => null);

  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 py-3.5 sm:flex-nowrap sm:px-8">
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

            MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md finding #1): this
            cluster measured 405px wide against a 390px viewport, forcing
            the whole page to scroll horizontally. Two changes in
            header-nav.tsx claw back that width without touching any of
            the four real, functional links: the disabled "Rankings"
            placeholder (not a working destination yet) is hidden below
            `sm`, and each link gets a slightly larger tap area on mobile
            (vertical padding, not extra width) rather than a smaller one.

            MOBILE FOLLOW-UP FIX: this row wraps onto its own line below
            the logo at mobile widths (the outer container's flex-wrap) —
            being the only item on that line, `justify-between` on the
            OUTER flex had nothing to distribute it against, so it sat
            flush left with 100+ dead px trailing after it, growing wider
            on larger phones. `w-full` + this row's OWN `justify-between`
            anchors My Football to the row's actual right edge instead —
            unchanged at `sm:` and up, where this cluster sits inline next
            to the logo exactly as before.

            The actual nav links + My Football live in header-nav.tsx, a
            client component — this stays a server component (it fetches
            the season) but has no reliable way to read the current
            pathname for the active-state work, so that part moved out. */}
        <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-normal sm:gap-5">
          <HeaderNav />
        </div>
      </div>
    </header>
  );
}
