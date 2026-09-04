"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP, shouldAnimate, DUR, EASE } from "@/lib/gsap";

/**
 * Scroll-in wrapper.
 *
 * The hidden start state is applied by `gsap.fromTo` inside `useGSAP` — which
 * runs in a layout effect, before paint — rather than by an inline
 * `style={{opacity:0}}`. That distinction matters: an inline zero opacity is the
 * element's *authored* value, so anything that reverts the animation, or fails
 * to run it at all, leaves the content permanently invisible. Driven from
 * script, the markup stays visible by default, which is the behaviour you want
 * when the animation layer breaks.
 */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (!shouldAnimate()) {
        gsap.set(el, { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        el,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration: DUR,
          ease: EASE,
          delay,
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
