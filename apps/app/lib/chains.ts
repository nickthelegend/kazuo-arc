import { defineChain } from "viem";

/**
 * Arc, as viem and the wallet see it.
 *
 * One thing about this chain routinely surprises people, and it is the same
 * thing everywhere in this codebase:
 *
 * **USDC is the native gas token, and it appears at two precisions.** The
 * `nativeCurrency.decimals: 18` below is not a mistake and does not contradict
 * USDC's 6. An EVM meters gas at 18 decimals, so that is what the native
 * balance is denominated in; the ERC-20 face of *the same balance* reports 6,
 * and that is what money is denominated in. A wallet showing "16.997 USDC" and
 * `balanceOf` returning `16997575` are the same figure viewed twice.
 *
 * Every payment amount in this application is the 6-decimal view.
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const arcMainnet = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://arcscan.app" },
  },
});

/**
 * World Chain Sepolia — the second settlement network, and where World
 * AgentKit's AgentBook is resolved from (its mainnet twin, chain 480).
 *
 * Offered to Privy as a supported chain so an embedded wallet can hold USDC
 * there too. Unlike Arc, gas on World Chain is ETH, not USDC.
 */
export const worldchainSepolia = defineChain({
  id: 4801,
  name: "World Chain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://worldchain-sepolia.g.alchemy.com/public"] },
  },
  blockExplorers: {
    default: { name: "WorldScan", url: "https://sepolia.worldscan.org" },
  },
  testnet: true,
});

export const ARC_CHAIN =
  process.env.NEXT_PUBLIC_KAZUO_NETWORK === "eip155:5042" ? arcMainnet : arcTestnet;

/** The ERC-20 face of native USDC — a Circle FiatTokenV2, same on both networks. */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

/** CAIP-2 for the chain above, which is how x402 names networks. */
export const KAZUO_NETWORK = `eip155:${ARC_CHAIN.id}`;

/** ArcScan link for a transaction hash. */
export function explorerTx(hash: string): string {
  return `${ARC_CHAIN.blockExplorers.default.url}/tx/${hash}`;
}

/** ArcScan link for an address or contract. */
export function explorerAddress(address: string): string {
  return `${ARC_CHAIN.blockExplorers.default.url}/address/${address}`;
}
