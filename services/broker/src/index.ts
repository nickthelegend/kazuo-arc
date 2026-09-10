/**
 * Broker entry point.
 */

import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { formatUsd, logFromBlock, networkLabel, usdcAddress } from "@kazuo/protocol";
import { createApp } from "./app.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { Hub } from "./hub.js";
import { JobStore } from "./jobs.js";
import { Registry } from "./registry.js";
import { openPersistence } from "./store.js";
import { LayeredPersistence } from "./store-mongo.js";
import { WorldIdGate, worldIdConfigFromEnv } from "./worldid.js";
import { LogIndex } from "./log-index.js";

const config = loadConfig();
const chain = new Chain(config);

// SQLite is always present — it is the write that cannot fail. Mongo layers on
// top as the restore source, so the broker's history survives losing the box.
const local = openPersistence(config.dbFile);
const layered = config.mongoUri
  ? new LayeredPersistence({
      local,
      uri: config.mongoUri,
      dbName: config.mongoDb,
      onStatus: (message) => console.warn(`[broker] ${message}`),
    })
  : null;

let mongoStatus = "not configured";
if (layered) {
  const result = await layered.connect();
  mongoStatus = result.ok
    ? `connected (${result.jobs} jobs, ${result.providers} providers restored)`
    : `unreachable — running on local disk (${result.error})`;
  if (!result.ok) {
    console.warn(`[broker] mongodb ${mongoStatus}`);
  }
}

const persistence = layered ?? local;
const registry = new Registry(persistence);
const jobs = new JobStore(persistence);
const worldId = new WorldIdGate({ config: worldIdConfigFromEnv(), store: persistence });

// The audit trail, indexed forward into SQLite so pages never scan the chain.
const logInfo = chain.describeLog();
const logIndex = logInfo
  ? new LogIndex({
      network: config.network,
      address: logInfo.address,
      fromBlock: logFromBlock(),
      store: persistence,
      // Receipts this broker published: readable at once, however old.
      knownTransactions: () =>
        jobs
          .list({ limit: 500 })
          .map((job) => job.receiptTxHash ?? "")
          .filter(Boolean),
      // Settlements and audit writes first; the backfill waits its turn.
      yieldTo: () => chain.writing?.() ?? false,
      onEvent: (message) => console.log(`[broker] log index: ${message}`),
    })
  : null;

let hub: Hub | null = null;
const { app, hubHandlers, sweep } = createApp({
  config,
  chain,
  registry,
  jobs,
  getHub: () => hub,
  worldId,
  logIndex: logIndex ?? undefined,
});

logIndex?.start();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const log = chain.describeLog();
  const line = (label: string, value: string) => console.log(`  ${label.padEnd(14)} ${value}`);
  console.log("");
  console.log("  ▁▂▃  K A Z U O   B R O K E R");
  console.log("");
  line("listening", `http://localhost:${info.port}`);
  line("network", `${config.network} (${networkLabel(config.network)})`);
  line("operator", config.operatorAddress);
  line("facilitator", config.facilitatorMode === "self" ? "self-hosted — we pay the gas" : config.facilitatorMode);
  line("usdc", usdcAddress(config.network));
  line("fee", config.feeBps === 0 ? "0% — providers keep everything" : `${config.feeBps / 100}%`);
  line(
    "storage",
    local.kind === "sqlite"
      ? `${local.location} (${jobs.restoredCount} jobs, ${registry.restoredStatsCount} providers restored)`
      : local.location,
  );
  line("mongodb", mongoStatus);
  line("audit log", log ? log.address : "not configured");
  line(
    "world id",
    worldId.enabled ? `${process.env.WORLD_APP_ID} · Selfie Check · ${process.env.WORLD_RP_ID}` : "not configured",
  );
  console.log("");
});

// The hub needs the raw http server to handle upgrades, which only exists once
// `serve` has returned.
hub = new Hub(server as unknown as HttpServer, registry, hubHandlers);

const sweeper = setInterval(sweep, 15_000);

// Drain anything Mongo missed while it was unreachable. Cheap when the queue is
// empty, which is the normal case.
const mongoRetry = layered
  ? setInterval(() => {
      void layered.retryPending();
    }, 30_000)
  : null;
mongoRetry?.unref?.();

function shutdown(signal: string): void {
  console.log(`\n[broker] ${signal} — shutting down`);
  clearInterval(sweeper);
  if (mongoRetry) clearInterval(mongoRetry);
  logIndex?.stop();
  hub?.close();
  chain.close();
  persistence.close();
  server.close(() => process.exit(0));
  // Don't let a stuck socket hold the process open forever.
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (err) => {
  console.error("[broker] unhandled rejection:", err);
});

export { formatUsd };
