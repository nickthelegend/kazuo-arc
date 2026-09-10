/**
 * Move native USDC between the demo accounts on Arc testnet.
 *
 * Only the facilitator ever needs this. On Arc, USDC *is* the gas token, so the
 * one account that must hold a native balance is the one that broadcasts:
 * the facilitator, which relays the buyer's signed authorization and pays the
 * fee. The buyer and provider never send a transaction, which is the whole
 * point — they can hold nothing but the ERC-20 face and still transact.
 *
 * Faucets only fund one address at a time, so this exists to spread a single
 * claim across the three roles.
 *
 *   pnpm dlx tsx scripts/fund.mts <to-address> <amount-in-usdc>
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

const [to, amount] = process.argv.slice(2);
if (!to || !amount) {
  console.error("usage: tsx scripts/fund.mts <to-address> <amount-in-usdc>");
  process.exit(1);
}

const from = privateKeyToAccount(env.KAZUO_DEMO_PAYER_KEY as `0x${string}`);
const transport = http(env.KAZUO_RPC_URL);
const publicClient = createPublicClient({ chain: arcTestnet, transport });
const wallet = createWalletClient({ account: from, chain: arcTestnet, transport });

// parseEther, not parseUnits(…, 6): this is the *native* face of the balance,
// which the EVM reports and spends at 18 decimals. The ERC-20 face of the same
// balance is 6. Mixing the two is a 10^12 error in either direction.
const value = parseEther(amount);

console.log(`  ${from.address}\n→ ${to}\n  ${amount} USDC (${value} wei)`);
const hash = await wallet.sendTransaction({ to: to as `0x${string}`, value });
console.log("  tx", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("  status", receipt.status, "· block", receipt.blockNumber);
console.log("  recipient now holds", formatEther(await publicClient.getBalance({ address: to as `0x${string}` })), "USDC");
console.log(`  ${env.KAZUO_EXPLORER}/tx/${hash}`);
