/**
 * `kazuo agentkit` — prove a human stands behind this node.
 *
 * `status` reads AgentBook on World Chain for the payout address: a real
 * contract call, no key needed. `register` hands off to World's own CLI, which
 * walks the operator through World App verification — a step that has to be a
 * person, which is the whole point of it.
 *
 * Once registered, `kazuo start` and `kazuo run` sign the broker's challenge
 * automatically and the node is labelled human-backed.
 */

import { spawn } from "node:child_process";
import { createAgentBookVerifier } from "@worldcoin/agentkit";
import { accountFor } from "@kazuo/protocol";
import { loadConfig, resolveBrokerUrl } from "../config.js";
import * as ui from "../ui.js";

interface AgentkitOptions {
  address?: string;
  json?: boolean;
}

function targetAddress(opts: AgentkitOptions): string {
  if (opts.address) return opts.address;
  const fromEnv = process.env.KAZUO_PRIVATE_KEY?.trim() || process.env.KAZUO_PAYER_KEY?.trim();
  if (fromEnv) return accountFor(fromEnv).address;
  const config = loadConfig();
  if (config?.address) return config.address;
  throw new Error("no address — pass --address, or run `kazuo init` first");
}

export async function agentkitStatus(opts: AgentkitOptions): Promise<void> {
  const address = targetAddress(opts);
  const spin = opts.json ? null : ui.spinner(`looking ${address} up in AgentBook on World Chain…`);
  const humanId = await createAgentBookVerifier(
    process.env.KAZUO_WORLD_RPC_URL ? { rpcUrl: process.env.KAZUO_WORLD_RPC_URL } : {},
  ).lookupHuman(address);

  if (opts.json) {
    console.log(JSON.stringify({ address, humanBacked: Boolean(humanId) }, null, 2));
    return;
  }
  if (humanId) {
    spin?.succeed("human-backed — this address is registered in AgentBook");
    ui.muted("  the broker will label this node human-backed on its next registration");
  } else {
    spin?.fail("not registered — the broker will treat this node as anonymous");
    ui.muted(`  register with: kazuo agentkit register${opts.address ? ` --address ${address}` : ""}`);
  }
  const config = loadConfig();
  if (config) ui.muted(`  broker: ${resolveBrokerUrl(config)}`);
}

export async function agentkitRegister(opts: AgentkitOptions): Promise<void> {
  const address = targetAddress(opts);
  ui.info(`registering ${address} in AgentBook — World App will ask you to verify`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["-y", "@worldcoin/agentkit-cli", "register", address], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`agentkit-cli exited with ${code}`)),
    );
  });
  ui.ok("done — restart `kazuo start` to register as human-backed");
}
