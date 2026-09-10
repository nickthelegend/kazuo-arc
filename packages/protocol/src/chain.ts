/**
 * Arc plumbing shared by the broker, the CLI and the setup scripts.
 *
 * This module is the whole of what used to be `hedera.ts`, and it is a third
 * the size. Two things went away and neither is coming back:
 *
 * **Key-curve guessing.** Hedera keys are ED25519 or ECDSA, DER-encoded or
 * hex, and the two parsers throw on each other's input — so the old code tried
 * three decoders in order and hoped. An EVM private key is 32 bytes of hex.
 * There is one format and it either is one or it isn't.
 *
 * **Token association.** On Hedera an account must opt in to a token before it
 * can be paid in it, or the transfer dies at consensus with
 * `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`. That was a real onboarding cliff: a
 * provider had to run a transaction, costing HBAR they might not have, before
 * they could earn anything. ERC-20 has no such concept. Any address can receive
 * USDC, always, having done nothing. The `canReceiveUsdc` check that existed to
 * catch this is gone because the failure it caught cannot happen.
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  erc20Abi,
  isAddress as viemIsAddress,
  getAddress,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { ARC_MAINNET_CHAIN_ID, chainIdFor, rpcUrl, usdcAddress } from "./constants.js";

/**
 * Arc as viem sees it.
 *
 * Built here rather than imported from `viem/chains` so the RPC honours
 * `XORV_RPC_URL` — a self-hosted or paid endpoint is the difference between a
 * demo that works and one that rate-limits halfway through.
 */
export function arcChain(network: string): Chain {
  const id = chainIdFor(network);
  return defineChain({
    id,
    name: id === ARC_MAINNET_CHAIN_ID ? "Arc" : "Arc Testnet",
    // 18 decimals here is not a contradiction of USDC's 6. This field describes
    // the *native* view the EVM meters gas in; money in this codebase uses the
    // ERC-20 view. See constants.ts.
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl(network)] } },
    blockExplorers: {
      default: {
        name: "ArcScan",
        url: id === ARC_MAINNET_CHAIN_ID ? "https://arcscan.app" : "https://testnet.arcscan.app",
      },
    },
    testnet: id !== ARC_MAINNET_CHAIN_ID,
  });
}

/**
 * Parse an EVM private key.
 *
 * Accepts it with or without the `0x`, because half the tooling in the world
 * prints it each way, and rejects anything else immediately. A malformed key
 * that slips through here surfaces much later as a signature nobody can verify,
 * which is a far worse place to find out.
 */
export function parsePrivateKey(raw: string): `0x${string}` {
  const key = raw.trim();
  if (!key) throw new Error("empty private key");
  const hex = key.startsWith("0x") ? key.slice(2) : key;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `not an EVM private key: expected 32 bytes of hex (64 characters), got ${hex.length}`,
    );
  }
  return `0x${hex}`;
}

/** The account a private key controls. */
export function accountFor(rawKey: string): PrivateKeyAccount {
  return privateKeyToAccount(parsePrivateKey(rawKey));
}

/** A read-only client, for balances and contract reads. */
export function readClient(network: string): PublicClient {
  return createPublicClient({
    chain: arcChain(network),
    transport: http(rpcUrl(network), { timeout: 30_000 }),
  }) as PublicClient;
}

/** A client that can sign and broadcast, for the facilitator and the log. */
export function writeClient(network: string, rawKey: string): WalletClient {
  return createWalletClient({
    account: accountFor(rawKey),
    chain: arcChain(network),
    transport: http(rpcUrl(network), { timeout: 30_000 }),
  });
}

export interface AccountBalances {
  /**
   * The native/gas view, in wei (18dp).
   *
   * Reported for diagnostics only. It is the *same* balance as `usdcUnits`,
   * scaled by 10^12 — not a separate pot of gas money. Displaying both is
   * useful precisely because seeing them agree is what convinces someone the
   * dual-face model is real.
   */
  nativeWei: string;
  /** The ERC-20 view, in USDC's smallest unit (6dp). This is the money number. */
  usdcUnits: string;
  /**
   * True when the two views describe the same balance, as they must.
   *
   * A mismatch means the configured `XORV_STABLECOIN` is some other token that
   * merely happens to live on this chain, and every balance shown to a user is
   * about to be wrong.
   */
  viewsAgree: boolean;
}

/** Both views of an address's balance. */
export async function fetchBalances(network: string, address: string): Promise<AccountBalances> {
  const client = readClient(network);
  const account = getAddress(address);
  const [nativeWei, usdcUnits] = await Promise.all([
    client.getBalance({ address: account }),
    client.readContract({
      address: getAddress(usdcAddress(network)),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account],
    }),
  ]);
  return {
    nativeWei: nativeWei.toString(),
    usdcUnits: usdcUnits.toString(),
    viewsAgree: nativeWei / 10n ** 12n === usdcUnits,
  };
}

/** USDC balance of an address, in smallest units, as a string. */
export async function usdcBalance(network: string, address: string): Promise<string> {
  const client = readClient(network);
  const units = await client.readContract({
    address: getAddress(usdcAddress(network)),
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [getAddress(address)],
  });
  return units.toString();
}

/**
 * The EIP-712 domain the USDC contract actually declares.
 *
 * Read, never assumed. A FiatTokenV2's domain is
 * `(name, version, chainId, verifyingContract)`, and guessing `version` wrong —
 * "1" instead of "2" is the classic — produces a buyer signature that is
 * perfectly valid over a domain no verifier will ever reconstruct. The failure
 * surfaces as an opaque "invalid signature" with nothing to grep for, so the
 * two strings are fetched from the chain that will be doing the verifying.
 */
export async function usdcDomain(network: string): Promise<{ name: string; version: string }> {
  const client = readClient(network);
  const address = getAddress(usdcAddress(network));
  const [name, version] = await Promise.all([
    client.readContract({ address, abi: erc20Abi, functionName: "name" }),
    client.readContract({
      address,
      abi: [
        {
          name: "version",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "string" }],
        },
      ] as const,
      functionName: "version",
    }),
  ]);
  return { name: name as string, version: version as string };
}

/** Cheap shape check so a typo'd address fails at config time, not on-chain. */
export function isAccountAddress(value: string): boolean {
  return viemIsAddress(value.trim(), { strict: false });
}

/** Checksummed form, or null when the input isn't an address at all. */
export function normalizeAddress(value: string): Address | null {
  const trimmed = value.trim();
  return viemIsAddress(trimmed, { strict: false }) ? getAddress(trimmed) : null;
}

/** `0x1234…abcd` — addresses are unreadable at full length in a table. */
export function shortAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 12 ? `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}` : trimmed;
}
