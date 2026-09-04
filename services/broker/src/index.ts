/**
 * Broker entry point.
 */

import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { formatUsd, networkLabel, usdcTokenId } from "@xorv/protocol";
import { createApp } from "./app.js";
import { Chain } from "./chain.js";
import { loadConfig } from "./config.js";
import { Hub } from "./hub.js";
import { JobStore } from "./jobs.js";
import { Registry } from "./registry.js";
import { openPersistence } from "./store.js";

const config = loadConfig();
const chain = new Chain(config);
const persistence = openPersistence(config.dbFile);
const registry = new Registry(persistence);
const jobs = new JobStore(persistence);

let hub: Hub | null = null;
const { app, hubHandlers, sweep } = createApp({
  config,
  chain,
  registry,
  jobs,
  getHub: () => hub,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  const topics = chain.describeTopics();
  const line = (label: string, value: string) => console.log(`  ${label.padEnd(14)} ${value}`);
  console.log("");
  console.log("  ▁▂▃  X O R V   B R O K E R");
  console.log("");
  line("listening", `http://localhost:${info.port}`);
  line("network", `${config.network} (${networkLabel(config.network)})`);
  line("operator", config.operatorId);
  line("facilitator", config.facilitatorMode === "self" ? "self-hosted — we pay the gas" : config.facilitatorMode);
  line("usdc", usdcTokenId(config.network));
  line("fee", config.feeBps === 0 ? "0% — providers keep everything" : `${config.feeBps / 100}%`);
  line(
    "storage",
    persistence.kind === "sqlite"
      ? `${persistence.location} (${jobs.restoredCount} jobs, ${registry.restoredStatsCount} providers restored)`
      : persistence.location,
  );
  for (const [kind, topic] of Object.entries(topics)) {
    line(`hcs:${kind}`, topic ? topic.id : "not configured");
  }
  console.log("");
});

// The hub needs the raw http server to handle upgrades, which only exists once
// `serve` has returned.
hub = new Hub(server as unknown as HttpServer, registry, hubHandlers);

const sweeper = setInterval(sweep, 15_000);

function shutdown(signal: string): void {
  console.log(`\n[broker] ${signal} — shutting down`);
  clearInterval(sweeper);
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
