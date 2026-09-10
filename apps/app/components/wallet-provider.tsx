"use client";

/**
 * Wallet state for the app.
 *
 * Deliberately small — an address, a signer, and the two verbs. Anything more
 * (balances, history) already has a home on the broker or an RPC and does not
 * belong in React state that has to stay correct across reloads.
 *
 * Smaller than its Hedera predecessor in one way worth naming: there is no
 * `available` flag gated on a WalletConnect project id, because there is no
 * relay to configure. The only question is whether the browser has a wallet.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ARC_CHAIN } from "@/lib/chains";
import {
  connectWallet,
  restoreWallet,
  switchToArc,
  walletAvailable,
  watchWallet,
  type WalletSession,
} from "@/lib/wallet";

interface WalletState {
  /** Arc address once connected, e.g. `0x0329…9F36`. */
  address: string | null;
  session: WalletSession | null;
  connecting: boolean;
  /** False until the restore attempt settles, so the UI can avoid flashing. */
  ready: boolean;
  /** Set when a connect attempt failed, for display rather than a toast. */
  error: string | null;
  /** False when the browser has no EIP-1193 wallet at all. */
  available: boolean;
  /** True when the wallet is connected but pointed at some other network. */
  wrongChain: boolean;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reconnect silently if the wallet already granted access. `eth_accounts`
  // never prompts, so a reload doesn't force the user back through the modal.
  useEffect(() => {
    let cancelled = false;
    restoreWallet()
      .then((restored) => {
        if (!cancelled && restored) setSession(restored);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A user who switches account or network in their wallet has changed who is
  // paying. Re-reading rather than trusting stale state is the difference
  // between paying from the address on screen and paying from another one.
  useEffect(
    () =>
      watchWallet(() => {
        void restoreWallet().then(setSession);
      }),
    [],
  );

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      setSession(await connectWallet());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Closing the modal is a decision, not a failure — don't shout about it.
      if (!/reject|cancel|closed|User denied|4001/i.test(message)) setError(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    setError(null);
    try {
      await switchToArc();
      setSession(await restoreWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // There is no "disconnect" in EIP-1193 — a dapp cannot revoke its own access,
  // only the wallet can. Clearing local state is the honest extent of it, and
  // saying so beats a button that pretends to do more than it does.
  const disconnect = useCallback(async () => {
    setSession(null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address: session?.address ?? null,
      session,
      connecting,
      ready,
      error,
      available: walletAvailable(),
      wrongChain: Boolean(session) && session?.chainId !== ARC_CHAIN.id,
      connect,
      switchChain,
      disconnect,
    }),
    [session, connecting, ready, error, connect, switchChain, disconnect],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
