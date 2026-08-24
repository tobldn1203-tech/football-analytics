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
        <div className="flex items-center gap-3 sm:gap-5">
          {/* overflow-x-auto is scoped to just the link list — an absolutely
              positioned dropdown (MyFootballNav) living inside an overflow
              container gets clipped to it, so that widget sits outside this
              scroll region entirely rather than sharing it. */}
          <nav className="flex items-center gap-3 overflow-x-auto sm:gap-7">
            {NAV_ITEMS.map((item) => (
              <span key={item.label} className="relative shrink-0">
                {item.active ? (
                  <Link
                    href={item.href}
                    className="text-[13.5px] font-medium text-[var(--color-ink)] sm:text-[14px]"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className="cursor-default text-[13.5px] font-medium text-[var(--color-ink-faint)] sm:text-[14px]"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
          <span className="shrink-0 border-l border-[var(--color-border)] pl-3 sm:pl-5">
            <MyFootballNav />
          </span>
        </div>
      </div>
    </header>
  );
}
