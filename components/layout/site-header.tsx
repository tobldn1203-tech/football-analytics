import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { CompetitionSeasonSwitcher } from "./competition-season-switcher";
import { MyFootballNav } from "@/components/personalisation/my-football-nav";

const NAV_ITEMS = [
  { label: "Players", href: "/", active: true },
  { label: "Discover", href: "/discover", active: true },
  { label: "Matches", href: "/matches", active: true },
  { label: "Teams", href: "/teams", active: true },
  { label: "Rankings", href: "#", active: false },
] as const;

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
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          {/* overflow-x-auto is scoped to just the link list — an absolutely
              positioned dropdown (MyFootballNav) living inside an overflow
              container gets clipped to it, so that widget sits outside this
              scroll region entirely rather than sharing it.

              MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md finding #1): this
              cluster measured 405px wide against a 390px viewport, forcing
              the whole page to scroll horizontally. Two changes below claw
              back that width without touching any of the four real,
              functional links: the disabled "Rankings" placeholder (not a
              working destination yet) is hidden below `sm`, and each link
              gets a slightly larger tap area on mobile (vertical padding,
              not extra width) rather than a smaller one. */}
          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto sm:gap-7">
            {NAV_ITEMS.map((item) => (
              <span key={item.label} className={`relative shrink-0 ${item.active ? "" : "hidden sm:inline"}`}>
                {item.active ? (
                  <Link
                    href={item.href}
                    className="inline-block py-2 text-[13.5px] font-medium text-[var(--color-ink)] sm:py-0 sm:text-[14px]"
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
              </span>
            ))}
          </nav>
          <span className="shrink-0 border-l border-[var(--color-border)] pl-2 sm:pl-5">
            <MyFootballNav />
          </span>
        </div>
      </div>
    </header>
  );
}
