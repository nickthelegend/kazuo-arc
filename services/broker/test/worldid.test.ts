/**
 * World ID gate: the checks the Developer Portal does not do for us.
 *
 * Signing and signal hashing run for real (`@worldcoin/idkit-core`), with a
 * throwaway secp256k1 key. The one thing replaced is the Developer Portal call,
 * because a valid proof needs a person scanning World App — the portal's real
 * rejection format is used for the failure case.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { generatePrivateKey } from "viem/accounts";
import {
  WORLD_ACTION_BUYER,
  WORLD_ACTION_PROVIDER,
  WORLD_REQUEST_TTL_SECONDS,
  WorldIdError,
  WorldIdGate,
  worldIdConfigFromEnv,
  type PortalVerify,
  type WorldProofResult,
} from "../src/worldid.js";
import { MemoryPersistence } from "../src/store.js";
import { Registry, MAX_HUMAN_BACKED_NODES_PER_HUMAN } from "../src/registry.js";

const ADDRESS = "0xff212ecb82E3b06c0a2A7a9Ce343e0a1868c489B";
const OTHER = "0x03294Ce27e218d1611B2ebc0b0ffdDb95F129F36";
const config = { appId: "app_d7d26bb561fa95de4117df5b5ecc89e2", rpId: "rp_30d29cd7ee86bae6", signingKey: generatePrivateKey().slice(2) };

function proofFor(ticket: { rp_context: { nonce: string }; action: string; signal: string }, over: Partial<WorldProofResult["responses"][0]> = {}): WorldProofResult {
  return {
    protocol_version: "3.0",
    nonce: ticket.rp_context.nonce,
    action: ticket.action,
    environment: "production",
    responses: [
      {
        identifier: "selfie",
        signal_hash: hashSignal(ticket.signal),
        proof: "0x" + "11".repeat(256),
        merkle_root: "0x" + "22".repeat(32),
        nullifier: "0xAbC123",
        ...over,
      },
    ],
  };
}

describe("World ID gate", () => {
  let store: MemoryPersistence;
  let portalCalls: number;
  let portalAnswer: Awaited<ReturnType<PortalVerify>>;
  let now: number;
  let gate: WorldIdGate;

  beforeEach(() => {
    store = new MemoryPersistence();
    portalCalls = 0;
    portalAnswer = { ok: true };
    now = Date.now();
    gate = new WorldIdGate({
      config,
      store,
      verify: async () => {
        portalCalls += 1;
        return portalAnswer;
      },
      now: () => now,
    });
  });

  it("mints a signed Selfie Check request bound to the address", () => {
    const t = gate.request("provider", ADDRESS);
    expect(t.app_id).toBe(config.appId);
    expect(t.action).toBe(WORLD_ACTION_PROVIDER);
    expect(t.signal).toBe(ADDRESS.toLowerCase());
    expect(t.preset).toBe("selfieCheckLegacy");
    expect(t.rp_context.rp_id).toBe(config.rpId);
    expect(t.rp_context.expires_at - t.rp_context.created_at).toBe(WORLD_REQUEST_TTL_SECONDS);
    expect(t.rp_context.signature).toMatch(/^0x[0-9a-f]{130}$/i);
    expect(gate.request("buyer", ADDRESS).action).toBe(WORLD_ACTION_BUYER);
  });

  it("refuses to mint for something that is not an address", () => {
    expect(() => gate.request("provider", "not-an-address")).toThrow(WorldIdError);
  });

  it("records a verified proof, persists it, and reports it by address", async () => {
    const t = gate.request("provider", ADDRESS);
    const v = await gate.verify(proofFor(t));
    expect(v).toMatchObject({ subject: ADDRESS.toLowerCase(), purpose: "provider", credential: "selfie", nullifier: "0xabc123" });
    expect(portalCalls).toBe(1);
    expect(gate.status("provider", ADDRESS)?.credential).toBe("selfie");
    expect(gate.status("buyer", ADDRESS)).toBeNull();
    // A fresh gate over the same store remembers it — the restart case.
    const reborn = new WorldIdGate({ config, store, verify: async () => ({ ok: true }) });
    expect(reborn.status("provider", ADDRESS)?.nullifier).toBe("0xabc123");
  });

  it("accepts each nonce once", async () => {
    const t = gate.request("provider", ADDRESS);
    await gate.verify(proofFor(t));
    await expect(gate.verify(proofFor(t))).rejects.toMatchObject({ code: "unknown_nonce" });
  });

  it("rejects a nonce this broker never minted, without calling World", async () => {
    const foreign = { rp_context: { nonce: "0x00" + "ab".repeat(31) }, action: WORLD_ACTION_PROVIDER, signal: ADDRESS.toLowerCase() };
    await expect(gate.verify(proofFor(foreign))).rejects.toMatchObject({ code: "unknown_nonce" });
    expect(portalCalls).toBe(0);
  });

  it("rejects a proof bound to a different address", async () => {
    const t = gate.request("provider", ADDRESS);
    await expect(gate.verify(proofFor(t, { signal_hash: hashSignal(OTHER.toLowerCase()) }))).rejects.toMatchObject({ code: "signal_mismatch" });
    expect(portalCalls).toBe(0);
  });

  it("rejects a proof for another action", async () => {
    const t = gate.request("provider", ADDRESS);
    await expect(gate.verify({ ...proofFor(t), action: WORLD_ACTION_BUYER })).rejects.toMatchObject({ code: "action_mismatch" });
  });

  it("rejects a proof that arrives after the request expired", async () => {
    const t = gate.request("provider", ADDRESS);
    now += (WORLD_REQUEST_TTL_SECONDS + 1) * 1000;
    await expect(gate.verify(proofFor(t))).rejects.toMatchObject({ code: "expired" });
    expect(portalCalls).toBe(0);
  });

  it("passes World's rejection through and keeps the nonce for a retry", async () => {
    const t = gate.request("provider", ADDRESS);
    portalAnswer = { ok: false, code: "invalid_format", detail: "This attribute is improperly formatted." };
    await expect(gate.verify(proofFor(t))).rejects.toMatchObject({ code: "invalid_format", status: 403 });
    expect(gate.status("provider", ADDRESS)).toBeNull();
    portalAnswer = { ok: true };
    await expect(gate.verify(proofFor(t))).resolves.toMatchObject({ credential: "selfie" });
  });

  it("answers 503 when World ID is not configured", () => {
    const off = new WorldIdGate({ config: null, store });
    expect(off.enabled).toBe(false);
    expect(() => off.request("provider", ADDRESS)).toThrow(expect.objectContaining({ status: 503 }));
  });

  it("reads its configuration from the environment and validates it", () => {
    expect(worldIdConfigFromEnv({})).toBeNull();
    expect(worldIdConfigFromEnv({ WORLD_APP_ID: config.appId, WORLD_RP_ID: config.rpId, WORLD_SIGNING_KEY: "0x" + config.signingKey })).toEqual(config);
    expect(() => worldIdConfigFromEnv({ WORLD_APP_ID: "nope", WORLD_RP_ID: config.rpId, WORLD_SIGNING_KEY: config.signingKey })).toThrow(/WORLD_APP_ID/);
  });
});

describe("registry.markHuman (World ID)", () => {
  it("labels a live node at the verified address immediately, within the per-human cap", () => {
    const registry = new Registry();
    const cap = (id: string) => ({ label: id, address: ADDRESS, endpoint: "http://x", capabilities: [{ id: "echo", adapter: "echo" as const, displayName: "Echo", model: null, priceUsdMicros: 1000, maxConcurrency: 1 }], version: "0.3.0", region: null, nodeId: id });
    const nodes = Array.from({ length: MAX_HUMAN_BACKED_NODES_PER_HUMAN + 1 }, (_, i) => registry.register(cap(`n${i}`)));
    expect(nodes.every((n) => !n.humanBacked)).toBe(true);
    expect(registry.markHuman(ADDRESS, "world:0xabc")).toBe(MAX_HUMAN_BACKED_NODES_PER_HUMAN);
    expect(registry.list().filter((p) => p.humanBacked)).toHaveLength(MAX_HUMAN_BACKED_NODES_PER_HUMAN);
  });
});
