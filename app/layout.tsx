import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/layout/site-header";
import { PersonalisationProvider } from "@/components/personalisation/personalisation-provider";
import { getAllTeams } from "@/lib/directory/repository";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} ${editorial.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--color-canvas)] text-[var(--color-ink)]">
        <PersonalisationProvider teams={teams}>
          <SiteHeader />
          {children}
        </PersonalisationProvider>
        <Analytics />
      </body>
    </html>
  );
}
