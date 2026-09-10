/**
 * Kazuo's x402 wiring.
 *
 * Two things live here that the broker and the CLI both need:
 *
 *  1. `buildFacilitator` — Kazuo runs its **own** facilitator in-process instead
 *     of calling out to a hosted one. That matters beyond independence: the
 *     facilitator is the party that broadcasts, so running it ourselves is what
 *     lets a job poster hold nothing but USDC and still transact. They sign an
 *     authorization; Kazuo submits it and pays the fee.
 *
 *  2. `paymentOptionsFor` — the `accepts` array a 402 offers.
 *
 * ## What changed from the Hedera version, and what didn't
 *
 * The mechanism is completely different and the guarantee is identical.
 *
 * On Hedera the buyer built a native protobuf `TransferTransaction`, signed it,
 * and handed over a *partially signed transaction* for the facilitator to
 * counter-sign as fee payer. On Arc the buyer signs an **EIP-3009
 * authorization** — an EIP-712 typed-data message, not a transaction — and the
 * facilitator calls `transferWithAuthorization` on the USDC contract with it.
 * The buyer's bytes are never a transaction and never touch the mempool.
 *
 * Both end in the same place: the buyer needs no gas token, and the money moves
 * buyer → provider directly with no escrow in between.
 *
 * The consequence for this file is that there is **no Kazuo-specific scheme
 * code**. Hedera needed a bespoke signer that built a fresh SDK client per
 * settlement, because submitting a transaction frozen by someone else's client
 * corrupted the submitting client's internal state and every payment after the
 * first came back as a bare 402. Arc needs `registerExactEvmScheme` and a viem
 * client. The stock scheme settles as-is.
 */

import type { FacilitatorClient } from "@x402/core/server";
import type { PaymentOption } from "@x402/core/http";
import type { Network, PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { x402Facilitator } from "@x402/core/facilitator";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { getAddress, type PublicClient, type WalletClient } from "viem";
import { QUOTE_TTL_SECONDS, KAZUO_SCHEME, usdcAddress } from "./constants.js";
import { readClient, writeClient } from "./chain.js";
import { usdMicrosToUsdcUnits } from "./money.js";

/**
 * A hosted x402 facilitator, kept as a named fallback so switching is a
 * one-word config change. There is no public Arc facilitator today, which is
 * part of why Kazuo runs its own.
 */
export const PUBLIC_FACILITATOR_URL = "https://x402.org/facilitator";

/**
 * Compose the signer the EVM scheme wants.
 *
 * Built by hand rather than spread from the viem clients because the surface
 * spans both of them — reads and a typed-data check come from the public
 * client, writes from the wallet — and `writeContract`/`sendTransaction` must
 * stay bound to the client that actually holds the account. Spreading two viem
 * clients into one object happens to work today and breaks silently the moment
 * either changes how its actions are attached.
 */
export function facilitatorSigner(opts: {
  address: string;
  wallet: WalletClient;
  public: PublicClient;
}) {
  return toFacilitatorEvmSigner({
    address: getAddress(opts.address),
    readContract: (args) => opts.public.readContract(args as never) as Promise<unknown>,
    verifyTypedData: (args) => opts.public.verifyTypedData(args as never),
    getCode: (args) => opts.public.getCode(args as never),
    waitForTransactionReceipt: (args) =>
      opts.public.waitForTransactionReceipt(args as never) as never,
    writeContract: (args) => opts.wallet.writeContract(args as never),
    sendTransaction: (args) => opts.wallet.sendTransaction(args as never),
  });
}

/**
 * An in-process facilitator backed by our own Arc account.
 *
 * `x402Facilitator` implements the same `FacilitatorClient` surface the HTTP
 * client does, so the resource server cannot tell the difference — which is the
 * point: self-hosted and hosted are a config flag, not two code paths.
 */
export function buildLocalFacilitator(opts: {
  network: string;
  feePayerAddress: string;
  feePayerKey: string;
}): FacilitatorClient {
  const publicClient = readClient(opts.network);
  const wallet = writeClient(opts.network, opts.feePayerKey);

  const facilitator = new x402Facilitator();
  registerExactEvmScheme(facilitator, {
    signer: facilitatorSigner({
      address: opts.feePayerAddress,
      wallet,
      public: publicClient,
    }),
    // Not optional, and it fails confusingly when omitted: scheme routing is
    // derived from this set, and the `eip155:*` wildcard is only synthesised
    // when two or more networks share a namespace. With it missing, verify()
    // throws from inside a regex helper rather than saying what is unconfigured.
    networks: [opts.network as Network],
  });

  // Adapt x402Facilitator to the FacilitatorClient shape the resource server
  // expects. Everything is local, so there is no network hop and no retry.
  return {
    async verify(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
      const result = await facilitator.verify(paymentPayload, paymentRequirements);
      // A rejected payment is the hardest failure in this system to diagnose
      // from the outside — the caller sees a bare 402 and the reason lives only
      // here. Log it once, at the point of decision.
      if (!result.isValid) {
        console.error(
          `[x402] payment rejected: ${result.invalidReason ?? "unknown"}` +
            `${result.invalidMessage ? ` — ${result.invalidMessage}` : ""}` +
            ` (payer=${result.payer ?? "?"}, asset=${paymentRequirements.asset},` +
            ` amount=${paymentRequirements.amount}, payTo=${paymentRequirements.payTo})`,
        );
      }
      return result;
    },
    async settle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
      const result = await facilitator.settle(paymentPayload, paymentRequirements);
      if (!result.success) {
        console.error(
          `[x402] settlement failed: ${result.errorReason ?? "unknown"}` +
            `${result.errorMessage ? ` — ${result.errorMessage}` : ""}`,
        );
      }
      return result;
    },
    async getSupported() {
      return facilitator.getSupported();
    },
  } as unknown as FacilitatorClient;
}

/** A facilitator that talks HTTP to a hosted one. */
export function buildHostedFacilitator(url: string): FacilitatorClient {
  return new HTTPFacilitatorClient({ url });
}

/**
 * Pick a facilitator from config.
 *
 * `self` (the default) runs one in-process; anything else is treated as the URL
 * of a hosted facilitator, with `hosted` as shorthand for the public one.
 */
export function buildFacilitator(opts: {
  mode: string;
  network: string;
  feePayerAddress: string;
  feePayerKey: string;
}): { facilitator: FacilitatorClient; description: string; feePayer: string } {
  const mode = (opts.mode || "self").trim();
  if (mode === "self") {
    return {
      facilitator: buildLocalFacilitator(opts),
      description: "self-hosted (in-process)",
      feePayer: opts.feePayerAddress,
    };
  }
  const url = mode === "hosted" ? PUBLIC_FACILITATOR_URL : mode;
  return {
    facilitator: buildHostedFacilitator(url),
    description: `hosted (${url})`,
    feePayer: "facilitator-managed",
  };
}

/**
 * The `accepts` array for a priced resource.
 *
 * One option, where Hedera offered two. There is no second asset on Arc to
 * offer — USDC is both the money and the gas — so the "pay in USDC or pay in
 * HBAR, your choice" branch, along with the live exchange rate it depended on,
 * has no counterpart here.
 *
 * `payTo` is a resolver rather than a fixed string because Kazuo pays the
 * matched **provider** directly — the broker never takes custody of a job's
 * money, it only introduces the two parties and witnesses the result.
 *
 * `extra` carries the token's EIP-712 domain, which the caller must have read
 * from the contract. It is not optional and it is not guessable: an EIP-3009
 * signature is made over `(name, version, chainId, verifyingContract)`, and a
 * wrong `version` yields a signature that verifies against nothing, reported as
 * an opaque failure with no field to point at.
 */
export function paymentOptionsFor(opts: {
  network: string;
  priceUsdMicros: number;
  payTo: PaymentOption["payTo"];
  domain: { name: string; version: string };
  maxTimeoutSeconds?: number;
}): PaymentOption[] {
  return [
    {
      scheme: KAZUO_SCHEME,
      network: opts.network as Network,
      payTo: opts.payTo,
      price: {
        asset: usdcAddress(opts.network),
        amount: usdMicrosToUsdcUnits(opts.priceUsdMicros),
      },
      maxTimeoutSeconds: opts.maxTimeoutSeconds ?? QUOTE_TTL_SECONDS,
      extra: { name: opts.domain.name, version: opts.domain.version },
    } as PaymentOption,
  ];
}

/**
 * Which asset a settled payment used, for display and receipts.
 *
 * Always USDC on Arc. Kept as a function so receipt-rendering code is identical
 * across both chains and a future second asset is a change here, not everywhere.
 */
export function assetKind(_assetId: string): "usdc" {
  return "usdc";
}
