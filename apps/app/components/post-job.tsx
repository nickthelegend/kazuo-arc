"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BROKER_URL, formatUsd } from "@/lib/api";
import { Button, Panel } from "@/components/ui";
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
    capability: string;
    adapter: string;
    model: string | null;
    stats: { jobsCompleted: number; jobsFailed: number };
  };
  accepts: Array<{ asset: string; amount: string }>;
}

const ADAPTERS = [
  { id: "", label: "Any model" },
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "grok", label: "Grok" },
  { id: "opencode", label: "OpenCode" },
  { id: "openai-compatible", label: "OpenAI-compatible" },
  { id: "echo", label: "Echo (test)" },
];

const HBAR = "0.0.0";

/**
 * Post a job: quote, then pay.
 *
 * Two explicit steps rather than one button, because the quote is the moment
 * the buyer learns *who* is about to run their prompt and *what* it costs.
 * x402 would happily do this in a single round trip, but hiding the
 * counterparty behind a spinner is a worse product even when it's faster.
 */
export function PostJob() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [adapter, setAdapter] = useState("");
  const [maxUsd, setMaxUsd] = useState("0.50");
  const [asset, setAsset] = useState<"usdc" | "hbar">("usdc");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setQuote(null);
    setError(null);
  };

  async function getQuote(): Promise<void> {
    setError(null);
    setBusy(true);
    setQuote(null);
    try {
      const maxPriceUsdMicros = Math.round(Number(maxUsd.replace(/[$,\s]/g, "")) * 1_000_000);
      if (!Number.isFinite(maxPriceUsdMicros) || maxPriceUsdMicros <= 0) {
        throw new Error("Set a maximum price above zero.");
      }
      const res = await fetch(`${BROKER_URL}/api/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, adapter: adapter || null, maxPriceUsdMicros }),
      });
      const body = (await res.json()) as Quote & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Broker returned ${res.status}.`);
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
      if (!res.ok || !body.jobId) throw new Error(body.error ?? `Payment failed (${res.status}).`);
      router.push(`/jobs/${body.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const hbarAmount = quote?.accepts.find((a) => a.asset === HBAR)?.amount;

  return (
    <Panel className="p-5">
      <label htmlFor="prompt" className="text-[13px] font-medium text-fg">
        What needs doing?
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          reset();
        }}
        rows={4}
        placeholder="Write a Python function that parses an ISO-8601 duration into seconds, with tests."
        className="mt-2.5 w-full resize-y rounded-lg border border-[var(--line)] bg-black px-3.5 py-3 text-[14px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-4 focus:border-[var(--line-3)]"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] text-fg-3">Model</span>
          <select
            value={adapter}
            onChange={(e) => {
              setAdapter(e.target.value);
              reset();
            }}
            className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-black px-3 py-2 text-[13.5px] text-fg outline-none focus:border-[var(--line-3)]"
          >
            {ADAPTERS.map((a) => (
              <option key={a.id} value={a.id} className="bg-black">
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] text-fg-3">Most you&rsquo;ll pay (USD)</span>
          <input
            value={maxUsd}
            onChange={(e) => {
              setMaxUsd(e.target.value);
              reset();
            }}
            inputMode="decimal"
            className="tnum mt-1.5 w-full rounded-lg border border-[var(--line)] bg-black px-3 py-2 text-[13.5px] text-fg outline-none focus:border-[var(--line-3)]"
          />
        </label>
      </div>

      {!quote ? (
        <Button
          onClick={getQuote}
          disabled={busy || prompt.trim().length === 0}
          className="mt-4 w-full"
        >
          {busy ? "Finding a provider…" : "Get a quote"}
        </Button>
      ) : (
        <div className="mt-4 rounded-lg border border-[var(--line-2)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-fg">{quote.provider.label}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-fg-3">
                {quote.provider.capability}
                {quote.provider.model ? ` · ${quote.provider.model}` : ""} ·{" "}
                {quote.provider.stats.jobsCompleted} done
              </p>
              <p className="mono mt-1.5 truncate text-[11.5px] text-fg-4">
                pays → {quote.provider.accountId}
              </p>
            </div>
            <p className="tnum shrink-0 text-[17px] font-semibold text-fg">{quote.priceLabel}</p>
          </div>

          <div className="mt-4 flex gap-2" role="group" aria-label="Payment asset">
            {(["usdc", "hbar"] as const).map((option) => {
              const disabled = option === "hbar" && !hbarAmount;
              const selected = asset === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => setAsset(option)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-colors",
                    selected
                      ? "border-[var(--line-3)] bg-white/[0.07] text-fg"
                      : "border-[var(--line)] text-fg-3 hover:text-fg-2",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  Pay in {option.toUpperCase()}
                </button>
              );
            })}
          </div>

          <Button onClick={pay} disabled={busy} className="mt-3 w-full">
            {busy ? "Signing and settling on Hedera…" : `Pay ${quote.priceLabel} and run`}
          </Button>

          <button
            type="button"
            onClick={reset}
            className="mt-2.5 w-full text-center text-[12px] text-fg-4 transition-colors hover:text-fg-2"
          >
            Cancel — nothing has been paid
          </button>
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-fail/25 bg-fail/[0.06] px-3 py-2.5 text-[12.5px] leading-relaxed text-fail"
        >
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-[11.5px] leading-relaxed text-fg-4">
        Payments are signed server-side by a configured testnet account, so no key reaches this
        page. Swapping in a browser wallet is the one change needed for real users.
      </p>
    </Panel>
  );
}
