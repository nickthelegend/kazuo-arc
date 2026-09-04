import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {sub ? <p className="mt-1.5 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: "border-mint/30 bg-mint/[0.08] text-mint",
  running: "border-cyan/30 bg-cyan/[0.08] text-cyan",
  assigned: "border-azure/30 bg-azure/[0.08] text-azure",
  paid: "border-violet/30 bg-violet/[0.08] text-violet",
  quoted: "border-[var(--border)] bg-white/[0.03] text-muted",
  failed: "border-rose/30 bg-rose/[0.08] text-rose",
  expired: "border-[var(--border)] bg-white/[0.03] text-dim",
  online: "border-mint/30 bg-mint/[0.08] text-mint",
  busy: "border-amber/30 bg-amber/[0.08] text-amber",
  offline: "border-[var(--border)] bg-white/[0.03] text-dim",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        STATUS_STYLES[status] ?? STATUS_STYLES.quoted,
      )}
    >
      {status === "running" || status === "online" ? (
        <span className="live-dot h-1 w-1 rounded-full bg-current" />
      ) : null}
      {status}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-dim">{label}</span>
      <span className="min-w-0 truncate text-right text-xs text-muted">{children}</span>
    </div>
  );
}
