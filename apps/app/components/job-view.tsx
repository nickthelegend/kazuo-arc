"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BROKER_URL,
  NETWORK,
  api,
  formatDuration,
  formatUsd,
  hashscanAccount,
  type Job,
  type JobEvent,
} from "@/lib/api";
import { Card, ExternalLink, Field, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

const EVENT_STYLE: Record<JobEvent["kind"], { glyph: string; className: string }> = {
  status: { glyph: "·", className: "text-dim" },
  message: { glyph: "▸", className: "text-foreground" },
  tool_call: { glyph: "⚙", className: "text-cyan" },
  file_edit: { glyph: "✎", className: "text-amber" },
  reasoning: { glyph: "…", className: "text-dim italic" },
  error: { glyph: "✖", className: "text-rose" },
};

function hashscanTx(transactionId: string): string {
  const net = NETWORK === "hedera:mainnet" ? "mainnet" : "testnet";
  return `https://hashscan.io/${net}/transaction/${transactionId.replace("@", "-").replace(/\.(\d+)$/, "-$1")}`;
}

/**
 * One job, live.
 *
 * Subscribes to the broker's SSE stream while the job is in flight and stops
 * as soon as it reaches a terminal state — a finished job is a static document,
 * and holding an event stream open for it wastes a connection on both ends.
 */
export function JobView({ jobId, initial }: { jobId: string; initial: Job | null }) {
  const [job, setJob] = useState<Job | null>(initial);
  const [events, setEvents] = useState<JobEvent[]>(initial?.events ?? []);
  const [connected, setConnected] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  const terminal = job?.status === "completed" || job?.status === "failed";

  useEffect(() => {
    if (terminal) return;

    const source = new EventSource(`${BROKER_URL}/api/jobs/${jobId}/stream`);

    source.addEventListener("open", () => setConnected(true));

    source.addEventListener("snapshot", (e) => {
      const next = JSON.parse((e as MessageEvent).data) as Job;
      setJob(next);
      if (next.events) setEvents(next.events);
    });

    source.addEventListener("event", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as JobEvent;
      setEvents((prev) => [...prev, event]);
    });

    source.addEventListener("job", (e) => {
      setJob(JSON.parse((e as MessageEvent).data) as Job);
    });

    source.addEventListener("done", (e) => {
      const next = JSON.parse((e as MessageEvent).data) as Job;
      setJob(next);
      if (next.events) setEvents(next.events);
      source.close();
      setConnected(false);
      // The HCS receipt is written a beat after settlement, so one delayed
      // refetch turns "publishing…" into a real link without polling forever.
      setTimeout(() => {
        void api.job(jobId).then(setJob).catch(() => {});
      }, 6_000);
    });

    source.addEventListener("error", () => setConnected(false));

    return () => source.close();
  }, [jobId, terminal]);

  // Keep the newest line in view while the job is running.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events.length]);

  if (!job) {
    return <Card>Job not found. It may have expired, or the broker restarted.</Card>;
  }

  const elapsed =
    job.completedAt && job.startedAt
      ? job.completedAt - job.startedAt
      : job.startedAt
        ? Date.now() - job.startedAt
        : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-5">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={job.status} />
            <span className="mono text-[11px] text-dim">{job.id}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {job.prompt}
          </p>
        </Card>

        {job.result ? (
          <Card>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">Result</h2>
            <pre className="mono mt-3 max-h-[30rem] overflow-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
              {job.result}
            </pre>
          </Card>
        ) : null}

        {job.error ? (
          <Card className="border-rose/25 bg-rose/[0.05]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose">Failed</h2>
            <p className="mt-2 text-sm text-rose">{job.error}</p>
          </Card>
        ) : null}

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
              Execution log
            </h2>
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-cyan">
                <span className="live-dot h-1 w-1 rounded-full bg-cyan" />
                streaming
              </span>
            ) : null}
          </div>

          <div ref={logRef} className="mono mt-3 max-h-72 space-y-1 overflow-auto text-[12px]">
            {events.length === 0 ? (
              <p className="text-dim">waiting for the provider…</p>
            ) : (
              events.map((event, i) => {
                const style = EVENT_STYLE[event.kind] ?? EVENT_STYLE.status;
                return (
                  <div key={`${event.at}-${i}`} className="flex gap-2">
                    <span className={cn("shrink-0", style.className)}>{style.glyph}</span>
                    <span className={cn("min-w-0 break-words", style.className)}>{event.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">Provider</h2>
          <p className="mt-2 text-sm font-medium text-foreground">
            {job.providerLabel ?? "unassigned"}
          </p>
          {job.providerAccountId ? (
            <p className="mono mt-1 text-[11px]">
              <ExternalLink href={hashscanAccount(job.providerAccountId)}>
                {job.providerAccountId} ↗
              </ExternalLink>
            </p>
          ) : null}
          <div className="mt-4 border-t border-[var(--border)] pt-2">
            <Field label="price">{formatUsd(job.priceUsdMicros)}</Field>
            <Field label="took">{elapsed ? formatDuration(elapsed) : "—"}</Field>
            <Field label="events">{job.eventCount}</Field>
          </div>
        </Card>

        <Card className={cn(job.payment && "border-mint/25")}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            On-chain receipt
          </h2>

          {job.payment ? (
            <>
              <p className="mt-2 text-lg font-semibold text-mint">
                {formatUsd(job.priceUsdMicros)}{" "}
                <span className="text-xs font-normal text-muted">
                  in {job.payment.asset.toUpperCase()}
                </span>
              </p>
              <div className="mt-3 border-t border-[var(--border)] pt-2">
                <Field label="payer">
                  <ExternalLink href={hashscanAccount(job.payment.payer)}>
                    {job.payment.payer}
                  </ExternalLink>
                </Field>
                <Field label="paid to">
                  <ExternalLink href={hashscanAccount(job.payment.payTo)}>
                    {job.payment.payTo}
                  </ExternalLink>
                </Field>
                <Field label="amount">
                  {job.payment.amount} {job.payment.asset === "hbar" ? "tℏ" : "µUSDC"}
                </Field>
                <Field label="network">{job.payment.network}</Field>
              </div>

              <Link
                href={job.payment.hashscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block rounded-lg border border-mint/30 bg-mint/[0.07] px-3 py-2.5 text-center text-xs font-medium text-mint transition-colors hover:bg-mint/[0.12]"
              >
                View transfer on HashScan ↗
              </Link>

              {job.receiptConsensusAt ? (
                <Link
                  href={hashscanTx(job.receiptConsensusAt)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block rounded-lg border border-[var(--border)] px-3 py-2.5 text-center text-xs text-muted transition-colors hover:text-foreground"
                >
                  View HCS receipt ↗
                </Link>
              ) : (
                <p className="mt-2 text-center text-[11px] text-dim">
                  HCS receipt publishing…
                </p>
              )}

              {job.resultHash ? (
                <p className="mono mt-3 break-all text-[10px] leading-relaxed text-dim">
                  sha256 {job.resultHash}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Settling on Hedera — this usually takes about three seconds.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
