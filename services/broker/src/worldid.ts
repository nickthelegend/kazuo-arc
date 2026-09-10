/**
 * World ID — a live human in front of a camera, at the moment it matters.
 *
 * AgentKit (agentkit.ts) answers "is this wallet registered to *some* human?".
 * World ID answers a sharper question: "did a real person just prove they are
 * here, for this node, right now?" Kazuo asks it with **Selfie Check**, the
 * liveness credential — no Orb needed, so any provider can do it from their
 * phone in a few seconds.
 *
 * The flow is the one Commitment Issues shipped at ETHGlobal Lisbon:
 *
 *   1. The broker mints a request: a nonce it will remember, an action, a
 *      signal (the payout address), all signed with the RP signing key. The key
 *      never leaves the broker.
 *   2. The client (the CLI's terminal QR, or the job board's widget) turns that
 *      into a World App request and waits for the person to scan and show their
 *      face.
 *   3. The proof comes back here. The broker checks what the Developer Portal
 *      does **not**: that the nonce is one it minted, still fresh, used once, and
 *      that the proof's signal hash is the address it was minted for. Only then
 *      is the proof forwarded to `/api/v4/verify/{rp_id}`.
 *   4. A verified nullifier is written to SQLite against the address, so a
 *      restart does not forget who proved what — and one person cannot back an
 *      unbounded number of nodes, because the nullifier is the person.
 *
 * Everything that talks to the outside world is injectable, so tests exercise
 * the real nonce, signal and replay logic without a phone.
 */

import { signRequest } from "@worldcoin/idkit-core/signing";
import { hashSignal } from "@worldcoin/idkit-core/hashing";

/** Portal action for a provider node proving a human runs it. */
export const WORLD_ACTION_PROVIDER = "kazuo-provider";
/** Portal action for a buyer proving a human is behind the purchase. */
export const WORLD_ACTION_BUYER = "kazuo-human";

/** How long a minted request stays redeemable. */
export const WORLD_REQUEST_TTL_SECONDS = 300;

export type WorldPurpose = "provider" | "buyer";

export interface WorldIdConfig {
  appId: string;
  rpId: string;
  /** Hex secp256k1 key registered as the RP signer. Server-side only. */
  signingKey: string;
}

/** What a client needs to open a World App request. Contains no secret. */
export interface WorldRequestTicket {
  app_id: string;
  action: string;
  signal: string;
  /** The preset the client must use — Selfie Check is World ID 3.0 only. */
  preset: "selfieCheckLegacy";
  allow_legacy_proofs: true;
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
}

/** The proof shape IDKit hands back; only the fields we check are typed. */
export interface WorldProofResult {
  protocol_version: string;
  nonce: string;
  action?: string;
  environment?: string;
  responses: Array<{
    identifier: string;
    signal_hash?: string;
    nullifier?: string;
    session_nullifier?: string[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface HumanVerification {
  /** The address (payout address for a node, wallet for a buyer) that was proven. */
  subject: string;
  purpose: WorldPurpose;
  /** World ID nullifier for this action — stable per person, anonymous to us. */
  nullifier: string;
  /** Credential World App presented, e.g. "selfie". */
  credential: string;
  verifiedAt: number;
}

export interface HumanVerificationStore {
  saveHumanVerification(v: HumanVerification): void;
  loadHumanVerifications(): HumanVerification[];
}

export type PortalVerify = (
  rpId: string,
  result: WorldProofResult,
) => Promise<{ ok: boolean; code?: string; detail?: string }>;

/** The real Developer Portal call. Forwards the IDKit result verbatim. */
export const portalVerify: PortalVerify = async (rpId, result) => {
  const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    code?: string;
    detail?: string;
    results?: Array<{ code?: string; detail?: string }>;
  };
  if (res.ok && body.success) return { ok: true };
  const first = body.results?.find((r) => r.code) ?? body;
  return { ok: false, code: first.code ?? `http_${res.status}`, detail: first.detail ?? body.detail };
};

export class WorldIdError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 403 | 409 | 502 | 503 = 400,
  ) {
    super(message);
  }
}

interface Pending {
  purpose: WorldPurpose;
  action: string;
  signal: string;
  expiresAt: number;
}

export interface WorldIdGateOptions {
  config: WorldIdConfig | null;
  store: HumanVerificationStore;
  verify?: PortalVerify;
  now?: () => number;
}

/** Load World ID configuration from the environment, or null when unset. */
export function worldIdConfigFromEnv(env: NodeJS.ProcessEnv = process.env): WorldIdConfig | null {
  const appId = env.WORLD_APP_ID?.trim();
  const rpId = env.WORLD_RP_ID?.trim();
  const signingKey = env.WORLD_SIGNING_KEY?.trim();
  if (!appId || !rpId || !signingKey) return null;
  if (!/^app_[0-9a-f]+$/i.test(appId)) throw new Error(`WORLD_APP_ID must look like app_…, got "${appId}"`);
  if (!/^rp_[0-9a-f]+$/i.test(rpId)) throw new Error(`WORLD_RP_ID must look like rp_…, got "${rpId}"`);
  if (!/^(0x)?[0-9a-f]{64}$/i.test(signingKey)) throw new Error("WORLD_SIGNING_KEY must be 32 bytes of hex");
  return { appId, rpId, signingKey: signingKey.replace(/^0x/i, "") };
}

export class WorldIdGate {
  private readonly config: WorldIdConfig | null;
  private readonly store: HumanVerificationStore;
  private readonly verifyProof: PortalVerify;
  private readonly now: () => number;
  private readonly pending = new Map<string, Pending>();
  /** subject (lowercased) + purpose → verification. */
  private readonly verified = new Map<string, HumanVerification>();

  constructor(options: WorldIdGateOptions) {
    this.config = options.config;
    this.store = options.store;
    this.verifyProof = options.verify ?? portalVerify;
    this.now = options.now ?? Date.now;
    for (const v of this.store.loadHumanVerifications()) {
      this.verified.set(key(v.subject, v.purpose), v);
    }
  }

  get enabled(): boolean {
    return this.config !== null;
  }

  /** Mint a signed, single-use request for `subject`. */
  request(purpose: WorldPurpose, subject: string): WorldRequestTicket {
    if (!this.config) {
      throw new WorldIdError("not_configured", "World ID is not configured on this broker", 503);
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(subject)) {
      throw new WorldIdError("invalid_subject", "subject must be an EVM address");
    }
    this.sweep();
    const action = purpose === "provider" ? WORLD_ACTION_PROVIDER : WORLD_ACTION_BUYER;
    const signal = subject.toLowerCase();
    const sig = signRequest({
      signingKeyHex: this.config.signingKey,
      action,
      ttl: WORLD_REQUEST_TTL_SECONDS,
    });
    this.pending.set(sig.nonce.toLowerCase(), {
      purpose,
      action,
      signal,
      expiresAt: sig.expiresAt * 1000,
    });
    return {
      app_id: this.config.appId,
      action,
      signal,
      preset: "selfieCheckLegacy",
      allow_legacy_proofs: true,
      rp_context: {
        rp_id: this.config.rpId,
        nonce: sig.nonce,
        created_at: sig.createdAt,
        expires_at: sig.expiresAt,
        signature: sig.sig,
      },
    };
  }

  /**
   * Check a proof end to end and record it.
   *
   * The order matters: every local check runs before the portal call, and the
   * nonce is consumed only once the portal agrees, so a malformed or foreign
   * proof cannot burn a legitimate person's pending request.
   */
  async verify(result: WorldProofResult): Promise<HumanVerification> {
    if (!this.config) {
      throw new WorldIdError("not_configured", "World ID is not configured on this broker", 503);
    }
    if (!result || typeof result.nonce !== "string" || !Array.isArray(result.responses)) {
      throw new WorldIdError("invalid_result", "expected an IDKit result with a nonce and responses");
    }
    const nonce = result.nonce.toLowerCase();
    const pending = this.pending.get(nonce);
    if (!pending) {
      throw new WorldIdError("unknown_nonce", "this proof was not requested by this broker, or was already used", 403);
    }
    if (this.now() > pending.expiresAt) {
      this.pending.delete(nonce);
      throw new WorldIdError("expired", "the request expired before the proof arrived — start again", 403);
    }
    if (result.action !== undefined && result.action !== pending.action) {
      throw new WorldIdError("action_mismatch", `proof is for action "${result.action}", expected "${pending.action}"`, 403);
    }
    const response = result.responses[0];
    if (!response) throw new WorldIdError("invalid_result", "the proof carries no credential response");
    const expectedSignalHash = hashSignal(pending.signal).toLowerCase();
    if (!response.signal_hash || response.signal_hash.toLowerCase() !== expectedSignalHash) {
      throw new WorldIdError("signal_mismatch", "the proof is not bound to the address it was requested for", 403);
    }
    const nullifier = response.nullifier ?? response.session_nullifier?.[0];
    if (!nullifier) throw new WorldIdError("invalid_result", "the proof carries no nullifier");

    let outcome: Awaited<ReturnType<PortalVerify>>;
    try {
      outcome = await this.verifyProof(this.config.rpId, result);
    } catch (err) {
      throw new WorldIdError(
        "portal_unreachable",
        `World Developer Portal did not answer: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }
    if (!outcome.ok) {
      throw new WorldIdError(
        outcome.code ?? "verification_failed",
        `World rejected the proof: ${outcome.detail ?? outcome.code ?? "unknown reason"}`,
        403,
      );
    }

    this.pending.delete(nonce);
    const verification: HumanVerification = {
      subject: pending.signal,
      purpose: pending.purpose,
      nullifier: nullifier.toLowerCase(),
      credential: response.identifier,
      verifiedAt: this.now(),
    };
    this.store.saveHumanVerification(verification);
    this.verified.set(key(verification.subject, verification.purpose), verification);
    return verification;
  }

  /** The recorded verification for an address, if any. */
  status(purpose: WorldPurpose, subject: string): HumanVerification | null {
    return this.verified.get(key(subject, purpose)) ?? null;
  }

  private sweep(): void {
    const now = this.now();
    for (const [nonce, p] of this.pending) if (p.expiresAt < now) this.pending.delete(nonce);
  }
}

function key(subject: string, purpose: WorldPurpose): string {
  return `${purpose}:${subject.toLowerCase()}`;
}
