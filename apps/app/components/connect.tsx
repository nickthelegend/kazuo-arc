"use client";

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AnimatePresence, motion } from "motion/react";
import { NETWORK } from "@/lib/api";
import { resolveHederaAccount, shortAddress, type Resolution } from "@/lib/hedera-address";
import { EASE, useEntrance } from "@/lib/motion";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Connect, and what being connected actually means here.
 *
 * The interesting state is the one most wallet buttons skip: **signed in, but
 * the Hedera account does not exist yet.** An address derived from a fresh key
 * is a perfectly valid destination, but until something sends it HBAR the
 * ledger has no account for it — so it can't be a `payTo`, and it has no
 * balance to read. Showing "connected ✓" there would be a lie the user only
 * discovers when a payment fails.
 */
export function Connect() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<Resolution | null>(null);
  const animate = useEntrance();

  const wallet = wallets[0];
  const address = wallet?.address;

  useEffect(() => {
    if (!address) {
      setAccount(null);
      return;
    }
    const controller = new AbortController();
    void resolveHederaAccount(NETWORK, address, controller.signal).then(setAccount);
    return () => controller.abort();
  }, [address]);

  // Close the menu on outside click — a popover that only closes via its own
  // trigger is a popover people leave open.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  if (!ready) {
    return <div className="h-[34px] w-[104px] animate-pulse rounded-lg bg-white/[0.04]" />;
  }

  if (!authenticated) {
    return (
      <Button onClick={login} className="px-3.5 py-2 text-[13px]">
        Connect
      </Button>
    );
  }

  const label =
    user?.google?.name ??
    user?.github?.username ??
    user?.email?.address ??
    (address ? shortAddress(address) : "Account");

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
          "border-[var(--line-2)] text-fg hover:border-[var(--line-3)] hover:bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            account?.status === "resolved" ? "bg-live" : "bg-warn",
          )}
        />
        <span className="max-w-[130px] truncate">{label}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={animate ? { opacity: 0, y: -4, scale: 0.98 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={animate ? { opacity: 0, y: -4, scale: 0.98 } : undefined}
            transition={{ duration: 0.16, ease: EASE }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[292px] rounded-xl border border-[var(--line-2)] bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.6),0_24px_64px_-32px_rgba(0,0,0,0.9)]"
          >
            <p className="truncate text-[13.5px] font-medium text-fg">{label}</p>
            {user?.email?.address && label !== user.email.address ? (
              <p className="truncate text-[12px] text-fg-4">{user.email.address}</p>
            ) : null}

            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <p className="text-[11px] text-fg-4">Wallet</p>
              <p className="mono mt-1 break-all text-[11.5px] text-fg-2">{address ?? "none"}</p>
            </div>

            <div className="mt-3 border-t border-[var(--line)] pt-3">
              <p className="text-[11px] text-fg-4">Hedera account</p>
              <HederaState resolution={account} />
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="mt-4 w-full rounded-lg border border-[var(--line)] py-2 text-[12.5px] text-fg-2 transition-colors hover:border-[var(--line-2)] hover:text-fg"
            >
              Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function HederaState({ resolution }: { resolution: Resolution | null }) {
  if (!resolution) {
    return <p className="mt-1 text-[11.5px] text-fg-4">checking…</p>;
  }

  if (resolution.status === "resolved") {
    const net = NETWORK === "hedera:mainnet" ? "mainnet" : "testnet";
    return (
      <>
        <p className="mono mt-1 text-[12px] text-fg">{resolution.accountId}</p>
        <a
          href={`https://hashscan.io/${net}/account/${resolution.accountId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-[11.5px] text-fg-4 underline-offset-4 hover:text-fg-2 hover:underline"
        >
          View on HashScan ↗
        </a>
      </>
    );
  }

  if (resolution.status === "not-created") {
    return (
      <>
        <p className="mt-1 text-[11.5px] leading-relaxed text-warn">
          Not created yet. On Hedera an account exists once it first receives
          HBAR — until then this address can be paid to, but has no account id.
        </p>
        <a
          href="https://portal.hedera.com/faucet"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-[11.5px] text-fg-3 underline-offset-4 hover:text-fg hover:underline"
        >
          Fund it from the faucet ↗
        </a>
      </>
    );
  }

  return <p className="mt-1 text-[11.5px] text-fail">{resolution.message}</p>;
}
