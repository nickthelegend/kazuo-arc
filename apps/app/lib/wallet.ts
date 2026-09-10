"use client";

/**
 * The browser wallet.
 *
 * This one file replaces three — `hashpack.ts`, `hedera-wallet.ts` and
 * `hedera-address.ts` — and the reason is the single biggest practical
 * argument for Arc in this whole project.
 *
 * ## What used to be here
 *
 * Hedera's x402 `exact` scheme settles a **native protobuf
 * TransferTransaction**. Ordinary EVM wallets sign EVM RLP transactions, so
 * they could authenticate a user and then not pay: Privy had to be ripped out
 * for exactly this reason. What replaced it was HashPack over WalletConnect,
 * which meant a WalletConnect project id, a relay handshake, `DAppConnector`,
 * `DAppSigner`, and a transaction built with a *second copy* of the Hedera SDK
 * because the wallet library type-checked against a different package name than
 * the rest of the repo. It also meant one genuinely nasty bug: a default freeze
 * offers several candidate nodes, HashPack signs only the first node's body,
 * and the library merges that one signature into all of them — so the payment
 * was rejected as unsigned until the transaction was pinned to a single node.
 *
 * ## What is here now
 *
 * Arc is an EVM chain, and the payment is an **EIP-712 typed-data signature**
 * over an EIP-3009 authorization. Every EVM wallet in existence can do that
 * over EIP-1193 with `eth_signTypedData_v4`. So:
 *
 *  - no WalletConnect project id, no relay, no modal library,
 *  - no second SDK, no protobuf, no node pinning,
 *  - no address→account-id resolution, because on Arc the address *is* the
 *    account and exists without ever being funded.
 *
 * And the user still pays no gas: the signature is not a transaction, and the
 * facilitator is what reaches the chain.
 *
 * Deliberately built on the raw EIP-1193 provider rather than a connector kit.
 * The whole surface used here is four RPC calls, and the dependency it saves is
 * larger than the file.
 */

import { getAddress, type Address } from "viem";
import { ARC_CHAIN } from "./chains";

/** The EIP-1193 subset actually used. */
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletSession {
  address: Address;
  chainId: number;
  /** Signs EIP-712 typed data. This is the entire payment capability. */
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
}

export function walletAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function provider(): Eip1193Provider {
  if (!walletAvailable()) {
    throw new Error(
      "No EVM wallet found. Install MetaMask, Rabby or any EIP-1193 wallet and reload.",
    );
  }
  return window.ethereum!;
}

function sessionFor(address: string, chainId: number): WalletSession {
  const p = provider();
  const account = getAddress(address);
  return {
    address: account,
    chainId,
    async signTypedData(message) {
      // v4 specifically: earlier versions hash arrays and nested structs
      // differently, so a v3 signature over the same EIP-3009 authorization
      // verifies against nothing and reports only "invalid signature".
      const signature = await p.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(message)],
      });
      return signature as `0x${string}`;
    },
  };
}

/**
 * Put the wallet on Arc, adding the network if it has never seen it.
 *
 * Worth doing before asking for a signature rather than after. An EIP-712
 * domain includes `chainId`, so a wallet sitting on some other network signs a
 * structurally valid authorization for a chain the facilitator is not on — and
 * the only symptom is a rejected payment.
 */
async function ensureArc(p: Eip1193Provider): Promise<number> {
  const target = `0x${ARC_CHAIN.id.toString(16)}`;
  const current = (await p.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === target) return ARC_CHAIN.id;

  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: target }] });
  } catch (err) {
    // 4902 means "unrecognised chain" — the wallet has never heard of Arc, so
    // offer to add it rather than telling the user to configure an RPC by hand.
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await p.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: target,
          chainName: ARC_CHAIN.name,
          nativeCurrency: ARC_CHAIN.nativeCurrency,
          rpcUrls: [...ARC_CHAIN.rpcUrls.default.http],
          blockExplorerUrls: [ARC_CHAIN.blockExplorers?.default.url].filter(Boolean),
        },
      ],
    });
  }
  return ARC_CHAIN.id;
}

/** Prompt for access. Opens the wallet's own UI. */
export async function connectWallet(): Promise<WalletSession> {
  const p = provider();
  const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error("The wallet returned no account.");
  const chainId = await ensureArc(p);
  return sessionFor(address, chainId);
}

/**
 * Reconnect silently if the wallet already granted access.
 *
 * `eth_accounts` never prompts — it reports what is already authorised — so
 * this is safe to run on every page load and is what stops a reload from
 * throwing the user back through the connect modal.
 */
export async function restoreWallet(): Promise<WalletSession | null> {
  if (!walletAvailable()) return null;
  try {
    const p = provider();
    const accounts = (await p.request({ method: "eth_accounts" })) as string[];
    const address = accounts?.[0];
    if (!address) return null;
    const chainId = Number((await p.request({ method: "eth_chainId" })) as string);
    // Deliberately not switching chains here. A silent restore must not pop a
    // network-change prompt on page load; the connect path and the payment path
    // both ensure Arc, and `chainId` is surfaced so the UI can say so.
    return sessionFor(address, chainId);
  } catch {
    return null;
  }
}

/** Ensure the connected wallet is on Arc, prompting if it is not. */
export async function switchToArc(): Promise<void> {
  await ensureArc(provider());
}

/** Subscribe to account and chain changes. Returns an unsubscribe function. */
export function watchWallet(onChange: () => void): () => void {
  if (!walletAvailable()) return () => {};
  const p = provider();
  p.on?.("accountsChanged", onChange);
  p.on?.("chainChanged", onChange);
  return () => {
    p.removeListener?.("accountsChanged", onChange);
    p.removeListener?.("chainChanged", onChange);
  };
}

/** Shorten an address for chrome: `0x0329…9F36`. */
export function shortAddress(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
