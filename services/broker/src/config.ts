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
import { ARC_TESTNET_CAIP2, accountFor, isAccountAddress, parsePrivateKey } from "@kazuo/protocol";

// The repo keeps one .env at the root; the broker is two directories down.
const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "../../../.env"), quiet: true });
loadDotenv({ quiet: true });

export interface BrokerConfig {
  network: string;
  /** The operator's address, derived from the key rather than configured twice. */
  operatorAddress: string;
  operatorKey: string;
  /** Deployed KazuoLog contract; null disables the audit trail rather than failing. */
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
  const operatorKey = parsePrivateKey(required("KAZUO_OPERATOR_KEY"));

  // Derived, not configured. The Hedera version required an account id
  // alongside the key and could not check that the two matched — a mismatched
  // pair produced INVALID_SIGNATURE on the first payment and nothing before it.
  // An EVM address is a pure function of its key, so the pair cannot disagree.
  const operatorAddress = accountFor(operatorKey).address;

  const declared = optional("KAZUO_OPERATOR_ADDRESS");
  if (declared && declared.toLowerCase() !== operatorAddress.toLowerCase()) {
    throw new Error(
      `KAZUO_OPERATOR_ADDRESS is ${declared} but KAZUO_OPERATOR_KEY controls ${operatorAddress}. ` +
        `Remove the address — it is derived from the key — or fix the key.`,
    );
  }

  const logAddress = optional("KAZUO_LOG_ADDRESS");
  if (logAddress && !isAccountAddress(logAddress)) {
    throw new Error(`KAZUO_LOG_ADDRESS must be an EVM address, got "${logAddress}"`);
  }

  return {
    network: process.env.KAZUO_NETWORK?.trim() || ARC_TESTNET_CAIP2,
    operatorAddress,
    operatorKey,
    logAddress,
    // Railway, Render and Fly inject `PORT` and route only to it. The explicit
    // variable still wins, so a local .env keeps working unchanged.
    port: Number(process.env.KAZUO_BROKER_PORT ?? process.env.PORT ?? 8402),
    publicUrl:
      process.env.KAZUO_BROKER_URL?.trim() ||
      `http://localhost:${process.env.KAZUO_BROKER_PORT ?? process.env.PORT ?? 8402}`,
    corsOrigins: (process.env.KAZUO_CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    feeBps: Number(process.env.KAZUO_FEE_BPS ?? 0),
    facilitatorMode: process.env.KAZUO_FACILITATOR?.trim() || "self",
    dbFile: process.env.KAZUO_DB?.trim() || path.resolve(here, "../../../data/kazuo.db"),
    mongoUri: process.env.KAZUO_MONGO_URI?.trim() || null,
    mongoDb: process.env.KAZUO_MONGO_DB?.trim() || "kazuo",
  };
}
