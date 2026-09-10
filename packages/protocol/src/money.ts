/**
 * Money math.
 *
 * Kazuo quotes everything in **micro-USD** (millionths of a dollar) as a plain
 * integer, because the prices involved — $0.001 a job — are exactly where
 * floating point starts lying. A `number` holds micro-USD losslessly well past
 * any price this network will ever see, and JSON carries it without ceremony.
 *
 * USDC has 6 decimals, so micro-USD and USDC's smallest unit are the same
 * integer. That is a happy coincidence, not a law, so the conversion still goes
 * through a named function — if this ever runs against a token with different
 * precision, there is one place to fix.
 *
 * ## What is no longer here
 *
 * On Hedera this file also carried an exchange-rate client, a rate cache, and
 * tinybar conversions, because a job could be priced in HBAR *or* USDC and the
 * two needed a live rate to relate. Arc has one asset: USDC is the money and
 * USDC is the gas. There is no second denomination, so there is no rate to
 * fetch, no cache to keep warm, and no window in which a stale quote misprices
 * someone's work. Roughly eighty lines of correct, well-tested code deleted
 * because the chain made the problem not exist.
 *
 * What replaced it is the one conversion Arc genuinely needs: between the two
 * views of a single balance.
 */

import { NATIVE_DECIMALS, USDC_DECIMALS } from "./constants.js";

/** One US dollar, in micro-USD. */
export const USD_MICROS = 1_000_000;

/** Parse a human price like "$0.01", "0.01" or 0.01 into micro-USD. */
export function parseUsd(input: string | number): number {
  const raw = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error(`invalid price: ${String(input)}`);
  }
  return Math.round(raw * USD_MICROS);
}

/**
 * Render micro-USD for humans.
 *
 * Sub-cent prices are the normal case here, so the default keeps four decimal
 * places — "$0.0010" rather than a "$0.00" that reads as free.
 */
export function formatUsd(micros: number, opts: { compact?: boolean } = {}): string {
  const dollars = micros / USD_MICROS;
  if (opts.compact && dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (dollars === 0) return "$0";
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4)}`;
}

/** micro-USD → USDC smallest units, as the integer string x402 wants. */
export function usdMicrosToUsdcUnits(micros: number): string {
  const scale = 10 ** (USDC_DECIMALS - 6);
  return String(Math.round(micros * scale));
}

/** USDC smallest units → micro-USD. */
export function usdcUnitsToUsdMicros(units: string | number): number {
  const scale = 10 ** (USDC_DECIMALS - 6);
  return Math.round(Number(units) / scale);
}

/** Render USDC smallest units as a dollar string. */
export function formatUsdc(units: string | number): string {
  return formatUsd(usdcUnitsToUsdMicros(units));
}

/**
 * The scale between the two views of one balance: 10^12.
 *
 * Named, exported, and used everywhere rather than written inline, because a
 * literal `10n ** 12n` in a payment path is indistinguishable from a typo and
 * the consequence of getting it wrong is off by a factor of a trillion.
 */
export const NATIVE_PER_USDC_UNIT = 10n ** BigInt(NATIVE_DECIMALS - USDC_DECIMALS);

/**
 * The 18-decimal native view of an amount denominated in USDC units.
 *
 * Needed in exactly one place — proving a buyer paid no gas. The native balance
 * is not a separate pot that a fee comes out of; it is the same balance, so a
 * payment of `n` units drops it by `n * 10^12` on its own. Differencing the
 * native balance across a payment therefore measures *payment plus gas*. Gas is
 * the surplus over this number, and for a buyer using EIP-3009 it must be zero.
 */
export function usdcUnitsToNativeWei(units: string | number | bigint): bigint {
  return BigInt(units) * NATIVE_PER_USDC_UNIT;
}

/** The 6-decimal ERC-20 view of a native wei amount. Truncates; it never rounds up. */
export function nativeWeiToUsdcUnits(wei: string | number | bigint): bigint {
  return BigInt(wei) / NATIVE_PER_USDC_UNIT;
}

/**
 * Render native wei as a dollar string.
 *
 * Used for gas costs, which are the only figures in the system genuinely
 * denominated at 18 decimals. Six decimal places, because an Arc transaction
 * costs single-digit thousandths of a cent and `$0.00` says nothing.
 */
export function formatNative(wei: string | number | bigint): string {
  const micros = Number(BigInt(wei) / NATIVE_PER_USDC_UNIT);
  if (micros === 0) return "$0";
  return `$${(micros / USD_MICROS).toFixed(6)}`;
}
