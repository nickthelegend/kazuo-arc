"use client";

/**
 * Paying a quote from the browser, with the user's own wallet.
 *
 * The x402 round trip happens *here*, in the tab: the broker answers 402 with
 * terms, the wallet signs an EIP-3009 authorization over them, and the signed
 * authorization goes back on the retry. The server never sees a key and never
 * signs anything.
 *
 * `/api/pay` still exists and still works — it is the fallback for a visitor
 * with no wallet, using a demo account the deployment holds. The two differ in
 * exactly one way that matters: with a wallet, the money is the user's and they
 * approved it; without one, it is the demo's.
 *
 * ## The user pays no gas, and that is not a figure of speech
 *
 * What the wallet signs is **typed data, not a transaction**. It is never
 * broadcast, it never enters a mempool, and the signer needs no balance beyond
 * the USDC being spent. The facilitator takes that signature to
 * `transferWithAuthorization` and pays the fee itself. A visitor can arrive
 * holding nothing but a stablecoin and complete a purchase, which on most
 * chains is precisely where a normal person's crypto payment dies.
 *
 * Loaded lazily. `@x402/*` is a large graph and none of it belongs in the first
 * paint of a page whose job is a text box.
 */

import type { WalletSession } from "@/lib/wallet";

export interface WalletPaymentResult {
  jobId: string;
  /** Present when the facilitator reported one on the response header. */
  transaction: string | null;
}

/**
 * Run the paid request for `quoteId`, signing with the connected wallet.
 *
 * @throws with the facilitator's own reason when the payment is refused — the
 * useful text lives in the `payment-required` header rather than the body, so
 * a bare "402" is never what the caller sees.
 */
export async function payQuoteWithWallet(
  session: WalletSession,
  brokerUrl: string,
  quoteId: string,
): Promise<WalletPaymentResult> {
  const [{ x402Client, x402HTTPClient }, { wrapFetchWithPayment }, { registerExactEvmScheme }] =
    await Promise.all([
      import("@x402/core/client"),
      import("@x402/fetch"),
      import("@x402/evm/exact/client"),
    ]);

  const client = new x402Client();
  registerExactEvmScheme(client, {
    // The wallet session satisfies `ClientEvmSigner` as it stands: an address
    // and `signTypedData`. No adapter, no second SDK, no protobuf — this is
    // the whole reason an ordinary EVM wallet can pay here and could not on
    // Hedera, where the scheme needed a signature over a native transaction.
    signer: { address: session.address, signTypedData: session.signTypedData },
    // The `eip155:*` wildcard, so the browser can pay whatever the broker
    // quotes rather than only a network baked in at build time. The EIP-712
    // domain binds each signature to one chain id, so widening this cannot let
    // an authorization be replayed elsewhere.
  });

  // No asset-preference policy. Hedera offered USDC or HBAR and this had to
  // narrow the list without ever emptying it; Arc has one asset.

  const paidFetch = wrapFetchWithPayment(fetch, client);
  const httpClient = new x402HTTPClient(client);

  const res = await paidFetch(`${brokerUrl}/api/jobs/${quoteId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const body = (await res.json()) as { jobId?: string; error?: string };
  if (!res.ok || !body.jobId) {
    throw new Error(decodeRefusal(res) ?? body.error ?? `Payment failed (${res.status}).`);
  }

  let transaction: string | null = null;
  try {
    const settled = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    transaction = settled?.transaction ?? null;
  } catch {
    /* the receipt is a nicety; a settled job without it is still settled */
  }

  return { jobId: body.jobId, transaction };
}

/** The refusal reason the resource server puts on the header, not the body. */
function decodeRefusal(res: Response): string | null {
  const header = res.headers.get("payment-required") ?? res.headers.get("Payment-Required");
  if (!header) return null;
  try {
    const decoded = JSON.parse(atob(header)) as { error?: string; errorReason?: string };
    return decoded.error ?? decoded.errorReason ?? null;
  } catch {
    return null;
  }
}
