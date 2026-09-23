import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PersonalisationProvider } from "@/components/personalisation/personalisation-provider";
import { getAllTeams } from "@/lib/directory/repository";
import { THEME_STORAGE_KEY } from "@/lib/theme/resolveTheme";
import "./globals.css";

/**
 * THEME INITIALISATION — no flash, no dependency on system colour scheme.
 * ==========================================================================
 * The product default is DARK (Floodlit) — see docs/VISUAL_UX_REIMAGINATION.md
 * and app/globals.css, where `:root` itself now holds the dark token values
 * and `:root[data-theme="light"]` is the opt-in override. Because `:root`
 * IS dark, the server-rendered HTML is already correct for every visitor
 * except one case: someone who previously chose light explicitly. This
 * script exists only to handle that one case before the browser paints
 * anything, by setting `data-theme="light"` on <html> — for everyone else
 * (no saved choice, or an explicit dark choice) it's a no-op, since the CSS
 * default is already right.
 *
 * This has to be a plain, synchronous, render-blocking <script> — not a
 * `useEffect` (which would run after React mounts and the page has already
 * painted once, producing exactly the light-then-dark flash this is meant
 * to prevent) and not `next/script` (which defers/asyncs by default). It's
 * placed as the very first child of <body> so nothing else in the document
 * paints before it runs. The resolution rule it applies is intentionally
 * the same one-line logic as lib/theme/resolveTheme.ts's `resolveTheme` —
 * duplicated here in plain JS (this can't import a module; it has to exist
 * as an inline string before any bundle has loaded) rather than shared, so
 * if that function's logic ever changes, this comment is the reminder to
 * update this string too. Deliberately reads ONLY localStorage — no
 * `matchMedia`, no `prefers-color-scheme` — the whole point of this change
 * is that system colour scheme no longer has any say in the app's theme.
 */
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  } catch (e) {}
})();
`;

export const revalidate = 300;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A distinctive editorial serif, used sparingly for headlines and hero
// numerals — never for body text or tables, where the grotesk (Geist)
// keeps figures aligned and legible.
const editorial = Fraunces({
  variable: "--font-editorial",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Premier League Analytics",
  description: "Who is actually performing well in the Premier League, and why.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Fetched once here (identity-only, no scoring — see lib/directory) and
  // shared via context with every personalisation-aware client component,
  // rather than each one fetching its own copy. Degrades to an empty array
  // rather than failing the whole app if the DB is briefly unavailable.
  const teams = await getAllTeams().catch(() => []);

  return (
    <html
      lang="en"
      // The theme init script below (and a saved-light-preference user's
      // own toggle click later) can set data-theme directly on this element
      // outside of React's own render — exactly the case
      // suppressHydrationWarning exists for, and it only suppresses the
      // warning for THIS element's own attributes, not its children.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${editorial.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--color-canvas)] pb-[calc(4rem+env(safe-area-inset-bottom))] text-[var(--color-ink)] sm:pb-0">
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run synchronously, before first paint; see THEME_INIT_SCRIPT's comment */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <PersonalisationProvider teams={teams}>
          <SiteHeader />
          {children}
          {/*
            MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §5/§10 #4): the
            body's own `pb-16 sm:pb-0` above reserves room for this fixed
            bar so it never covers the last bit of any page's content —
            reset to nothing at `sm` and up, where BottomNav doesn't render.
          */}
          <BottomNav />
        </PersonalisationProvider>
        <Analytics />
      </body>
    </html>
  );
}
