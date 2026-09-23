"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once, on mount — the League Leaders
 * score reveal. Plays exactly once per mount (never replays on a later
 * re-render with a changed target — it just snaps to the new value), and
 * jumps straight to the final value for anyone with `prefers-reduced-motion`
 * set, never animating for them at all.
 *
 * Always starts at 0 on every render, server or client — deliberately NOT
 * reading `window.matchMedia` during render (a `useRef(typeof window !==
 * "undefined" && ...)` initializer looked tempting, since it "only runs
 * once" — but it still runs once PER ENVIRONMENT: on the server it reads
 * false (no `window`), on the client it reads the visitor's real
 * preference, and when those two differ, React's hydration check sees the
 * server's HTML disagree with the client's first render and throws a
 * hydration-mismatch error — caught for real via a reduced-motion browser
 * test, not hypothetical. `window.matchMedia` is only ever read inside the
 * effect below, which by construction never runs during SSR.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const played = useRef(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || played.current) {
      setValue(target);
      return;
    }
    played.current = true;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
