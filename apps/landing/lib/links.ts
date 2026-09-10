export const REPO_URL = "https://github.com/nickthelegend/kazuo-arc";
/** Public broker the live-stats strip reads. Optional: the page works without it. */
export const BROKER_URL = (
  process.env.NEXT_PUBLIC_KAZUO_BROKER_URL ?? "http://localhost:8402"
).replace(/\/+$/, "");
export const APP_URL = process.env.NEXT_PUBLIC_KAZUO_APP_URL ?? "http://localhost:3002";
export const LOOM_URL = "https://loompad.tech";
export const X402_URL = "https://x402.org";
/** Arc's own site. `circle.com/arc` looks right and answers 404. */
export const ARC_URL = "https://www.arc.io/";
export const CIRCLE_URL = "https://www.circle.com";
export const WORLD_AGENTKIT_URL = "https://docs.world.org/agents/agent-kit/integrate";
export const PRIVY_URL = "https://www.privy.io";
/** The CLI isn't on npm yet; this is the build-from-source guide. */
export const INSTALL_URL = `${REPO_URL}#quickstart`;

/**
 * The live testnet ids this site links to.
 *
 * Every number quoted on the page resolves to something a reader can open on
 * ArcScan. A marketing site for a payments network that can't show you the
 * payments is just a claim.
 */
const EXPLORER = "https://testnet.arcscan.app";

export const CHAIN = {
  network: "eip155:5042002",
  chainId: 5042002,
  /** Circle's FiatTokenV2 — the ERC-20 face of Arc's native USDC. */
  usdc: "0x3600000000000000000000000000000000000000",
  usdcUrl: `${EXPLORER}/token/0x3600000000000000000000000000000000000000`,
  /**
   * The audit log.
   *
   * Three Hedera Consensus Service topics collapsed into one contract with
   * three indexed event streams — Arc has no HCS, and event logs give the same
   * ordered, append-only, publicly-readable guarantee.
   */
  log: "0x383f5153db8bb18c7c25157fb3493645a465eef3",
  logUrl: `${EXPLORER}/address/0x383f5153db8bb18c7c25157fb3493645a465eef3`,
  txUrl: (hash: string) => `${EXPLORER}/tx/${hash}`,
  addressUrl: (address: string) => `${EXPLORER}/address/${address}`,
};

export const NAV = [
  { label: "How it works", href: "#how" },
  { label: "The network", href: "#bento" },
  { label: "Earn", href: "#earn" },
  { label: "Adapters", href: "#adapters" },
  { label: "Receipts", href: "#ledger" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];
