/**
 * Broker configuration, resolved once at boot.
 *
 * Everything that can be wrong about a deployment — missing key, unfunded
 * operator, a log contract that isn't there — should be discoverable here or in
 * `describeConfig`, not three seconds into someone's first paid job.
 */

import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ARC_TESTNET_CAIP2, accountFor, isAccountAddress, parsePrivateKey } from "@xorv/protocol";

// The repo keeps one .env at the root; the broker is two directories down.
const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "../../../.env"), quiet: true });
loadDotenv({ quiet: true });

export interface BrokerConfig {
  network: string;
  /** The operator's address, derived from the key rather than configured twice. */
  operatorAddress: string;
  operatorKey: string;
  /** Deployed XorvLog contract; null disables the audit trail rather than failing. */
  logAddress: string | null;
  port: number;
  publicUrl: string;
  corsOrigins: string[];
  feeBps: number;
  /** "self" runs the facilitator in-process; "hosted" or a URL calls one out. */
  facilitatorMode: string;
  /** SQLite file for durable jobs and earnings; "off" disables persistence. */
  dbFile: string | null;
  /** MongoDB URI. When set, it becomes the restore source; SQLite stays the write guarantee. */
  mongoUri: string | null;
  mongoDb: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in — ` +
        `claim Arc testnet USDC at https://faucet.circle.com`,
    );
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function loadConfig(): BrokerConfig {
  const operatorKey = parsePrivateKey(required("XORV_OPERATOR_KEY"));

  // Derived, not configured. The Hedera version required an account id
  // alongside the key and could not check that the two matched — a mismatched
  // pair produced INVALID_SIGNATURE on the first payment and nothing before it.
  // An EVM address is a pure function of its key, so the pair cannot disagree.
  const operatorAddress = accountFor(operatorKey).address;

  const declared = optional("XORV_OPERATOR_ADDRESS");
  if (declared && declared.toLowerCase() !== operatorAddress.toLowerCase()) {
    throw new Error(
      `XORV_OPERATOR_ADDRESS is ${declared} but XORV_OPERATOR_KEY controls ${operatorAddress}. ` +
        `Remove the address — it is derived from the key — or fix the key.`,
    );
  }

  const logAddress = optional("XORV_LOG_ADDRESS");
  if (logAddress && !isAccountAddress(logAddress)) {
    throw new Error(`XORV_LOG_ADDRESS must be an EVM address, got "${logAddress}"`);
  }

  return {
    network: process.env.XORV_NETWORK?.trim() || ARC_TESTNET_CAIP2,
    operatorAddress,
    operatorKey,
    logAddress,
    port: Number(process.env.XORV_BROKER_PORT ?? 8402),
    publicUrl:
      process.env.XORV_BROKER_URL?.trim() ||
      `http://localhost:${process.env.XORV_BROKER_PORT ?? 8402}`,
    corsOrigins: (process.env.XORV_CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    feeBps: Number(process.env.XORV_FEE_BPS ?? 0),
    facilitatorMode: process.env.XORV_FACILITATOR?.trim() || "self",
    dbFile: process.env.XORV_DB?.trim() || path.resolve(here, "../../../data/xorv.db"),
    mongoUri: process.env.XORV_MONGO_URI?.trim() || null,
    mongoDb: process.env.XORV_MONGO_DB?.trim() || "xorv",
  };
}
