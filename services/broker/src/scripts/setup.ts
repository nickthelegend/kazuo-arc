/**
 * `pnpm setup` — get an Arc deployment from nothing to ready.
 *
 * Much less to do here than the Hedera version, and the difference is the
 * interesting part.
 *
 * On Hedera this script had to create three Consensus Service topics and two
 * funded accounts, and every generated account needed
 * `setMaxAutomaticTokenAssociations(-1)` or USDC could not land in it at all —
 * the single most common way a Hedera demo silently fails.
 *
 * On Arc an account is a keypair. It exists because you generated it; nothing
 * is created on chain, nothing is opted into, and any address can receive USDC
 * immediately. So this generates keys, reports what is configured, and checks
 * the things that can actually be wrong: whether the accounts are funded, and
 * whether the audit-log contract is really deployed where config says it is.
 *
 *   pnpm setup              # check what's configured
 *   pnpm setup --accounts   # also generate a provider and buyer keypair
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  explorerAddress,
  explorerToken,
  fetchBalances,
  formatUsdc,
  logDeployed,
  networkLabel,
  readClient,
  usdcAddress,
  usdcDomain,
} from "@kazuo/protocol";
import { loadConfig } from "../config.js";

const config = loadConfig();
const args = new Set(process.argv.slice(2));
const wantAccounts = args.has("--accounts");

function line(label: string, value: string): void {
  console.log(`  ${label.padEnd(22)} ${value}`);
}

async function reportBalance(label: string, address: string): Promise<void> {
  try {
    const b = await fetchBalances(config.network, address);
    line(label, `${address}  ${formatUsdc(b.usdcUnits)}${b.viewsAgree ? "" : "  ⚠ views disagree"}`);
  } catch (err) {
    line(label, `${address}  — could not read (${(err as Error).message})`);
  }
}

async function main(): Promise<void> {
  console.log("");
  console.log(`  ▁▂▃  KAZUO setup — ${config.network} (${networkLabel(config.network)})`);
  console.log("");

  const client = readClient(config.network);
  const chainId = await client.getChainId().catch(() => null);
  line("rpc", chainId ? `reachable, chain ${chainId}` : "UNREACHABLE");
  const usdc = usdcAddress(config.network);
  line("usdc", `${usdc}  ${explorerToken(config.network, usdc)}`);

  // Reading the domain proves two things at once: the RPC works, and the token
  // at that address really is a FiatTokenV2 rather than some other contract.
  // Without EIP-3009 on it, no payment in this system can ever settle.
  try {
    const domain = await usdcDomain(config.network);
    line("eip-712 domain", `name="${domain.name}" version="${domain.version}"`);
  } catch {
    line("eip-712 domain", "✖ could not read — is KAZUO_STABLECOIN a FiatTokenV2?");
  }

  console.log("");
  await reportBalance("operator", config.operatorAddress);
  console.log("");

  if (config.logAddress) {
    const deployed = await logDeployed(config.network, config.logAddress);
    line(
      "audit log",
      deployed
        ? `${config.logAddress}  ${explorerAddress(config.network, config.logAddress)}`
        : `${config.logAddress}  ✖ NO CONTRACT AT THIS ADDRESS`,
    );
  } else {
    line("audit log", "not configured — run `pnpm dlx tsx scripts/deploy-log.mts`");
  }

  if (wantAccounts) {
    console.log("");
    console.log("  generating demo keypairs…");
    console.log("");
    const env: Record<string, string> = {};
    for (const [name, prefix] of [
      ["provider (receives)", "KAZUO_DEMO_PROVIDER"],
      ["buyer (spends)", "KAZUO_DEMO_PAYER"],
    ] as const) {
      const key = generatePrivateKey();
      const account = privateKeyToAccount(key);
      line(name, account.address);
      env[`${prefix}_ADDRESS`] = account.address;
      env[`${prefix}_KEY`] = key;
    }
    console.log("");
    console.log("  paste into .env:");
    console.log("");
    for (const [key, value] of Object.entries(env)) console.log(`${key}=${value}`);
    console.log("");
    console.log("  Then fund the buyer at https://faucet.circle.com (Arc Testnet).");
    console.log("  The provider needs nothing — it only ever receives.");
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n  setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
