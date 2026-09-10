/**
 * M1 — prove a real x402 payment settles on Arc testnet.
 *
 * Deliberately standalone. It imports nothing from `@xorv/*`, so it can be run
 * and trusted before a single line of the port exists, and it stays afterwards
 * as the reference the protocol layer is written against.
 *
 * ## What it is proving
 *
 * The thing the whole migration rests on: **Arc's USDC has two faces on one
 * balance.** `eth_getBalance` reports 18 decimals and is the gas view;
 * `balanceOf()` reports 6 and is the ERC-20 view. They are the same asset.
 * Because a real Circle FiatTokenV2 sits behind the second one, EIP-3009
 * `transferWithAuthorization` works — so the buyer signs an authorization
 * offline, broadcasts nothing, holds no gas, and the facilitator relays it and
 * pays the fee.
 *
 * That is the same property Hedera's fee-payer model gave us, reached by a
 * completely different mechanism, and it means **no custom x402 scheme is
 * needed** — the stock `@x402/evm` exact scheme settles as-is.
 *
 * It also means payment amounts stay at **6 decimals**, exactly as on Hedera.
 * "Migrating 6dp to 18dp" would introduce a 10^12 error, not fix one.
 *
 * Run:
 *   pnpm dlx tsx scripts/m1-settle.mts
 */

import { createPublicClient, createWalletClient, http, erc20Abi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { x402Client } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactEvmScheme as registerFacilitatorScheme } from "@x402/evm/exact/facilitator";
import { toClientEvmSigner, toFacilitatorEvmSigner } from "@x402/evm";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
) as Record<string, string>;

/** Circle FiatTokenV2 — the ERC-20 face of Arc's native USDC. */
const USDC = env.XORV_USDC_ADDRESS as `0x${string}`;
const NETWORK = "eip155:5042002";
/** 1000 units = $0.001 at 6 decimals. Small on purpose: this runs for real. */
const AMOUNT = "1000";

const payer = privateKeyToAccount(env.XORV_DEMO_PAYER_KEY as `0x${string}`);
const facilitatorAccount = privateKeyToAccount(env.XORV_OPERATOR_KEY as `0x${string}`);
const provider = env.XORV_DEMO_PROVIDER_ADDRESS as `0x${string}`;

const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
const facilitatorWallet = createWalletClient({
  account: facilitatorAccount,
  chain: arcTestnet,
  transport: http(),
});

const step = (n: string, s: string) => console.log(`\n${n}  ${s}`);
const line = (k: string, v: unknown) => console.log(`     ${k.padEnd(22)} ${v}`);

async function balances(label: string) {
  const [erc20, native] = await Promise.all([
    publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [payer.address],
    }),
    publicClient.getBalance({ address: payer.address }),
  ]);
  const providerErc20 = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [provider],
  });
  console.log(
    `     ${label.padEnd(22)} payer ${formatUnits(erc20, 6)} USDC (erc20)  |  ` +
      `${formatUnits(native, 18)} (native/gas)  |  provider ${formatUnits(providerErc20, 6)}`,
  );
  return { payerErc20: erc20, payerNative: native, providerErc20 };
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("\n  M1 — settle a real x402 payment on Arc testnet\n" + "  ".padEnd(60, "─"));
  line("chain", `${arcTestnet.name} (${arcTestnet.id})`);
  line("rpc", arcTestnet.rpcUrls.default.http[0]);
  line("usdc (erc20 face)", USDC);
  line("payer", payer.address);
  line("provider (payTo)", provider);
  line("facilitator", facilitatorAccount.address);

  step("1.", "the two faces of one balance");
  const before = await balances("before");
  const impliedFromNative = before.payerNative / 10n ** 12n;
  line("native / 1e12", impliedFromNative);
  line("balanceOf()", before.payerErc20);
  line(
    "same asset?",
    impliedFromNative === before.payerErc20 ? "yes — one balance, two views" : "MISMATCH",
  );

  if (before.payerErc20 < BigInt(AMOUNT)) {
    console.error(
      `\n  ✖ payer holds ${before.payerErc20} units, needs ${AMOUNT}.` +
        `\n    Claim Arc testnet USDC at https://faucet.circle.com for ${payer.address}\n`,
    );
    process.exit(1);
  }

  step("2.", "buyer signs an EIP-3009 authorization — broadcasts nothing");
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: toClientEvmSigner(payer, publicClient),
    networks: [NETWORK],
  });

  // The EIP-712 domain is read from the token, not assumed. A FiatTokenV2's
  // domain is (name, version, chainId, verifyingContract); get `version` wrong
  // — "1" instead of "2" is the classic — and the buyer produces a perfectly
  // valid signature over a domain no verifier will ever reconstruct, which
  // surfaces as an opaque "invalid signature" with nothing to grep for.
  const [tokenName, tokenVersion] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "name" }),
    publicClient.readContract({
      address: USDC,
      abi: [{ name: "version", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }],
      functionName: "version",
    }),
  ]);
  line("eip-712 domain", `name="${tokenName}" version="${tokenVersion}"`);

  const requirements = {
    scheme: "exact" as const,
    network: NETWORK as never,
    amount: AMOUNT,
    asset: USDC,
    payTo: provider,
    maxTimeoutSeconds: 300,
    extra: { name: tokenName as string, version: tokenVersion as string },
  };

  // `createPaymentPayload` takes the whole 402 body, not a bare requirement:
  // it selects from `accepts` using the schemes the client has registered.
  const payload = await client.createPaymentPayload({
    x402Version: 2,
    resource: { url: "https://xorv.dev/m1", method: "POST" } as never,
    accepts: [requirements],
  });
  line("scheme", requirements.scheme);
  line("payload keys", Object.keys(payload.payload ?? {}).join(", "));
  line("payer broadcast?", "no — offline signature only");

  step("3.", "facilitator verifies, then relays and pays the gas");
  const facilitator = new x402Facilitator();
  registerFacilitatorScheme(facilitator, {
    // Composed by hand rather than spread from the viem clients: the signer
    // needs reads, a typed-data check, and writes, which live on two different
    // clients, and `writeContract`/`sendTransaction` must stay bound to the
    // wallet that holds the account.
    signer: toFacilitatorEvmSigner({
      address: facilitatorAccount.address,
      readContract: (args) => publicClient.readContract(args as never) as Promise<unknown>,
      verifyTypedData: (args) => publicClient.verifyTypedData(args as never),
      getCode: (args) => publicClient.getCode(args as never),
      waitForTransactionReceipt: (args) =>
        publicClient.waitForTransactionReceipt(args as never) as never,
      writeContract: (args) => facilitatorWallet.writeContract(args as never),
      sendTransaction: (args) => facilitatorWallet.sendTransaction(args as never),
    }),
    // Not optional, and it fails confusingly if omitted: routing derives from
    // this set, and a wildcard is only produced when 2+ networks share a
    // namespace. Without it verify() throws inside escapeRegExp.
    networks: [NETWORK as never],
  });

  const verified = await facilitator.verify(payload as never, requirements as never);
  line("verify", JSON.stringify(verified));
  if (!(verified as { isValid?: boolean }).isValid) {
    console.error("\n  ✖ verification failed — not broadcasting.\n");
    process.exit(1);
  }

  const settled = await facilitator.settle(payload as never, requirements as never);
  line("settle", JSON.stringify(settled));

  const txHash = (settled as { transaction?: string }).transaction;
  step("4.", "confirm on chain");
  const after = await balances("after");
  const moved = after.providerErc20 - before.providerErc20;
  const spent = before.payerErc20 - after.payerErc20;

  // Measuring the buyer's gas needs care, and getting it wrong is the whole
  // 10^12 trap in one line. The native balance is not a *separate* gas balance
  // that a fee would come out of — it is the SAME balance, viewed at 18
  // decimals. So paying 1000 units drops the native view by 1000 * 10^12 all on
  // its own. Naively differencing native before/after therefore measures
  // "payment + gas" and reports a healthy-looking non-zero number for a buyer
  // who paid no gas at all.
  //
  // The real claim is that the native drop is *exactly* the payment and not one
  // wei more. That surplus is the buyer's gas, and it must be zero.
  const nativeDrop = before.payerNative - after.payerNative;
  const paymentInNative = spent * 10n ** 12n;
  const gasPaidByPayer = nativeDrop - paymentInNative;

  line("provider received", `${moved} units (expected ${AMOUNT})`);
  line("payer spent", `${spent} units`);
  line("native drop", `${nativeDrop} wei = payment ${paymentInNative} + gas ${gasPaidByPayer}`);
  line("payer paid in gas", `${gasPaidByPayer} wei — must be 0`);
  if (txHash) line("arcscan", `https://testnet.arcscan.app/tx/${txHash}`);

  const ok = moved === BigInt(AMOUNT) && spent === BigInt(AMOUNT) && gasPaidByPayer === 0n;
  console.log("\n  " + (ok ? "✔ M1 PASSED" : "✖ M1 FAILED") + " — a buyer holding only USDC paid, and never sent a transaction.\n");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("\n  ✖", err?.shortMessage ?? err?.message ?? err);
  if (err?.cause?.message) console.error("    cause:", err.cause.message);
  process.exit(1);
});
