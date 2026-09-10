/**
 * Network-level constants shared by the CLI, the broker and both frontends.
 *
 * Anything here is protocol surface: change a value and every participant has
 * to agree on the change, so they live in one place rather than being retyped
 * per package.
 *
 * ## Arc in one paragraph
 *
 * Arc is a Circle L1 where **USDC is the native gas token**. That single fact
 * decides most of this file. There is no second asset to quote a price in, no
 * exchange rate to fetch, and no "buy the gas token first" step — the thing you
 * are paid in is the thing fees are charged in. USDC appears twice on the
 * chain: as the native balance the EVM meters gas against (18 decimals, because
 * that is what an EVM assumes of its gas token) and as a Circle FiatTokenV2
 * ERC-20 at a fixed address (6 decimals, because that is what USDC is). They
 * are one balance under two views. x402 settles through the ERC-20 face, so
 * **every amount in this codebase is 6 decimals**.
 */

/** CAIP-2 for Arc testnet — chain id 5042002. */
export const ARC_TESTNET_CAIP2 = "eip155:5042002";

/** CAIP-2 for Arc mainnet — chain id 5042. */
export const ARC_MAINNET_CAIP2 = "eip155:5042";

/** EVM chain ids, for wallet `switchChain` and RPC checks. */
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_MAINNET_CHAIN_ID = 5042;

/**
 * The ERC-20 face of native USDC — a real Circle FiatTokenV2 at a fixed
 * address, identical on both Arc networks.
 *
 * Being a genuine FiatTokenV2 is what makes the whole design work: it
 * implements EIP-3009 `transferWithAuthorization`, so a buyer signs an
 * authorization offline and a facilitator relays it. That is the Arc equivalent
 * of Hedera's fee-payer model, reached by a completely different mechanism, and
 * it is why the stock x402 `exact` scheme needs no Xorv-specific code.
 */
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

/** USDC's ERC-20 decimals. The native/gas view of the same balance is 18. */
export const USDC_DECIMALS = 6;

/**
 * Decimals the EVM meters the native balance in.
 *
 * Only ever needed to convert *between* the two views of one balance. Anything
 * denominated as money in this codebase uses `USDC_DECIMALS`; reaching for this
 * constant in a payment path is almost always a 10^12 bug in the making.
 */
export const NATIVE_DECIMALS = 18;

/** Public RPC per CAIP-2 network. */
export function rpcUrl(network: string): string {
  const override = process.env.XORV_RPC_URL?.trim();
  if (override) return override;
  return network === ARC_MAINNET_CAIP2
    ? "https://rpc.arc.network"
    : "https://rpc.testnet.arc.network";
}

/** The x402 protocol version Xorv speaks. */
export const X402_VERSION = 2;

/** The only payment scheme Xorv uses; `exact` means "pay exactly this amount". */
export const XORV_SCHEME = "exact";

/**
 * How often a provider node reports in.
 *
 * Chosen against the offline threshold below: three missed beats before a
 * provider drops out of matching, which tolerates one slow network round-trip
 * without parking a job on a node that has actually gone away.
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** A provider with no heartbeat inside this window stops being matchable. */
export const HEARTBEAT_OFFLINE_MS = 45_000;

/** Providers idle this long are dropped from the registry entirely. */
export const PROVIDER_REAP_MS = 10 * 60_000;

/**
 * How long a quoted price is honoured.
 *
 * A 402 quote pins a specific provider and a specific price. Too short and a
 * human filling in a form times out mid-payment; too long and the network holds
 * capacity for someone who wandered off. Five minutes is the x402
 * `maxTimeoutSeconds` we advertise, so client and server agree on the window.
 */
export const QUOTE_TTL_SECONDS = 300;

/** Ceiling on how long a single job may run on a provider before it's failed. */
export const JOB_TIMEOUT_MS = 10 * 60_000;

/** Wire version for audit-log envelopes, so consumers can evolve the shape. */
export const LOG_SCHEMA_VERSION = 1;

/**
 * The `kind` discriminator on a `XorvLog` entry.
 *
 * Mirrors the contract's `KIND_` constants exactly. They are indexed on the
 * event, so a reader pulls one stream — say, every receipt — without scanning
 * the rest, which is what the three separate Hedera topics used to give us.
 */
export const LOG_KIND = {
  registration: 1,
  heartbeat: 2,
  receipt: 3,
} as const;

/**
 * The stablecoin this network prices in.
 *
 * Overridable with `XORV_STABLECOIN`. A marketplace that hardcodes one token
 * address can never be pointed at a different issuer or a test token, and the
 * override is what lets the settlement path be exercised without a faucet.
 *
 * Read per call rather than captured at module load, so a test can set it
 * without re-importing the module.
 */
export function usdcAddress(network: string): string {
  const override = process.env.XORV_STABLECOIN?.trim();
  if (override && /^0x[0-9a-fA-F]{40}$/.test(override)) return override;
  void network; // same address on both Arc networks; kept for signature parity
  return ARC_USDC_ADDRESS;
}

/** The deployed `XorvLog` address, or null when the audit trail is unconfigured. */
export function logAddress(): string | null {
  const raw = process.env.XORV_LOG_ADDRESS?.trim();
  return raw && /^0x[0-9a-fA-F]{40}$/.test(raw) ? raw : null;
}

/** Human label for a network, for CLI and UI chrome. */
export function networkLabel(network: string): string {
  return network === ARC_MAINNET_CAIP2 ? "mainnet" : "testnet";
}

/** EVM chain id for a CAIP-2 network. */
export function chainIdFor(network: string): number {
  const parsed = Number(network.split(":")[1]);
  return Number.isFinite(parsed) ? parsed : ARC_TESTNET_CHAIN_ID;
}

/** ArcScan base URL for a network. */
export function explorerBase(network: string): string {
  return network === ARC_MAINNET_CAIP2 ? "https://arcscan.app" : "https://testnet.arcscan.app";
}

/** ArcScan link for a transaction hash. */
export function explorerTx(network: string, txHash: string): string {
  return `${explorerBase(network)}/tx/${txHash}`;
}

/** ArcScan link for an address — an account or a contract. */
export function explorerAddress(network: string, address: string): string {
  return `${explorerBase(network)}/address/${address}`;
}

/** ArcScan link for a token. */
export function explorerToken(network: string, address: string): string {
  return `${explorerBase(network)}/token/${address}`;
}
