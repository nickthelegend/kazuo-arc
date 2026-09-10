/**
 * `kazuo verify` — prove a real human runs this node, with World ID.
 *
 * The same shape as Commitment Issues' terminal flow: the broker mints a signed
 * Selfie Check request bound to this node's payout address, the request is
 * shown here as a QR code, the operator scans it with World App and shows their
 * face, and the proof goes back to the broker — which checks the nonce, the
 * age and the address binding before World's Developer Portal ever sees it.
 *
 * There is no laptop-webcam path in World ID, and there is not meant to be:
 * capture happens inside World App on a phone. The QR is the whole design.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { accountFor } from "@kazuo/protocol";
import { loadConfig, resolvePrivateKey } from "../config.js";
import * as ui from "../ui.js";

interface VerifyOptions {
  broker?: string;
  address?: string;
  buyer?: boolean;
  timeout?: string;
}

interface Ticket {
  app_id: `app_${string}`;
  action: string;
  signal: string;
  allow_legacy_proofs: boolean;
  rp_context: { rp_id: string; nonce: string; created_at: number; expires_at: number; signature: string };
  error?: string;
}

let shimInstalled = false;

/**
 * Let idkit-core load its WASM under Node.
 *
 * It fetches `idkit_wasm_bg.wasm` from a `file://` URL next to its own module,
 * and Node's `fetch` refuses that scheme outright ("fetch failed"). Everything
 * else still goes to the real `fetch`.
 */
function installWasmFetchShim(): void {
  if (shimInstalled) return;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("file://")) {
      const bytes = fs.readFileSync(fileURLToPath(url));
      return new Response(bytes, {
        status: 200,
        headers: { "content-type": url.endsWith(".wasm") ? "application/wasm" : "application/octet-stream" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  shimInstalled = true;
}

export async function verifyCommand(opts: VerifyOptions): Promise<void> {
  const config = loadConfig();
  const brokerUrl = (
    opts.broker ??
    process.env.KAZUO_BROKER_URL ??
    config?.brokerUrl ??
    "http://localhost:8402"
  ).replace(/\/+$/, "");
  const purpose = opts.buyer ? "buyer" : "provider";

  let subject = opts.address;
  if (!subject) {
    if (purpose === "buyer") {
      const key = process.env.KAZUO_PAYER_KEY?.trim();
      if (!key) throw new Error("pass --address, or set KAZUO_PAYER_KEY to verify as a buyer");
      subject = accountFor(key).address;
    } else {
      if (!config) throw new Error("this machine isn't set up yet — run `kazuo init`, or pass --address");
      subject = config.address || accountFor(resolvePrivateKey(config)).address;
    }
  }

  console.log(ui.banner("world id · selfie check"));

  // 1. A signed, single-use request from the broker.
  const ticketRes = await fetch(`${brokerUrl}/api/worldid/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, subject }),
    signal: AbortSignal.timeout(20_000),
  });
  const ticket = (await ticketRes.json()) as Ticket;
  if (!ticketRes.ok) throw new Error(ticket.error ?? `broker returned ${ticketRes.status}`);

  // 2. The World App request itself.
  installWasmFetchShim();
  const { IDKit, selfieCheckLegacy } = await import("@worldcoin/idkit-core");
  const request = await IDKit.request({
    app_id: ticket.app_id,
    action: ticket.action,
    rp_context: ticket.rp_context,
    allow_legacy_proofs: ticket.allow_legacy_proofs,
  }).preset(selfieCheckLegacy({ signal: ticket.signal }));

  // 3. Show it.
  const windowSeconds = Math.max(30, Number(opts.timeout ?? 120));
  const qr = await QRCode.toString(request.connectorURI, { type: "terminal", small: true });
  ui.blank();
  console.log(
    ui.box(
      ui.kv([
        ["proving", `${ui.c.bold(subject)} ${ui.c.muted(`(${purpose})`)}`],
        ["credential", "Selfie Check — liveness, no Orb needed"],
        ["action", ticket.action],
        ["window", `${windowSeconds}s`],
      ]),
      { title: "world id" },
    ),
  );
  ui.blank();
  console.log(qr);
  ui.muted(`  or open on your phone: ${request.connectorURI}`);
  ui.blank();

  // 4. Wait for World App.
  const spin = ui.spinner("scan with World App, then show your face…");
  const completion = await request.pollUntilCompletion({
    pollInterval: 2_000,
    timeout: windowSeconds * 1000,
  });
  if (!completion.success) {
    spin.fail(`World App did not complete the proof: ${completion.error}`);
    process.exitCode = 1;
    return;
  }
  spin.succeed("proof received from World App");

  // 5. The broker checks it and records it.
  const verifyRes = await fetch(`${brokerUrl}/api/worldid/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completion.result),
    signal: AbortSignal.timeout(30_000),
  });
  const verified = (await verifyRes.json()) as {
    verified?: boolean;
    credential?: string;
    nodesMarked?: number;
    error?: string;
    code?: string;
  };
  if (!verifyRes.ok || !verified.verified) {
    throw new Error(`the broker refused the proof: ${verified.error ?? verifyRes.status}${verified.code ? ` (${verified.code})` : ""}`);
  }

  ui.ok(`human verified — ${verified.credential} · ${subject}`);
  if (purpose === "provider") {
    ui.muted(
      verified.nodesMarked
        ? `  ${verified.nodesMarked} live node(s) at this address are now labelled human-backed`
        : "  the next `kazuo start` registers this node as human-backed",
    );
  } else {
    ui.muted("  jobs paid from this address are recorded as bought by a human");
  }
}
