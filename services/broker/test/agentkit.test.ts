/**
 * World AgentKit: human-backed nodes and agents.
 *
 * The gate is exercised with real keys producing real SIWE signatures through
 * AgentKit's own client, so a regression in message formatting, nonce handling
 * or address binding fails here. Two things are swapped for offline
 * equivalents: signature verification uses viem's pure ecrecover rather than an
 * RPC round-trip (EOAs only — the same maths), and AgentBook is a table of
 * which addresses belong to which human, since the real one is a World Chain
 * contract read.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createAgentkitClient, verifyAgentkitSignature } from "@worldcoin/agentkit";
import { formatSIWEMessage } from "@worldcoin/agentkit";
import { verifyMessage } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Capability, RegisterRequest } from "@kazuo/protocol";
import { createAgentKitGate, AGENTKIT_CHAIN } from "../src/agentkit.js";
import { MAX_HUMAN_BACKED_NODES_PER_HUMAN, Registry } from "../src/registry.js";

const PUBLIC_URL = "https://broker.kazuo.test";
const REGISTER_URI = `${PUBLIC_URL}/api/providers/register`;

/** Offline signature check: the same EIP-191 recovery, no RPC. */
const offlineVerify: typeof verifyAgentkitSignature = async (payload) => {
  const message = formatSIWEMessage(
    {
      domain: payload.domain,
      uri: payload.uri,
      statement: payload.statement,
      version: payload.version,
      chainId: payload.chainId,
      type: payload.type,
      nonce: payload.nonce,
      issuedAt: payload.issuedAt,
      expirationTime: payload.expirationTime,
      notBefore: payload.notBefore,
      requestId: payload.requestId,
      resources: payload.resources,
    },
    payload.address,
  );
  const valid = await verifyMessage({
    address: payload.address as `0x${string}`,
    message,
    signature: payload.signature as `0x${string}`,
  });
  return valid ? { valid, address: payload.address } : { valid: false, error: "bad signature" };
};

function signerFor(key: `0x${string}`) {
  const account = privateKeyToAccount(key);
  return {
    account,
    client: createAgentkitClient({
      signer: {
        address: account.address,
        chainId: AGENTKIT_CHAIN,
        type: "eip191",
        signMessage: (message) => account.signMessage({ message }),
      },
    }),
  };
}

describe("AgentKit gate", () => {
  const human = privateKeyToAccount(generatePrivateKey());
  const book = new Map<string, string>();
  const gate = createAgentKitGate({
    publicUrl: PUBLIC_URL,
    agentBook: { lookupHuman: async (a) => book.get(a.toLowerCase()) ?? null },
    verifySignature: offlineVerify,
  });

  beforeEach(() => {
    book.clear();
  });

  it("returns null when no proof is sent — anonymous is allowed", async () => {
    expect(await gate.verify(undefined, REGISTER_URI)).toBeNull();
  });

  it("resolves a registered address to its human id", async () => {
    const key = generatePrivateKey();
    const { account, client } = signerFor(key);
    book.set(account.address.toLowerCase(), "0xhuman1");
    const header = await client.createHeader(gate.challenge(REGISTER_URI));
    const proof = await gate.verify(header, REGISTER_URI, account.address);
    expect(proof).toEqual({ address: account.address, humanId: "0xhuman1" });
  });

  it("verifies an unregistered address but reports no human", async () => {
    const { account, client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(gate.challenge(REGISTER_URI));
    const proof = await gate.verify(header, REGISTER_URI, account.address);
    expect(proof?.humanId).toBeNull();
  });

  it("refuses a proof signed by some other address than the payout address", async () => {
    const { client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(gate.challenge(REGISTER_URI));
    await expect(gate.verify(header, REGISTER_URI, human.address)).rejects.toThrow(/not the payout/);
  });

  it("accepts each nonce exactly once", async () => {
    const { account, client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(gate.challenge(REGISTER_URI));
    await gate.verify(header, REGISTER_URI, account.address);
    await expect(gate.verify(header, REGISTER_URI, account.address)).rejects.toThrow(/rejected/);
  });

  it("refuses a nonce this broker never issued", async () => {
    const other = createAgentKitGate({ publicUrl: PUBLIC_URL, verifySignature: offlineVerify });
    const { account, client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(other.challenge(REGISTER_URI));
    await expect(gate.verify(header, REGISTER_URI, account.address)).rejects.toThrow(/rejected/);
  });

  it("refuses a proof made for a different broker host", async () => {
    const elsewhere = createAgentKitGate({
      publicUrl: "https://evil.example",
      verifySignature: offlineVerify,
    });
    const { account, client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(elsewhere.challenge("https://evil.example/api/providers/register"));
    await expect(gate.verify(header, REGISTER_URI, account.address)).rejects.toThrow(/mismatch/i);
  });

  it("refuses a tampered signature", async () => {
    const { account, client } = signerFor(generatePrivateKey());
    const header = await client.createHeader(gate.challenge(REGISTER_URI));
    const payload = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    payload.statement = "something the signer never agreed to";
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64");
    await expect(gate.verify(forged, REGISTER_URI, account.address)).rejects.toThrow(/signature/);
  });
});

function capability(over: Partial<Capability> = {}): Capability {
  return {
    id: "codex",
    adapter: "codex",
    displayName: "Codex",
    model: null,
    priceUsdMicros: 10_000,
    maxConcurrency: 1,
    ...over,
  };
}

function registration(nodeId: string, over: Partial<RegisterRequest> = {}): RegisterRequest {
  return {
    label: nodeId,
    address: privateKeyToAccount(generatePrivateKey()).address,
    endpoint: "http://localhost:1",
    capabilities: [capability()],
    version: "0.2.0",
    region: null,
    nodeId,
    ...over,
  };
}

describe("human-backed providers in the registry", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry();
  });

  it("labels a node human-backed only when a human id was proven", () => {
    expect(registry.register(registration("a"), { humanId: "0xh" }).humanBacked).toBe(true);
    expect(registry.register(registration("b")).humanBacked).toBe(false);
  });

  it(`caps one human at ${MAX_HUMAN_BACKED_NODES_PER_HUMAN} live human-backed nodes`, () => {
    for (let i = 0; i < MAX_HUMAN_BACKED_NODES_PER_HUMAN; i++) {
      expect(registry.register(registration(`n${i}`), { humanId: "0xsame" }).humanBacked).toBe(true);
    }
    const extra = registry.register(registration("one-too-many"), { humanId: "0xsame" });
    expect(extra.humanBacked).toBe(false);
    // Registered and matchable, just not labelled.
    expect(registry.get(extra.id)?.status).toBe("online");
  });

  it("does not count a re-registering node against its own human", () => {
    for (let i = 0; i < MAX_HUMAN_BACKED_NODES_PER_HUMAN; i++) {
      registry.register(registration(`n${i}`), { humanId: "0xsame" });
    }
    expect(registry.register(registration("n0"), { humanId: "0xsame" }).humanBacked).toBe(true);
  });

  it("prefers the human-backed node on a price tie, ahead of track record", () => {
    const bot = registry.register(registration("bot"));
    bot.stats.jobsCompleted = 100;
    const person = registry.register(registration("person"), { humanId: "0xh" });
    expect(registry.match({ maxPriceUsdMicros: 50_000 })?.provider.id).toBe(person.id);
  });

  it("still lets price win over the label", () => {
    registry.register(registration("person", { capabilities: [capability({ priceUsdMicros: 20_000 })] }), {
      humanId: "0xh",
    });
    const cheap = registry.register(registration("cheap-bot"));
    expect(registry.match({ maxPriceUsdMicros: 50_000 })?.provider.id).toBe(cheap.id);
  });

  it("matches only human-backed nodes when the buyer asks for it", () => {
    registry.register(registration("bot"));
    expect(registry.match({ maxPriceUsdMicros: 50_000, humanBackedOnly: true })).toBeNull();
    const person = registry.register(registration("person"), { humanId: "0xh" });
    expect(registry.match({ maxPriceUsdMicros: 50_000, humanBackedOnly: true })?.provider.id).toBe(person.id);
  });
});
