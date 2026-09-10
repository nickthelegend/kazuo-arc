/**
 * `pnpm usdc` — is everyone funded?
 *
 * Written because "I sent it" and "it arrived" are different facts, and the
 * only way to tell them apart is to ask the chain. Read-only: it never moves
 * funds and never edits a file.
 *
 * It prints **both views of each balance**, which looks redundant and is not.
 * On Arc the native/gas balance and the USDC ERC-20 balance are the same money
 * seen at 18 and 6 decimals, and watching them agree is the fastest way to
 * confirm you are pointed at real Arc USDC rather than some other ERC-20 that
 * happens to be deployed on the chain. When they disagree, every figure this
 * project shows a user is wrong, and it is worth finding that out here.
 *
 * Note which account needs what. The buyer needs USDC and **no gas** — that is
 * the entire premise: it signs an authorization and never broadcasts. Only the
 * facilitator needs a spendable balance, because only the facilitator sends
 * transactions.
 */

import {
  explorerAddress,
  explorerToken,
  fetchBalances,
  formatNative,
  formatUsdc,
  networkLabel,
  usdcAddress,
  usdcDomain,
} from "@kazuo/protocol";
import { loadConfig } from "../config.js";

const config = loadConfig();
const network = config.network;
const USDC = usdcAddress(network);

/** Every account the demo cares about, and what it actually needs. */
const ACCOUNTS: Array<{ address: string | undefined; label: string; needs: string }> = [
  {
    address: process.env.KAZUO_DEMO_PAYER_ADDRESS,
    label: "buyer",
    needs: "USDC to spend — needs no gas, it never broadcasts",
  },
  {
    address: process.env.KAZUO_DEMO_PROVIDER_ADDRESS,
    label: "provider",
    needs: "nothing — it only receives",
  },
  {
    address: config.operatorAddress,
    label: "facilitator",
    needs: "a spendable balance — it relays and pays every fee",
  },
];

async function main(): Promise<void> {
  console.log("");
  console.log(`  ▁▂▃  USDC on Arc ${networkLabel(network)}`);
  console.log("");
  console.log(`  token  ${USDC}  ${explorerToken(network, USDC)}`);

  try {
    const domain = await usdcDomain(network);
    console.log(`         name="${domain.name}" version="${domain.version}" (EIP-712 domain)`);
  } catch {
    console.log("         ✖ could not read the EIP-712 domain — payments cannot settle");
  }
  console.log("");

  let buyerUnits = 0n;
  let buyerAddress: string | null = null;

  for (const entry of ACCOUNTS) {
    if (!entry.address) {
      console.log(`  ${entry.label.padEnd(12)} not configured`);
      console.log("");
      continue;
    }

    console.log(`  ${entry.label.padEnd(12)} ${entry.address}`);
    try {
      const b = await fetchBalances(network, entry.address);
      if (entry.label === "buyer") {
        buyerUnits = BigInt(b.usdcUnits);
        buyerAddress = entry.address;
      }
      console.log(
        `    ${formatUsdc(b.usdcUnits).padStart(12)} (erc20, 6dp)` +
          `    ${formatNative(b.nativeWei).padStart(12)} (native, 18dp)`,
      );
      console.log(
        `    ${b.viewsAgree ? "one balance, two views ✔" : "⚠ VIEWS DISAGREE — this is not Arc's native USDC"}`,
      );
      console.log(`    needs: ${entry.needs}`);
      console.log(`    ${explorerAddress(network, entry.address)}`);
    } catch (err) {
      console.log(`    — could not read (${(err as Error).message})`);
    }
    console.log("");
  }

  if (buyerUnits > 0n) {
    console.log(`  ✔ the buyer holds ${formatUsdc(buyerUnits.toString())} — ready to pay.`);
  } else {
    console.log("  ✖ no USDC yet.");
    console.log("");
    console.log(`    Claim it for  ${buyerAddress ?? "the buyer address"}`);
    console.log("    at https://faucet.circle.com — pick Arc Testnet.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
