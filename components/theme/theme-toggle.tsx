"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme/useTheme";

/**
 * The one place a user can override the product's dark default. Icon-only
 * at every width (a universally-understood sun/moon pair needs no label,
 * and there's no room to spare in the header at mobile widths — see the
 * tap-target sizing note this mirrors from MyFootballNav) — shows the icon
 * for the theme you'd SWITCH TO, the same convention most theme toggles
 * use, so "Sun" means "go light" and "Moon" means "go dark".
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex shrink-0 items-center justify-center rounded-full p-2 text-[var(--color-ink-faint)] transition-colors hover:text-[var(--color-ink)]"
    >
      {isDark ? <Sun size={16} strokeWidth={2} aria-hidden="true" /> : <Moon size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
