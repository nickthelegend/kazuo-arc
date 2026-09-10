"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { LiveDot, Section, SectionHeading } from "@/components/ui/kit";
import { BROKER_URL, CHAIN } from "@/lib/links";

/**
 * The public ledger.
 *
 * Deliberately not four big numbers in four boxes. That template says "we have
 * metrics" without saying anything true, and on a network this young the honest
 * numbers are small — which is fine, because the argument here is *verifiable*,
 * not *large*. So: the real receipts, read from the chain, each one a link you
 * can open.
 *
 * When the broker isn't reachable the section still renders its permanent
 * facts — the contract addresses — and says the feed is offline rather than
 * inventing rows.
 */

interface Receipt {
  sequence: number;
  blockNumber?: number;
  payload: {
    at?: number;
    data?: {
      jobId?: string;
      payer?: string;
      providerAddress?: string;
      amount?: string;
      asset?: string;
      transactionHash?: string;
      durationMs?: number;
      ok?: boolean;
    };
  } | null;
}

interface Network {
  network: string;
  stats: { providersLive: number; jobsCompleted: number; paidUsdMicros: number };
}

export function Ledger() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const [r, n] = await Promise.all([
          fetch(`${BROKER_URL}/api/receipts`, { signal: AbortSignal.timeout(8_000) }),
          fetch(`${BROKER_URL}/api/network`, { signal: AbortSignal.timeout(8_000) }),
        ]);
        if (!r.ok || !n.ok) throw new Error("unreachable");
        const body = (await r.json()) as { receipts: Receipt[] };
        if (!alive) return;
        setReceipts(body.receipts.slice(0, 6));
        setNetwork((await n.json()) as Network);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
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
    <Section id="ledger" className="border-t border-[var(--line)]">
      <Reveal>
        <SectionHeading
          title="Every job leaves a receipt"
          sub="Registrations, liveness and settlements are appended to a contract on Arc — public, ordered and append-only. You don't have to trust the broker's database; read the events yourself from any RPC."
        />
      </Reveal>

      {/* Permanent facts first: these are true whether or not a broker answers. */}
      <Reveal delay={0.06}>
        <dl className="mx-auto mt-14 max-w-3xl divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {(
            [
              ["Audit log", CHAIN.log, CHAIN.logUrl],
              ["USDC", CHAIN.usdc, CHAIN.usdcUrl],
              ["Network", `Arc testnet · chain ${CHAIN.chainId}`, "https://www.circle.com/arc"],
            ] as const
          ).map(([label, value, href]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3.5">
              <dt className="shrink-0 text-[13.5px] text-fg-2">{label}</dt>
              <dd className="min-w-0">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono block truncate text-[12.5px] text-fg-3 underline-offset-4 transition-colors hover:text-fg hover:underline"
                >
                  {value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="mb-4 flex items-center gap-2.5">
            {offline ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-fg-4" />
                <span className="text-[12.5px] text-fg-4">
                  live feed offline — the contract above is still readable on ArcScan
                </span>
              </>
            ) : (
              <>
                <LiveDot />
                <span className="text-[12.5px] text-fg-3">
                  {network ? (
                    <>
                      <span className="tnum text-fg-2">{network.stats.providersLive}</span> live ·{" "}
                      <span className="tnum text-fg-2">{network.stats.jobsCompleted}</span> settled ·{" "}
                      <span className="tnum text-fg-2">
                        ${(network.stats.paidUsdMicros / 1_000_000).toFixed(4)}
                      </span>{" "}
                      paid to providers
                    </>
                  ) : (
                    "reading the network…"
                  )}
                </span>
              </>
            )}
          </div>

          {receipts && receipts.length > 0 ? (
            <ul className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
              {receipts.map((receipt) => {
                const d = receipt.payload?.data ?? {};
                return (
                  <li key={receipt.sequence} className="py-3.5">
                    <a
                      href={d.transactionHash ? CHAIN.txUrl(d.transactionHash) : CHAIN.logUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 transition-opacity hover:opacity-70"
                    >
                      <span className="mono text-[12.5px] text-fg">{d.jobId ?? "—"}</span>
                      <span className="mono text-[12px] text-fg-4">
                        {d.payer} → {d.providerAddress}
                      </span>
                      <span className="mono tnum text-[12.5px] text-fg-2">
                        {d.amount} µUSDC
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : !offline ? (
            <p className="border-t border-[var(--line)] py-8 text-center text-[13px] text-fg-4">
              No receipts in the log yet.
            </p>
          ) : null}
        </div>
      </Reveal>
    </Section>
  );
}
