"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { APP_URL, NAV, REPO_URL } from "@/lib/links";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[var(--border)] bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
          <Link
            href={APP_URL}
            className="rounded-lg border border-[var(--border)] bg-white/[0.04] px-4 py-2 text-sm font-medium transition-all hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
          >
            Open app
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden"
        >
          <div className="space-y-1.5">
            <span
              className={cn(
                "block h-px w-6 bg-foreground transition-transform",
                open && "translate-y-[7px] rotate-45",
              )}
            />
            <span className={cn("block h-px w-6 bg-foreground transition-opacity", open && "opacity-0")} />
            <span
              className={cn(
                "block h-px w-6 bg-foreground transition-transform",
                open && "-translate-y-[7px] -rotate-45",
              )}
            />
          </div>
        </button>
      </nav>

      {open ? (
        <div className="border-t border-[var(--border)] bg-background/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted"
              >
                {item.label}
              </a>
            ))}
            <Link href={APP_URL} className="text-sm font-medium text-cyan">
              Open app →
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
