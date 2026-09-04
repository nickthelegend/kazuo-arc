"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BROKER_URL, formatUsd } from "@/lib/api";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Quote {
  quoteId: string;
  priceUsdMicros: number;
  priceLabel: string;
  expiresAt: number;
  provider: {
    id: string;
    label: string;
    accountId: string;
    accountUrl: string;
    capability: string;
    adapter: string;
    model: string | null;
    stats: { jobsCompleted: number; jobsFailed: number };
  };
  accepts: Array<{ asset: string; amount: string }>;
}

const ADAPTERS = [
  { id: "", label: "Any" },
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "grok", label: "Grok" },
  { id: "opencode", label: "OpenCode" },
  { id: "openai-compatible", label: "OpenAI-compatible" },
  { id: "echo", label: "Echo (test)" },
];

const HBAR_ASSET = "0.0.0";

/**
 * Post a job: quote, then pay.
 *
 * Two explicit steps rather than one button, because the quote is the moment
 * the buyer learns *who* is about to run their prompt and *what* it costs. x402
 * would happily do this in a single round trip, but hiding the counterparty
 * behind a spinner is a worse product even when it's a faster one.
 */
export function PostJob({ onPosted }: { onPosted?: () => void }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [adapter, setAdapter] = useState("");
  const [maxUsd, setMaxUsd] = useState("0.05");
  const [asset, setAsset] = useState<"usdc" | "hbar">("usdc");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getQuote(): Promise<void> {
    setError(null);
    setBusy(true);
    setQuote(null);
    try {
      const maxPriceUsdMicros = Math.round(Number(maxUsd.replace(/[$,\s]/g, "")) * 1_000_000);
      if (!Number.isFinite(maxPriceUsdMicros) || maxPriceUsdMicros <= 0) {
        throw new Error("Set a positive maximum price.");
      }
      const res = await fetch(`${BROKER_URL}/api/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          adapter: adapter || null,
          maxPriceUsdMicros,
        }),
      });
      const body = (await res.json()) as Quote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `broker returned ${res.status}`);
      setQuote(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function pay(): Promise<void> {
    if (!quote) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quoteId, asset }),
      });
      const body = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !body.jobId) throw new Error(body.error ?? `payment failed (${res.status})`);
      onPosted?.();
      router.push(`/jobs/${body.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const hbarAmount = quote?.accepts.find((a) => a.asset === HBAR_ASSET)?.amount;

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold tracking-tight text-foreground">Post a job</h2>
      <p className="mt-1 text-xs text-muted">
        It runs on a stranger&rsquo;s machine, on their AI subscription, and they get paid for it.
      </p>

      <textarea
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setQuote(null);
        }}
        rows={5}
        placeholder="Write a Python function that parses an ISO-8601 duration into seconds, with tests."
        className="mt-4 w-full resize-y rounded-xl border border-[var(--border)] bg-black/30 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-dim focus:border-violet/50"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-dim">Model</span>
          <select
            value={adapter}
            onChange={(e) => {
              setAdapter(e.target.value);
              setQuote(null);
            }}
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-violet/50"
          >
            {ADAPTERS.map((a) => (
              <option key={a.id} value={a.id} className="bg-[#0d0e14]">
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-dim">Max price (USD)</span>
          <input
            value={maxUsd}
            onChange={(e) => {
              setMaxUsd(e.target.value);
              setQuote(null);
            }}
            inputMode="decimal"
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-foreground outline-none focus:border-violet/50"
          />
        </label>
      </div>

      {!quote ? (
        <button
          type="button"
          onClick={getQuote}
          disabled={busy || prompt.trim().length === 0}
          className="mt-4 w-full rounded-xl bg-[linear-gradient(100deg,#7C5CFF,#3DAAFF_55%,#3DDCFF)] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
        >
          {busy ? "Finding a provider…" : "Get a quote"}
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-violet/25 bg-violet/[0.05] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{quote.provider.label}</p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {quote.provider.capability}
                {quote.provider.model ? ` · ${quote.provider.model}` : ""} ·{" "}
                {quote.provider.stats.jobsCompleted} jobs done
              </p>
              <p className="mono mt-1.5 truncate text-[11px] text-dim">
                pays → {quote.provider.accountId}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-semibold text-mint">{quote.priceLabel}</p>
              <p className="text-[11px] text-dim">per job</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {(["usdc", "hbar"] as const).map((option) => {
              const disabled = option === "hbar" && !hbarAmount;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => setAsset(option)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    asset === option
                      ? "border-cyan/40 bg-cyan/[0.1] text-cyan"
                      : "border-[var(--border)] text-muted hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  Pay in {option.toUpperCase()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-[linear-gradient(100deg,#7C5CFF,#3DAAFF_55%,#3DDCFF)] px-5 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          >
            {busy
              ? "Signing and settling on Hedera…"
              : `Pay ${quote.priceLabel} and run`}
          </button>

          <button
            type="button"
            onClick={() => setQuote(null)}
            className="mt-2 w-full text-center text-[11px] text-dim transition-colors hover:text-muted"
          >
            cancel — nothing has been paid
          </button>
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-rose/25 bg-rose/[0.07] px-3 py-2 text-xs leading-relaxed text-rose">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-dim">
        Payment is signed server-side by a configured testnet account, so no key ever reaches this
        page. Swapping in a browser wallet is the one change needed for real users.
      </p>
    </Card>
  );
}
