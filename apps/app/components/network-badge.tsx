"use client";

import { useEffect, useState } from "react";
import { api, type NetworkInfo } from "@/lib/api";

/**
 * Live connection state for the broker.
 *
 * The board is useless without it, and "why is this page empty?" should be
 * answerable at a glance rather than from the console.
 */
export function NetworkBadge() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const next = await api.network();
        if (!alive) return;
        setInfo(next);
        setDown(false);
      } catch {
        if (alive) setDown(true);
      }
    };
    void load();
    const timer = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (down) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose/30 bg-rose/[0.08] px-3 py-1 text-xs text-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-rose" />
        broker offline
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-xs text-muted">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" />
      <span className="hidden sm:inline">{info?.network ?? "connecting…"}</span>
      <span className="text-dim">·</span>
      <span className="text-foreground">{info?.stats.providersLive ?? 0}</span>
      <span className="hidden sm:inline">live</span>
    </span>
  );
}
