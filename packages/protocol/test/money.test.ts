/**
 * Money math is where a marketplace quietly loses people's earnings, so these
 * tests are about exactness rather than coverage: every conversion is checked
 * against a hand-computed integer, and the rounding direction is asserted
 * because "close enough" is a bug when it repeats a thousand times a day.
 */

import { describe, expect, it } from "vitest";
import {
  NATIVE_PER_USDC_UNIT,
  USD_MICROS,
  formatNative,
  formatUsd,
  formatUsdc,
  nativeWeiToUsdcUnits,
  parseUsd,
  usdMicrosToUsdcUnits,
  usdcUnitsToNativeWei,
  usdcUnitsToUsdMicros,
} from "../src/money.js";

describe("parseUsd", () => {
  it("parses plain numbers, strings and currency-formatted input identically", () => {
    expect(parseUsd(0.01)).toBe(10_000);
    expect(parseUsd("0.01")).toBe(10_000);
    expect(parseUsd("$0.01")).toBe(10_000);
    expect(parseUsd(" $1,000.00 ")).toBe(1_000 * USD_MICROS);
  });

  it("keeps sub-cent precision that a float would lose", () => {
    // 0.001 * 1e6 is 1000.0000000000001 in IEEE-754; the result must be integral.
    expect(parseUsd("0.001")).toBe(1_000);
    expect(Number.isInteger(parseUsd("0.001"))).toBe(true);
    expect(parseUsd("0.0001")).toBe(100);
  });

  it("rejects anything that isn't a non-negative number", () => {
    expect(() => parseUsd("abc")).toThrow(/invalid price/);
    expect(() => parseUsd(-1)).toThrow(/invalid price/);
    expect(() => parseUsd(Number.NaN)).toThrow(/invalid price/);
    expect(() => parseUsd(Number.POSITIVE_INFINITY)).toThrow(/invalid price/);
  });
});

describe("formatUsd", () => {
  it("shows four decimals for sub-dollar amounts so sub-cent prices don't read as free", () => {
    expect(formatUsd(1_000)).toBe("$0.0010");
    expect(formatUsd(10_000)).toBe("$0.0100");
    expect(formatUsd(100)).toBe("$0.0001");
  });

  it("shows two decimals at a dollar and above", () => {
    expect(formatUsd(1 * USD_MICROS)).toBe("$1.00");
    expect(formatUsd(1_234_567)).toBe("$1.23");
  });

  it("renders exact zero as $0 rather than $0.0000", () => {
    expect(formatUsd(0)).toBe("$0");
  });
});

describe("USDC conversion", () => {
  it("round-trips micro-USD through USDC's smallest unit without drift", () => {
    for (const micros of [1, 100, 1_000, 10_000, 999_999, 1_000_000, 123_456_789]) {
      expect(usdcUnitsToUsdMicros(usdMicrosToUsdcUnits(micros))).toBe(micros);
    }
  });

  it("returns integer strings, because x402 amounts are strings on the wire", () => {
    const units = usdMicrosToUsdcUnits(10_000);
    expect(units).toBe("10000");
    expect(units).toMatch(/^\d+$/);
  });

  it("formats USDC units back to a dollar string", () => {
    expect(formatUsdc("10000")).toBe("$0.0100");
  });
});

/**
 * The dual-face conversions are the single most dangerous arithmetic in this
 * codebase. USDC's ERC-20 view is 6 decimals and the EVM's native/gas view of
 * *the same balance* is 18, so every mistake here is off by a factor of a
 * trillion — large enough to be caught instantly in a test and small enough to
 * look plausible in a log line.
 */
describe("the two views of one balance", () => {
  it("scales by exactly 10^12, not 10^11 or 10^13", () => {
    expect(NATIVE_PER_USDC_UNIT).toBe(1_000_000_000_000n);
  });

  it("converts a payment amount into its native-view equivalent", () => {
    // $0.001 = 1000 units on the ERC-20 face = 1e15 wei on the native face.
    expect(usdcUnitsToNativeWei(1_000)).toBe(1_000_000_000_000_000n);
    expect(usdcUnitsToNativeWei("250000")).toBe(250_000_000_000_000_000n);
  });

  it("round-trips a whole number of units in both directions", () => {
    for (const units of [0n, 1n, 1_000n, 250_000n, 20_000_000n]) {
      expect(nativeWeiToUsdcUnits(usdcUnitsToNativeWei(units))).toBe(units);
    }
  });

  it("truncates sub-unit dust rather than rounding it up into money", () => {
    // Anything below 10^12 wei is less than one USDC unit and cannot be paid.
    expect(nativeWeiToUsdcUnits(999_999_999_999n)).toBe(0n);
    expect(nativeWeiToUsdcUnits(1_999_999_999_999n)).toBe(1n);
  });

  it("makes the zero-gas proof arithmetic come out right", () => {
    // This is the exact computation the settlement proof performs. A buyer's
    // native balance falls by the payment even when they pay no gas, because
    // there is only one balance. Gas is the surplus over that.
    const before = 20_000_000n * NATIVE_PER_USDC_UNIT;
    const paid = 1_000n;
    const after = before - usdcUnitsToNativeWei(paid);
    const gas = before - after - usdcUnitsToNativeWei(paid);
    expect(gas).toBe(0n);
  });
});

describe("formatNative", () => {
  it("renders gas costs at six decimals, because Arc fees are thousandths of a cent", () => {
    expect(formatNative(4_281_188_000_000_000n)).toBe("$0.004281");
    expect(formatNative(0n)).toBe("$0");
  });

  it("renders dust below one micro-dollar as $0 rather than a misleading rounding", () => {
    expect(formatNative(999_999_999_999n)).toBe("$0");
  });
});
