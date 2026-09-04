"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { BROKER_URL } from "@/lib/links";

/**
 * Four numbers that make the pitch credible.
 *
 * The first four are *properties of the system* — they are true whether or not
 * anyone is using it, so they're stated flatly. The live row underneath is
 * fetched from the broker's public API and only appears when it answers.
 *
 * The alternative — hardcoding "12,847 jobs settled" — is the kind of number
 * that makes everything next to it worth less. If the network is empty, saying
 * so is more persuasive than inventing traffic.
 */
const PROPERTIES = [
  { value: "$0.001", label: "smallest job price", note: "a tenth of a cent" },
  { value: "~3s", label: "to settle on Hedera", note: "finality, not confirmations" },
  { value: "0%", label: "protocol fee", note: "providers keep everything" },
  { value: "0 ℏ", label: "gas a buyer needs", note: "the facilitator pays" },
];

interface Live {
  providersLive: number;
  jobsCompleted: number;
  paidUsdMicros: number;
  network: string;
}

export function Stats() {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(`${BROKER_URL}/api/network`, {
          signal: AbortSignal.timeout(6_000),
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          network: string;
          stats: { providersLive: number; jobsCompleted: number; paidUsdMicros: number };
        };
        if (alive) setLive({ ...body.stats, network: body.network });
      } catch {
        // No broker reachable from this browser — the section just stays static.
        // A marketing page must not depend on a backend being up.
      }
    };
    void load();
    const timer = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="relative border-y border-[var(--border)] px-6 py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROPERTIES.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.07} y={18}>
              <div>
                <div className="grad-brand text-3xl font-semibold tracking-tight md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{stat.label}</div>
                <div className="mt-0.5 text-xs text-dim">{stat.note}</div>
              </div>
            </Reveal>
          ))}
        </div>

        {live ? (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-xl border border-[var(--border)] bg-white/[0.02] px-6 py-4 text-sm">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-dim">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" />
              live · {live.network}
            </span>
            <Metric value={live.providersLive} label="providers online" />
            <Metric value={live.jobsCompleted} label="jobs settled" />
            <Metric value={`$${(live.paidUsdMicros / 1_000_000).toFixed(4)}`} label="paid to providers" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </span>
  );
}
