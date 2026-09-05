"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE, useEntrance } from "@/lib/motion";

/**
 * The page's single reveal.
 *
 * One shared entrance for everything below the hero, so the page has a rhythm
 * rather than a different trick per section. Short and exponential — it should
 * register as the content settling, not as an animation you were asked to
 * watch.
 *
 * When motion can't run (reduced-motion, or a backgrounded tab where rAF never
 * fires) this renders the plain element in its final state. Content is never
 * held at opacity 0 waiting for a frame that may not come.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const animate = useEntrance();

  if (!animate) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
