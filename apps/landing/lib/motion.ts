"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Should this surface animate its entrance?
 *
 * Two cases say no, and both produce the same failure if you get them wrong —
 * a blank page:
 *
 *  - **Reduced motion.** Respect it.
 *  - **The document is hidden.** Entrance animations are driven by
 *    `requestAnimationFrame`, which browsers do not fire for a backgrounded
 *    tab. An animation started there applies its opening frame (opacity 0) and
 *    then simply stops, so a link opened in a background tab reads as empty
 *    until it is focused.
 *
 * Callers treat motion as an enhancement over already-final markup: when this
 * returns false they render the finished state rather than an initial one. The
 * effect re-checks on `visibilitychange`, so a tab that was hidden at mount and
 * is later brought forward still gets its entrance.
 */
export function useEntrance(): boolean {
  const reduced = useReducedMotion();
  // Starts false so the server-rendered markup and the first client paint agree
  // on the *final* state; motion is opted into after mount, never out of.
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    if (reduced) return;
    if (!document.hidden) {
      setCanAnimate(true);
      return;
    }
    const onVisible = (): void => {
      if (!document.hidden) {
        setCanAnimate(true);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reduced]);

  return canAnimate;
}

export const EASE = [0.16, 1, 0.3, 1] as const;
