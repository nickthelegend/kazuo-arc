import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small caps label that sits above a section heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet" />
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="grad-text text-3xl font-semibold leading-[1.12] tracking-[-0.02em] sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {sub ? <p className="mt-4 text-[15px] leading-relaxed text-muted">{sub}</p> : null}
    </div>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  external?: boolean;
};

export function Button({ href, children, variant = "primary", className, external }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300";
  const styles =
    variant === "primary"
      ? "text-white glow-ring bg-[linear-gradient(100deg,#7C5CFF,#3DAAFF_55%,#3DDCFF)] hover:brightness-110 hover:-translate-y-0.5"
      : "text-foreground border border-[var(--border)] bg-white/[0.03] hover:bg-white/[0.07] hover:border-[var(--border-strong)]";

  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Link href={href} className={cn(base, styles, className)} {...props}>
      {children}
    </Link>
  );
}

/** Bordered pill used for stats and chain ids. */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-xs text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A copyable command line. */
export function Command({ children }: { children: string }) {
  return (
    <div className="card mono flex items-center gap-3 px-4 py-3 text-sm">
      <span className="select-none text-violet">$</span>
      <code className="text-foreground">{children}</code>
    </div>
  );
}

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("relative px-6 py-24 md:py-32", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}
