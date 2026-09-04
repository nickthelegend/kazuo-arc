"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatAgo, formatUsd, type Job, type Provider } from "@/lib/api";
import { Card, Empty, StatusBadge } from "@/components/ui";

/**
 * Polling, not sockets.
 *
 * The broker streams per-job events over SSE (that's what the job page uses),
 * but these two lists are summaries that change on the order of seconds. A
 * five-second poll is a dozen lines and survives a broker restart without
 * reconnection logic; a socket here would be machinery for its own sake.
 */
function usePoll<T>(load: () => Promise<T>, intervalMs = 5_000): { data: T | null; error: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const stable = useCallback(load, [load]);

  useEffect(() => {
    let alive = true;
    const run = async (): Promise<void> => {
      try {
        const next = await stable();
        if (!alive) return;
        setData(next);
        setError(false);
      } catch {
        if (alive) setError(true);
      }
    };
    void run();
    const timer = setInterval(run, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [stable, intervalMs]);

  return { data, error };
}

export function ProviderList({ compact = false }: { compact?: boolean }) {
  const { data: providers, error } = usePoll<Provider[]>(useCallback(() => api.providers(), []));

  if (error) {
    return <Empty title="Can't reach the broker" hint="Start it with `pnpm broker` in the xorv repo." />;
  }
  if (!providers) return <Skeleton rows={2} />;
  if (providers.length === 0) {
    return (
      <Empty
        title="No providers online"
        hint={
          <>
            Run <span className="mono text-muted">npm i -g xorv &amp;&amp; xorv init &amp;&amp; xorv start</span> on
            any machine with Claude Code, Codex or Grok installed.
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {providers.slice(0, compact ? 4 : undefined).map((p) => {
        const cheapest = p.capabilities.reduce(
          (min, c) => Math.min(min, c.priceUsdMicros),
          Number.POSITIVE_INFINITY,
        );
        return (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{p.label}</span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted">
                  {p.capabilities.map((c) => c.displayName).join(", ")}
                </p>
                <p className="mono mt-1 text-[11px] text-dim">
                  {p.accountId}
                  {p.region ? ` · ${p.region}` : ""} · beat {formatAgo(p.lastHeartbeatAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-mint">
                  {Number.isFinite(cheapest) ? formatUsd(cheapest) : "—"}
                </p>
                <p className="text-[11px] text-dim">{p.stats.jobsCompleted} done</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function JobList({ limit = 12 }: { limit?: number }) {
  const load = useCallback(() => api.jobs(limit), [limit]);
  const { data: jobs, error } = usePoll<Job[]>(load);

  if (error) return <Empty title="Can't reach the broker" />;
  if (!jobs) return <Skeleton rows={3} />;
  if (jobs.length === 0) {
    return <Empty title="No jobs yet" hint="Post one above — it settles on Hedera in about three seconds." />;
  }

  return (
    <div className="space-y-2.5">
      {jobs.map((job) => (
        <Link key={job.id} href={`/jobs/${job.id}`} className="block">
          <Card className="card-hover p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  <span className="mono truncate text-[11px] text-dim">{job.id}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{job.prompt}</p>
                <p className="mt-1 truncate text-[11px] text-dim">
                  {job.providerLabel ?? "unassigned"} · {formatAgo(job.createdAt)}
                  {job.payment ? ` · paid in ${job.payment.asset.toUpperCase()}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-mint">
                {formatUsd(job.priceUsdMicros)}
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card h-[86px] animate-pulse bg-white/[0.02]" />
      ))}
    </div>
  );
}
