/**
 * The `accepts` array is the contract between buyer and network: get an amount
 * or an asset wrong here and a correctly-signed payment is rejected, or worse,
 * the wrong amount moves.
 */

import { describe, expect, it } from "vitest";
import { assetKind, paymentOptionsFor } from "../src/x402.js";
import { ARC_TESTNET_CAIP2, ARC_USDC_ADDRESS } from "../src/constants.js";
import { sha256, newId, formatDuration, formatAgo } from "../src/index.js";
import { envelope } from "../src/log.js";

const PROVIDER = "0xff212ecb82E3b06c0a2A7a9Ce343e0a1868c489B";
const DOMAIN = { name: "USDC", version: "2" };

describe("paymentOptionsFor", () => {
  it("offers exactly one option, because Arc has one asset", () => {
    // Hedera offered two — USDC and HBAR — and needed a live exchange rate to
    // quote the second. On Arc the money and the gas are the same token, so
    // there is nothing else to offer and no rate that can go stale.
    const options = paymentOptionsFor({
      network: ARC_TESTNET_CAIP2,
      priceUsdMicros: 10_000,
      payTo: PROVIDER,
      domain: DOMAIN,
    });
    expect(options).toHaveLength(1);
    expect((options[0]!.price as { asset: string }).asset).toBe(ARC_USDC_ADDRESS);
  });

  it("quotes the amount in USDC's 6-decimal units, not the 18-decimal gas view", () => {
    // The single most consequential assertion in this file. $0.01 is 10000
    // units on the ERC-20 face. Quoting the native view would ask for
    // 10,000,000,000,000,000 units — a factor of 10^12 too much.
    const [option] = paymentOptionsFor({
      network: ARC_TESTNET_CAIP2,
      priceUsdMicros: 10_000,
      payTo: PROVIDER,
      domain: DOMAIN,
    });
    expect((option!.price as { amount: string }).amount).toBe("10000");
  });

  it("carries the EIP-712 domain the buyer must sign over", () => {
    // Not decorative: an EIP-3009 signature is made against
    // (name, version, chainId, verifyingContract). A missing or wrong version
    // yields a signature that verifies against nothing, reported as an opaque
    // failure with no field to point at.
    const [option] = paymentOptionsFor({
      network: ARC_TESTNET_CAIP2,
      priceUsdMicros: 1_000,
      payTo: PROVIDER,
      domain: { name: "USDC", version: "2" },
    });
    expect(option!.extra).toEqual({ name: "USDC", version: "2" });
  });

  it("pays the provider, never the broker", () => {
    const options = paymentOptionsFor({
      network: ARC_TESTNET_CAIP2,
      priceUsdMicros: 1_000,
      payTo: PROVIDER,
      domain: DOMAIN,
    });
    for (const option of options) expect(option.payTo).toBe(PROVIDER);
  });

  it("uses the exact scheme and the requested network on every row", () => {
    const options = paymentOptionsFor({
      network: ARC_TESTNET_CAIP2,
      priceUsdMicros: 1_000,
      payTo: PROVIDER,
      domain: DOMAIN,
    });
    for (const option of options) {
      expect(option.scheme).toBe("exact");
      expect(option.network).toBe(ARC_TESTNET_CAIP2);
      expect(option.maxTimeoutSeconds).toBeGreaterThan(0);
    }
  });
});

describe("assetKind", () => {
  it("reports USDC, the only asset on this chain", () => {
    expect(assetKind(ARC_USDC_ADDRESS)).toBe("usdc");
  });
});

describe("helpers", () => {
  it("hashes results deterministically, so receipts are comparable", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).not.toBe(sha256("hello "));
    expect(sha256("hello")).toHaveLength(64);
  });

  it("mints prefixed, URL-safe, non-colliding ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId("job")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^job_[A-Za-z0-9_-]+$/);
  });

  it("formats durations across the ms/s/m boundaries", () => {
    expect(formatDuration(820)).toBe("820ms");
    expect(formatDuration(4_200)).toBe("4.2s");
    expect(formatDuration(72_000)).toBe("1m 12s");
  });

  it("formats relative times", () => {
    const now = Date.now();
    expect(formatAgo(now, now)).toBe("just now");
    expect(formatAgo(now - 12_000, now)).toBe("12s ago");
    expect(formatAgo(now - 4 * 60_000, now)).toBe("4m ago");
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
});

describe("audit envelope size", () => {
  it("stays under the contract's 1024-byte cap for a real receipt", () => {
    // The cap is enforced on chain, so exceeding it is a revert that still
    // costs gas. An EVM address is longer than a Hedera account id and a tx
    // hash is longer than a transaction id, so the margin is genuinely smaller
    // here than it was — worth an assertion rather than an assumption.
    const wrapped = envelope("job.receipt", {
      jobId: "job_2eHjgDqDuMyv",
      providerId: "prv_1LanKLZA8vhK",
      providerAddress: "0xff212ecb82E3b06c0a2A7a9Ce343e0a1868c489B",
      payer: "0x03294Ce27e218d1611B2ebc0b0ffdDb95F129F36",
      asset: ARC_USDC_ADDRESS,
      amount: "10000",
      transactionHash: `0x${"a".repeat(64)}`,
      resultHash: "0".repeat(64),
      durationMs: 8_400,
      ok: true,
    });
    expect(Buffer.byteLength(JSON.stringify(wrapped), "utf8")).toBeLessThan(1024);
  });
});
