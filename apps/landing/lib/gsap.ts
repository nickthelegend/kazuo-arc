"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export const EASE = "power3.out";
export const DUR = 0.8;

/**
 * Should this page animate at all?
 *
 * Two cases say no, and getting either wrong produces the same failure —
 * content that never appears:
 *
 *  - **Reduced motion.** Respect it.
 *  - **The document is hidden.** GSAP is driven by `requestAnimationFrame`,
 *    which browsers do not fire for a backgrounded tab. An intro started there
 *    applies its opening frame (opacity 0) and then stops, so a link opened in
 *    a background tab reads as a blank page until it is focused. Rendering the
 *    finished state is always correct: nobody is watching an animation they
 *    cannot see.
 *
 * Callers treat animation as an enhancement over already-visible markup, never
 * as the thing that makes markup visible.
 */
export function shouldAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (typeof document !== "undefined" && document.hidden) return false;
  return true;
}

export { gsap, ScrollTrigger, useGSAP };
