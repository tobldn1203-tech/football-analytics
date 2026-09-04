"use client";

import { useDirectory } from "./personalisation-provider";
import { setSupportedClub, dismissPrompt } from "@/lib/preferences/store";
import { TeamCrest } from "@/components/identity/team-crest";

/**
 * The one-question club picker — both the first-use prompt (auto-shown by
 * PersonalisationProvider until dismissed) and the "Change club" flow
 * opened later from the header. Selecting a crest commits immediately and
 * closes; there's nothing to "save" separately. Deliberately NOT a
 * multi-step wizard — the only preference this app tracks is which club
 * the user supports (see lib/preferences/types.ts for why).
 */
export function PreferencesModal({ onClose }: { onClose: () => void }) {
  const { teams } = useDirectory();

  function pick(teamId: string) {
    setSupportedClub(teamId);
    onClose();
  }

  function skip() {
    dismissPrompt();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) skip();
      }}
    >
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-reveal">
        <div data-hero className="relative shrink-0 overflow-hidden bg-[var(--hero-bg)] px-5 pt-5 pb-5 sm:px-6">
          <div
            className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "var(--hero-glow)" }}
            aria-hidden="true"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--hero-accent)]">
                Make your football experience yours
              </p>
              <h2 className="mt-1 font-display text-[21px] font-semibold leading-tight text-[var(--hero-ink)]">
                Which Premier League club do you support?
              </h2>
            </div>
            {/*
              MOBILE FIX (docs/MOBILE_FIRST_PRODUCT_AUDIT.md §4/§10 #5):
              measured 74x19px — the smallest target in the app, and the
              first interaction most new users have. `-m-2` cancels `p-2`
              exactly, so "Skip for now" renders in the identical visual
              position (same size, same baseline) while the button's real,
              padding-included hit area grows into the already-empty space
              around it rather than anywhere a neighbour would need to move.
            */}
            <button
              onClick={skip}
              className="-m-2 shrink-0 p-2 text-[12.5px] font-medium text-[var(--hero-ink-faint)] hover:text-[var(--hero-ink)]"
            >
              Skip for now
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {teams.length === 0 ? (
            <p className="text-[13.5px] text-[var(--color-ink-faint)]">No teams available yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => pick(team.id)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-3 text-center transition-colors hover:border-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
                >
                  <TeamCrest crestUrl={team.crestUrl} shortName={team.shortName} size="lg" />
                  <span className="text-[11.5px] font-medium leading-tight text-[var(--color-ink)]">
                    {team.shortName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
