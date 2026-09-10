/**
 * Human-backed agents and nodes, via World AgentKit.
 *
 * A capacity market sorted on reputation has an obvious attack: spin up a
 * thousand provider nodes, win the ties, and farm the success score. Nothing
 * about an EVM address says whether a person is behind it. AgentKit does — an
 * agent's wallet is registered in **AgentBook** (World Chain) against an
 * anonymous World ID human identifier, and the wallet proves control of itself
 * by signing a CAIP-122 / SIWE message.
 *
 * Kazuo uses that proof in two places:
 *
 *  - **Provider registration.** A node that signs the challenge with its payout
 *    key, and whose payout address resolves to a human in AgentBook, is marked
 *    `humanBacked`. The matcher prefers it on a price tie, buyers can require
 *    it, and one human can back at most a handful of live nodes.
 *  - **Quotes.** A buyer — usually an agent — can present the same proof, and
 *    the job records that a human stood behind the purchase.
 *
 * The proof never changes the price and never gates payment. A job from an
 * anonymous agent still settles; it is simply not *labelled* human-backed.
 *
 * ## Why a challenge endpoint rather than the x402 extension
 *
 * AgentKit ships a resource-server extension that rides on the 402. Kazuo's
 * paid route pins its payment requirements on a quote so both x402 passes see
 * identical terms, and a per-response nonce inside the 402 is exactly the kind
 * of field that can make a correctly-signed payment fail the echo check. So the
 * broker issues the challenge itself, from the same primitives, with nonces it
 * minted and will accept once.
 */

import { randomBytes } from "node:crypto";
import {
  buildAgentkitSchema,
  createAgentBookVerifier,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
  type AgentBookVerifier,
  type AgentkitExtension,
} from "@worldcoin/agentkit";

/** AgentBook lives on World Chain mainnet; signatures are made against it too. */
export const AGENTKIT_CHAIN = "eip155:480";

/** Header the signed proof travels in, as AgentKit clients send it. */
export const AGENTKIT_HEADER = "agentkit";

/** A challenge is good for this long, and its nonce exactly once. */
export const AGENTKIT_CHALLENGE_TTL_MS = 5 * 60_000;

export interface HumanProof {
  /** The address that signed. */
  address: string;
  /** AgentBook's anonymous human id, or null when the address isn't registered. */
  humanId: string | null;
}

export interface AgentKitGate {
  /** A fresh challenge for `resourceUri`, to be signed with `createHeader`. */
  challenge(resourceUri: string): AgentkitExtension;
  /**
   * Check a signed proof.
   *
   * Returns null when no header was sent. Throws with a reason when a header
   * was sent and is wrong — a node that tried to prove humanity and failed
   * deserves to be told why rather than silently registered as anonymous.
   */
  verify(
    header: string | undefined,
    resourceUri: string,
    expectedAddress?: string,
  ): Promise<HumanProof | null>;
}

export interface AgentKitGateOptions {
  /** Public base URL of this broker; its hostname is the SIWE domain. */
  publicUrl: string;
  /** AgentBook resolver. Defaults to the canonical World Chain deployment. */
  agentBook?: AgentBookVerifier;
  /** World Chain RPC for AgentBook reads and ERC-1271 checks. */
  worldRpcUrl?: string;
  /**
   * Signature check. Defaults to AgentKit's own, which goes through an RPC so
   * smart-contract wallets (ERC-1271) verify too. Tests pass viem's pure
   * `verifyMessage`, which is a real ecrecover and needs no network.
   */
  verifySignature?: typeof verifyAgentkitSignature;
}

export function createAgentKitGate(options: AgentKitGateOptions): AgentKitGate {
  const agentBook =
    options.agentBook ?? createAgentBookVerifier(options.worldRpcUrl ? { rpcUrl: options.worldRpcUrl } : {});
  const domain = safeHostname(options.publicUrl);
  /** nonce → expiry. Only nonces this broker minted are ever accepted. */
  const issued = new Map<string, number>();

  function sweep(now: number): void {
    for (const [nonce, expiresAt] of issued) if (expiresAt < now) issued.delete(nonce);
  }

  return {
    challenge(resourceUri) {
      const now = Date.now();
      sweep(now);
      const nonce = randomBytes(16).toString("hex");
      issued.set(nonce, now + AGENTKIT_CHALLENGE_TTL_MS);
      return {
        info: {
          domain,
          uri: resourceUri,
          version: "1",
          nonce,
          issuedAt: new Date(now).toISOString(),
          expirationTime: new Date(now + AGENTKIT_CHALLENGE_TTL_MS).toISOString(),
          statement: "Prove a human stands behind this Kazuo node or agent.",
          resources: [resourceUri],
        },
        supportedChains: [{ chainId: AGENTKIT_CHAIN, type: "eip191" }],
        schema: buildAgentkitSchema(),
      };
    },

    async verify(header, resourceUri, expectedAddress) {
      if (!header) return null;
      const payload = parseAgentkitHeader(header);

      const validation = await validateAgentkitMessage(payload, resourceUri, {
        checkNonce: (nonce) => {
          const expiresAt = issued.get(nonce);
          return expiresAt !== undefined && expiresAt >= Date.now();
        },
      });
      if (!validation.valid) {
        throw new Error(`agentkit proof rejected: ${validation.error ?? "invalid message"}`);
      }

      const verification = await (options.verifySignature ?? verifyAgentkitSignature)(
        payload,
        options.worldRpcUrl ? { rpcUrls: { [AGENTKIT_CHAIN]: options.worldRpcUrl } } : undefined,
      );
      if (!verification.valid || !verification.address) {
        throw new Error(`agentkit signature rejected: ${verification.error ?? "invalid signature"}`);
      }
      if (expectedAddress && verification.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error(
          `agentkit proof was signed by ${verification.address}, not the payout address ${expectedAddress}`,
        );
      }

      // Single use: consumed only once everything above has passed, so a
      // malformed attempt cannot burn a legitimate caller's nonce.
      issued.delete(payload.nonce);

      const humanId = await agentBook.lookupHuman(verification.address);
      return { address: verification.address, humanId: humanId ?? null };
    },
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}
