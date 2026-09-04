"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePreferences } from "@/lib/preferences/usePreferences";
import { useDirectory } from "./personalisation-provider";
import { PreferencesModal } from "./preferences-modal";
import { clearSupportedClub } from "@/lib/preferences/store";
import { TeamCrest } from "@/components/identity/team-crest";

/**
 * The header's entry point into personalisation — pick, change or remove
 * the supported club. Never a settings page.
 *
 * `isActive` (computed by the header — see components/layout/header-nav.tsx
 * for exactly which route counts) gets the same treatment as the other
 * nav items: full-strength ink colour, medium weight, and the same quiet
 * accent underline — never a new visual language of its own.
 */
export function MyFootballNav({ isActive = false }: { isActive?: boolean }) {
  const preferences = usePreferences();
  const { teams } = useDirectory();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const club = teams.find((t) => t.id === preferences.supportedClubId);

  return (
    <div className="relative shrink-0" ref={ref}>
      {/*
        MOBILE FIX (docs/MOBILE_EXPERIENCE_AUDIT.md finding #1): the "My
        Football" label text was a meaningful share of the header
        overflow. Icon/crest only below `sm` — still discoverable (once a
        club is set, it's THAT club's own crest, arguably more
        recognisable than the generic label) and still opens the exact
        same picker/dropdown; the full label returns at `sm` and up where
        there's room for it.
      */}
      {/*
        MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #5): icon-only
        below `sm` (see the fix above this one) measured a 19px-wide tap
        target — comfortable height already (`py-2`), but very little
        width to actually hit. `px-2` below `sm` widens the real hit area
        around the same icon without changing its visual size; `sm:px-0`
        keeps the label variant's spacing exactly as before.
      */}
      <button
        onClick={() => (club ? setOpen((v) => !v) : setPicking(true))}
        aria-label="My Football"
        aria-current={isActive ? "page" : undefined}
        title="My Football"
        className={`flex shrink-0 items-center gap-1.5 px-2 py-2 text-[13.5px] transition-colors sm:px-0 sm:py-0 sm:text-[14px] ${
          isActive ? "font-semibold text-[var(--color-ink)]" : "font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
        }`}
      >
        {club ? (
          <TeamCrest crestUrl={club.crestUrl} shortName={club.shortName} size="sm" />
        ) : (
          <span aria-hidden="true">⚽</span>
        )}
        <span className="hidden sm:inline">My Football</span>
      </button>
      {isActive && (
        <span
          className="pointer-events-none absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-[var(--color-accent)]"
          aria-hidden="true"
        />
      )}

      {open && club && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
            Your club
          </p>
          <Link href={`/teams/${club.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2 hover:opacity-80">
            <TeamCrest crestUrl={club.crestUrl} shortName={club.shortName} size="md" />
            <span className="text-[13.5px] font-medium text-[var(--color-ink)]">{club.name}</span>
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                setOpen(false);
                setPicking(true);
              }}
              className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline"
            >
              Change club
            </button>
            <button
              onClick={() => {
                clearSupportedClub();
                setOpen(false);
              }}
              className="text-[12.5px] font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {picking && <PreferencesModal onClose={() => setPicking(false)} />}
    </div>
  );
}
