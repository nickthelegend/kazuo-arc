"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createPublicClient, erc20Abi, http, getAddress, formatUnits } from "viem";
import { EASE, useEntrance } from "@/lib/motion";
import { ARC_CHAIN, USDC_ADDRESS, explorerAddress } from "@/lib/chains";
import { useWallet } from "@/components/wallet-provider";
import { shortAddress } from "@/lib/wallet";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Connect an EVM wallet.
 *
 * Any wallet. That sentence is the migration in miniature: Hedera's x402 scheme
 * settles a native protobuf transfer, so an ordinary EVM wallet could
 * authenticate a user and then be unable to pay — which is why this component
 * previously carried a WalletConnect project id, a relay session, and a note
 * explaining that Privy had to be removed. Arc settles an EIP-3009
 * authorization, which is EIP-712 typed data, which every wallet signs.
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
    address,
    connecting,
    ready,
    error,
    available,
    wrongChain,
    connect,
    switchChain,
    disconnect,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const animate = useEntrance();

  useEffect(() => {
    if (!address) {
      setBalances(null);
      return;
    }
    let cancelled = false;
    void (async () => {
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
        if (cancelled) return;
        setBalances({
          usdc: Number(formatUnits(units, 6)),
          native: Number(formatUnits(wei, 18)),
          // One balance, two views. Scaled by 10^12 — see lib/chains.ts.
          agree: wei / 10n ** 12n === units,
        });
      } catch {
        /* a balance we couldn't read is not worth an error state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Close the menu on outside click — a popover that only closes via its own
  // trigger is a popover people leave open.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

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
          {connecting ? "Waiting for wallet…" : "Connect"}
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
        <span className="mono">{shortAddress(address)}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={animate ? { opacity: 0, y: -4 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: EASE }}
            className={cn(
              "absolute right-0 z-50 mt-1.5 w-[300px] rounded-xl border border-[var(--line-2)] bg-black p-4",
              "shadow-[0_16px_40px_rgba(0,0,0,0.9)]",
            )}
          >
            <div className="text-[11px] uppercase tracking-[0.14em] text-fg-4">
              {ARC_CHAIN.name}
            </div>
            <div className="mono mt-1.5 break-all text-[12px] text-fg">{address}</div>

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

            <p className="mt-3 text-[12px] leading-relaxed text-fg-3">
              You sign each payment in your wallet — an authorization, not a transaction. Xorv never
              holds your key, and you pay no gas: the facilitator relays it and covers the fee.
            </p>

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
              Forget this wallet
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
