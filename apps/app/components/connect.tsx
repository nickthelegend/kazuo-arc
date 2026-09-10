"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPublicClient, erc20Abi, http, getAddress, formatUnits } from "viem";
import { EASE, useEntrance } from "@/lib/motion";
import { ARC_CHAIN, USDC_ADDRESS, explorerAddress, explorerTx } from "@/lib/chains";
import { useWallet } from "@/components/wallet-provider";
import { shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui";
import { WorldVerify } from "@/components/world-verify";
import { cn } from "@/lib/utils";

/**
 * Sign in, and the wallet that comes with it.
 *
 * With Privy configured this is an email box away from a working wallet: Privy
 * creates an embedded wallet on Arc, and that wallet can pay for a job straight
 * away, because a job payment is an EIP-712 signature rather than a
 * transaction. External wallets still connect through the same modal.
 *
 * The popover carries the second financial flow — sending USDC — because a
 * wallet you can receive into but not send from is only half a wallet, and an
 * embedded wallet has no extension UI to do it in.
 *
 * The balance shown is read straight from the token contract rather than an
 * indexer, because there is one and it is authoritative.
 */

interface Balances {
  /** The ERC-20 view, in USDC. This is the money figure. */
  usdc: number;
  /** The native view of the same balance, at 18 decimals. */
  native: number;
  /** They must agree; if they don't, the configured token isn't Arc's USDC. */
  agree: boolean;
}

export function Connect() {
  const {
    kind,
    address,
    connecting,
    ready,
    error,
    available,
    wrongChain,
    embedded,
    email,
    connect,
    switchChain,
    disconnect,
    sendUsdc,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const animate = useEntrance();

  const refreshBalances = useCallback(async () => {
    if (!address) {
      setBalances(null);
      return;
    }
    try {
      const client = createPublicClient({ chain: ARC_CHAIN, transport: http() });
      const account = getAddress(address);
      const [units, wei] = await Promise.all([
        client.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [account],
        }),
        client.getBalance({ address: account }),
      ]);
      setBalances({
        usdc: Number(formatUnits(units, 6)),
        native: Number(formatUnits(wei, 18)),
        // One balance, two views. Scaled by 10^12 — see lib/chains.ts.
        agree: wei / 10n ** 12n === units,
      });
    } catch {
      /* a balance we couldn't read is not worth an error state */
    }
  }, [address]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  // Close the menu on outside click — a popover that only closes via its own
  // trigger is a popover people leave open.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  async function onSend(): Promise<void> {
    setSendError(null);
    setSent(null);
    setSending(true);
    try {
      const hash = await sendUsdc(sendTo, sendAmount);
      setSent(hash);
      setSendAmount("");
      // Arc blocks are sub-second; one short wait is enough for the balance.
      setTimeout(() => void refreshBalances(), 2_500);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (!/reject|cancel|denied|4001/i.test(text)) setSendError(text);
    } finally {
      setSending(false);
    }
  }

  if (!available) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="text-[12px] text-fg-4 underline underline-offset-2 transition-colors hover:text-fg-2"
      >
        No wallet found
      </a>
    );
  }

  if (!ready) {
    return <div className="h-[34px] w-[104px] animate-pulse rounded-lg bg-white/[0.04]" />;
  }

  if (!address) {
    return (
      <div className="flex items-center gap-2">
        {error ? (
          <span className="max-w-[220px] truncate text-[12px] text-[#f87171]">{error}</span>
        ) : null}
        <Button
          onClick={() => void connect()}
          disabled={connecting}
          className="px-3.5 py-2 text-[13px]"
        >
          {connecting ? "Waiting for wallet…" : kind === "privy" ? "Sign in" : "Connect"}
        </Button>
      </div>
    );
  }

  if (wrongChain) {
    // Worth its own state rather than a silent failure. An EIP-712 domain
    // includes the chain id, so a signature made on the wrong network is
    // structurally valid and verifies against nothing.
    return (
      <Button onClick={() => void switchChain()} className="px-3.5 py-2 text-[13px]">
        Switch to {ARC_CHAIN.name}
      </Button>
    );
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Wallet ${address}`}
        className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] text-fg-2 transition-colors hover:border-[var(--line-2)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)]" aria-hidden />
        <span className="mono">{email ?? shortAddress(address)}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={animate ? { opacity: 0, y: -4 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: EASE }}
            className={cn(
              "absolute right-0 z-50 mt-1.5 w-[320px] rounded-xl border border-[var(--line-2)] bg-black p-4",
              "shadow-[0_16px_40px_rgba(0,0,0,0.9)]",
            )}
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-fg-4">
              <span>{ARC_CHAIN.name}</span>
              <span>{embedded ? "Privy embedded wallet" : kind === "privy" ? "via Privy" : "injected"}</span>
            </div>
            {email ? <div className="mt-1.5 text-[12px] text-fg-3">{email}</div> : null}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(address).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1_500);
                });
              }}
              title="Copy address — send testnet USDC here to fund it"
              className="mono mt-1.5 block break-all text-left text-[12px] text-fg transition-colors hover:text-fg-2"
            >
              {address}
              <span className="ml-1.5 text-[11px] text-fg-4">{copied ? "copied" : "copy"}</span>
            </button>

            {balances ? (
              <dl className="mt-4 space-y-2 border-t border-[var(--line)] pt-3 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-fg-3">USDC</dt>
                  <dd className="mono text-fg">${balances.usdc.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt
                    className="text-fg-3"
                    title="The same balance at 18 decimals — the view the EVM meters gas in"
                  >
                    gas view
                  </dt>
                  <dd className="mono text-fg-3">{balances.native.toFixed(6)}</dd>
                </div>
              </dl>
            ) : null}

            {balances && !balances.agree ? (
              <p className="mt-3 text-[12px] leading-relaxed text-[#fbbf24]">
                The ERC-20 and native balances disagree, so this isn&rsquo;t Arc&rsquo;s native
                USDC. Amounts shown here can&rsquo;t be trusted.
              </p>
            ) : null}

            {balances && balances.usdc === 0 ? (
              <p className="mt-3 text-[12px] leading-relaxed text-fg-3">
                Empty. Copy the address above and claim Arc testnet USDC at{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-fg"
                >
                  faucet.circle.com
                </a>
                .
              </p>
            ) : null}

            <WorldVerify address={address} />

            <p className="mt-3 text-[12px] leading-relaxed text-fg-3">
              Paying for a job is a signature, not a transaction — you pay no gas and Kazuo never
              holds your key. Sending USDC below is a real transfer; on Arc its gas is paid in
              USDC too.
            </p>

            <form
              className="mt-3 space-y-2 border-t border-[var(--line)] pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void onSend();
              }}
            >
              <div className="text-[11px] uppercase tracking-[0.14em] text-fg-4">Send USDC</div>
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="0x… recipient"
                spellCheck={false}
                className="mono w-full rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-4 focus:border-[var(--line-2)]"
              />
              <div className="flex gap-2">
                <input
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.10"
                  inputMode="decimal"
                  className="mono w-full rounded-lg border border-[var(--line)] bg-transparent px-2.5 py-1.5 text-[12px] text-fg outline-none placeholder:text-fg-4 focus:border-[var(--line-2)]"
                />
                <button
                  type="submit"
                  disabled={sending || !sendTo || !sendAmount}
                  className="shrink-0 rounded-lg border border-[var(--line-2)] px-3 py-1.5 text-[12px] text-fg transition-colors hover:bg-white/[0.04] disabled:opacity-40"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
              {sent ? (
                <a
                  href={explorerTx(sent)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono block truncate text-[11.5px] text-[var(--live)] underline underline-offset-2"
                >
                  sent · {shortAddress(sent, 10, 8)}
                </a>
              ) : null}
              {sendError ? (
                <p className="text-[11.5px] leading-relaxed text-[#f87171]">{sendError}</p>
              ) : null}
            </form>

            <a
              href={explorerAddress(address)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-[12px] text-fg-2 underline underline-offset-2 transition-colors hover:text-fg"
            >
              View on ArcScan
            </a>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void disconnect();
              }}
              className="mt-4 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[12px] text-fg-2 transition-colors hover:border-[var(--line-2)] hover:text-fg"
            >
              {kind === "privy" ? "Sign out" : "Forget this wallet"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
