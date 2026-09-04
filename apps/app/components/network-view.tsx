"use client";

import { useEffect, useState } from "react";
import { api, formatUsd, type NetworkInfo } from "@/lib/api";
import { Card, Empty, ExternalLink, Field } from "@/components/ui";

interface Receipt {
  consensusAt: string;
  sequence: number;
  payload: unknown;
}

interface ReceiptPayload {
  kind?: string;
  at?: number;
  data?: {
    jobId?: string;
    providerAccountId?: string;
    payer?: string;
    amount?: string;
    asset?: string;
    transactionId?: string;
    resultHash?: string;
    durationMs?: number;
    ok?: boolean;
  };
}

export function NetworkView() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [topic, setTopic] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const [net, rec] = await Promise.all([api.network(), api.receipts()]);
        if (!alive) return;
        setInfo(net);
        setReceipts(rec.receipts);
        setTopic(rec.topic);
        setError(null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (error && !info) return <Empty title="Can't reach the broker" hint={error} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Providers live" value={String(info?.stats.providersLive ?? "—")} />
        <Stat label="Jobs completed" value={String(info?.stats.jobsCompleted ?? "—")} />
        <Stat label="Settled" value={formatUsd(info?.stats.paidUsdMicros ?? 0)} />
        <Stat
          label="HBAR price"
          value={info?.hbarRate ? `$${(info.hbarRate.centsPerHbar / 100).toFixed(4)}` : "—"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Facilitator
          </h2>
          <p className="mt-2 text-sm text-foreground">{info?.facilitator.description ?? "—"}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            The facilitator co-signs and pays the network fee on every settlement, which is why a
            buyer needs no HBAR at all.
          </p>
          <div className="mt-4 border-t border-[var(--border)] pt-2">
            <Field label="fee payer">{info?.facilitator.feePayer ?? "—"}</Field>
            <Field label="network">{info?.network ?? "—"}</Field>
            <Field label="usdc">
              {info ? (
                <ExternalLink
                  href={`https://hashscan.io/${info.network === "hedera:mainnet" ? "mainnet" : "testnet"}/token/${info.usdc}`}
                >
                  {info.usdc} ↗
                </ExternalLink>
              ) : (
                "—"
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Consensus topics
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Append-only, publicly readable, ordered by consensus timestamp.
          </p>
          <div className="mt-4 space-y-2">
            {info
              ? Object.entries(info.topics).map(([kind, t]) => (
                  <div
                    key={kind}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <p className="text-xs capitalize text-foreground">{kind}</p>
                      <p className="mono text-[11px] text-dim">{t?.id ?? "not configured"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-mint">
                        {info.hcsPublished[kind as keyof NetworkInfo["hcsPublished"]] ?? 0}
                      </p>
                      {t ? (
                        <ExternalLink href={t.url}>
                          <span className="text-[11px]">open ↗</span>
                        </ExternalLink>
                      ) : null}
                    </div>
                  </div>
                ))
              : null}
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Receipts from the ledger
          </h2>
          {topic ? (
            <ExternalLink href={topic.url}>
              <span className="text-[11px]">topic {topic.id} ↗</span>
            </ExternalLink>
          ) : null}
        </div>

        {!receipts ? (
          <div className="card h-40 animate-pulse bg-white/[0.02]" />
        ) : receipts.length === 0 ? (
          <Empty
            title="No receipts yet"
            hint="Every completed job writes one here, read straight from a Hedera mirror node."
          />
        ) : (
          <div className="space-y-2">
            {receipts.map((receipt) => {
              const payload = receipt.payload as ReceiptPayload | null;
              const data = payload?.data;
              return (
                <Card key={receipt.sequence} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mono truncate text-xs text-foreground">
                        {data?.jobId ?? `seq ${receipt.sequence}`}
                      </p>
                      <p className="mono mt-1 truncate text-[11px] text-dim">
                        {data?.payer} → {data?.providerAccountId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-mint">
                        {data?.amount} {data?.asset === "0.0.0" ? "tℏ" : "µUSDC"}
                      </p>
                      <p className="text-[11px] text-dim">
                        {data?.ok ? "ok" : "failed"} · seq {receipt.sequence}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </Card>
  );
}
