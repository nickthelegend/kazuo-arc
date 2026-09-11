/**
 * The broker's HTTP surface.
 *
 * The interesting part is `POST /api/jobs/:quoteId`. It is an ordinary x402
 * protected route, but its `payTo` resolves to the **provider's own Arc
 * address** rather than to us. The broker introduces the two parties, witnesses
 * the result and publishes the receipt; it never holds anyone's money. That is
 * also why a quote is a first-class object — see jobs.ts.
 *
 * ## Why payment settles before the job runs
 *
 * An EIP-3009 authorization carries `validAfter` and `validBefore` timestamps,
 * and x402 advertises a 300-second window. The buyer signs an authorization the
 * facilitator must relay inside it, so if the broker waited for a five-minute
 * coding job to finish before submitting, the signed payment would have expired
 * and the provider would be unpaid for work already done. So Kazuo verifies and
 * settles up front, and covers the other
 * risk — a provider that takes the money and fails — by reassigning the job to
 * another provider at no extra charge (see `reassign`). The poster's downside
 * is bounded by the network, not by the individual node they happened to draw.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware } from "@x402/hono";
import { x402ResourceServer } from "@x402/core/server";
import type { RoutesConfig } from "@x402/core/server";
import type { HTTPRequestContext } from "@x402/core/http";
import type { FacilitatorClient } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  HEARTBEAT_INTERVAL_MS,
  JOB_TIMEOUT_MS,
  assetKind,
  buildFacilitator,
  formatUsd,
  isAccountAddress,
  explorerAddress,
  explorerTx,
  readLog,
  sha256,
  usdMicrosToUsdcUnits,
  usdcDomain,
  usdcUnitsToUsdMicros,
  usdcAddress,
  type AdapterKind,
  type Capability,
  type DispatchedJob,
  type HeartbeatRequest,
  type Job,
  type JobEvent,
  type JobRequest,
  type PaymentRecord,
  type RegisterRequest,
} from "@kazuo/protocol";
import type { BrokerConfig } from "./config.js";
import type { ChainLike } from "./chain.js";
import type { Hub } from "./hub.js";
import { JobStore, type Quote } from "./jobs.js";
import { Registry } from "./registry.js";
import { bodyLimit, rateLimit, requestLog } from "./guards.js";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { accountFor as demoAccountFor, readClient as demoReadClient } from "@kazuo/protocol";

/** The most the demo account pays for one job, in micro-USD. Anyone can press the button. */
const DEMO_MAX_USD_MICROS = 250_000;
import { Metrics } from "./metrics.js";
import { AGENTKIT_HEADER, createAgentKitGate, type AgentKitGate } from "./agentkit.js";
import type { Context } from "hono";
import type { LogIndex } from "./log-index.js";
import {
  WorldIdError,
  type WorldIdGate,
  type WorldProofResult,
  type WorldPurpose,
} from "./worldid.js";

/**
 * Publish one heartbeat in this many on chain — see Chain.publishHeartbeat.
 *
 * 240 beats at the 15s interval is one on-chain liveness proof per provider per
 * hour. The Hedera version sampled 1 in 20 — one every five minutes — and that
 * number does not survive the move, for a reason worth putting a figure on.
 *
 * Measured on Arc testnet: an audit append costs 43,460 gas, or **$0.00088**.
 * At one every five minutes that is 288 writes a day, **$0.25 per day per
 * provider** — paid by the broker, which takes a 0% fee and earns nothing. A
 * single idle node would cost more per day than a hundred settled jobs
 * ($0.00185 each) put together. On Hedera an HCS message cost a fraction of a
 * cent and the arithmetic never mattered.
 *
 * Hourly still gives the log its actual job: a periodic, publicly checkable
 * proof that a node really was up. Sub-minute liveness is already carried by
 * the HTTP heartbeat and the control channel, neither of which touches a chain.
 */
const HEARTBEAT_PUBLISH_EVERY = 240;

export interface AppDeps {
  config: BrokerConfig;
  chain: ChainLike;
  registry: Registry;
  jobs: JobStore;
  /** Set after the HTTP server exists, since the hub needs it to upgrade. */
  getHub: () => Hub | null;
  /**
   * Override the facilitator.
   *
   * Production builds one from config; tests pass a stub so the whole HTTP
   * path can be exercised without chain credentials or a real transfer.
   */
  facilitator?: FacilitatorClient;
  /**
   * Override how the token's EIP-712 domain is obtained.
   *
   * Production reads it from the chain. Tests supply it directly, which keeps
   * the quote path — and therefore most of this suite — off the network
   * entirely. Without this the domain lookup sits on the request path of every
   * first quote, and a test run becomes an RPC availability test.
   */
  resolveDomain?: () => Promise<{ name: string; version: string }>;
  metrics?: Metrics;
  /**
   * World AgentKit verification.
   *
   * Production resolves humans against the real AgentBook on World Chain.
   * Tests inject a gate whose AgentBook lookup is a fixture, so the signature
   * path still runs for real while the suite stays off the network.
   */
  agentKit?: AgentKitGate;
  /** World ID (Selfie Check) — absent or unconfigured means the routes answer 503. */
  worldId?: WorldIdGate;
  /**
   * The persisted audit-log index. When present, log reads are served from it
   * and never touch the RPC on the request path.
   */
  logIndex?: LogIndex;
}

export function createApp(deps: AppDeps) {
  const { config, chain, registry, jobs } = deps;
  const app = new Hono();
  const heartbeatCounters = new Map<string, number>();

  /**
   * The token's EIP-712 domain, read once and reused.
   *
   * Every 402 must advertise it, because the buyer signs against it. Reading it
   * per quote would put an RPC round-trip on the pricing path for a value that
   * cannot change without the token being redeployed. Resolved lazily so the
   * broker still boots when the RPC is briefly unreachable, and re-attempted on
   * the next quote if it fails.
   */
  const readDomain = deps.resolveDomain ?? (() => usdcDomain(config.network));
  let domainCache: { name: string; version: string } | null = null;
  async function paymentDomain(): Promise<{ name: string; version: string }> {
    domainCache ??= await readDomain();
    return domainCache;
  }

  /** Jobs whose receipt is already on chain — see publishReceiptWhenReady. */
  const publishedReceipts = new Set<string>();
  const metrics = deps.metrics ?? new Metrics();
  const agentKit =
    deps.agentKit ??
    createAgentKitGate({
      publicUrl: config.publicUrl,
      worldRpcUrl: process.env.KAZUO_WORLD_RPC_URL?.trim() || undefined,
    });
  const worldId = deps.worldId ?? null;
  const registerUri = `${config.publicUrl}/api/providers/register`;
  const quoteUri = `${config.publicUrl}/api/quotes`;

  const built = deps.facilitator
    ? {
        facilitator: deps.facilitator,
        description: "injected (test)",
        feePayer: config.operatorAddress,
      }
    : buildFacilitator({
        mode: config.facilitatorMode,
        network: config.network,
        feePayerAddress: config.operatorAddress,
        feePayerKey: config.operatorKey,
      });
  const { facilitator, description: facilitatorDescription, feePayer } = built;

  // No `defaultAssets` to configure, because every price this server quotes is
  // an explicit `{asset, amount, extra}` rather than a dollar figure the scheme
  // has to look up. That matters here specifically: the scheme's built-in asset
  // registry has no entry for Arc, so a Money-typed price would resolve to
  // nothing at all.
  const x402Server = new x402ResourceServer(facilitator).register(
    "eip155:*" as Network,
    new ExactEvmScheme(),
  );

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (config.corsOrigins.length === 0) return origin ?? "*";
        return config.corsOrigins.includes(origin) ? origin : config.corsOrigins[0] ?? null;
      },
      // The full set `@x402/fetch` actually puts on the wire, not the set the
      // spec implies. Two of these are non-obvious:
      //
      //   PAYMENT-SIGNATURE — the v2 spelling; the client sends either this or
      //   X-PAYMENT depending on the negotiated version.
      //
      //   Access-Control-Expose-Headers — the client sets this as a REQUEST
      //   header on the payment retry (dist/esm/index.mjs). That is a response
      //   header name and arguably an upstream bug, but a browser dutifully
      //   lists it in the preflight, and a server that does not allow it fails
      //   every retry with "not allowed by Access-Control-Allow-Headers".
      //   Server-side clients never send a preflight, so this only ever breaks
      //   browsers.
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-PAYMENT",
        "X-Payment",
        "PAYMENT-SIGNATURE",
        "Payment-Signature",
        "Access-Control-Expose-Headers",
        // World AgentKit's signed human-backed proof.
        AGENTKIT_HEADER,
      ],
      // Browsers can't read a response header unless it's exposed, and x402
      // carries its whole contract in two of them.
      //
      // `payment-required` is the one that matters and the one that was
      // missing: the 402 puts the `accepts` array — amounts, assets, payTo,
      // feePayer — in that header, not in the body. Server-side clients never
      // noticed, because Node's fetch has no CORS. A browser paying with its
      // own wallet got `null` for it and failed with "Failed to parse payment
      // requirements", which reads like a protocol bug and is really a
      // one-line CORS omission.
      //
      // Both casings of each, because header names are case-insensitive on the
      // wire but this list is matched literally by some proxies.
      exposeHeaders: [
        "X-PAYMENT-RESPONSE",
        "X-Payment-Response",
        // The client asks for this spelling by name; without it the settled
        // transaction id is unreadable even though the payment succeeded.
        "PAYMENT-RESPONSE",
        "Payment-Response",
        "PAYMENT-REQUIRED",
        "Payment-Required",
        "payment-required",
      ],
    }),
  );

  app.onError((err, c) => {
    console.error("[broker]", err);
    metrics.inc("kazuo_errors_total", { path: c.req.path });
    return c.json({ error: err instanceof Error ? err.message : "internal error" }, 500);
  });

  app.use("*", requestLog());
  // 256KB is far above a 20k-char prompt and far below anything worth parsing.
  app.use("*", bodyLimit(256 * 1024));

  // Quoting is free, unauthenticated and reserves a provider — the obvious
  // thing to abuse. The paid route needs no limit of its own: it costs money.
  app.use("/api/quotes", rateLimit({ limit: 30, windowMs: 60_000 }));
  app.use("/api/providers/register", rateLimit({ limit: 10, windowMs: 60_000 }));
  app.use("/api/demo/pay", rateLimit({ limit: 10, windowMs: 60_000 }));

  app.get("/metrics", (c) =>
    c.text(
      metrics.render({
        registry,
        jobs,
        chain,
        connected: deps.getHub()?.connectedCount() ?? 0,
      }),
      200,
      { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    ),
  );

  // Access log for the paid route only. The 402 dance is two requests that look
  // identical except for one header, and "did the client actually retry with a
  // payment?" is the first question worth answering when it goes wrong.
  app.use("/api/jobs/*", async (c, next) => {
    const paid = Boolean(c.req.header("X-PAYMENT") ?? c.req.header("x-payment"));
    await next();
    if (c.req.method === "POST") {
      console.log(
        `[broker] ${c.req.method} ${c.req.path} payment=${paid ? "yes" : "no"} → ${c.res.status}`,
      );
    }
  });

  // -------------------------------------------------------------------------
  // Public: network state
  // -------------------------------------------------------------------------

  app.get("/health", (c) => c.json({ ok: true, at: Date.now() }));

  app.get("/api/network", async (c) => {
    const live = registry.live();
    const allJobs = jobs.list({ limit: 1000 });
    const settled = allJobs.filter((j) => j.payment);
    return c.json({
      network: config.network,
      facilitator: { mode: config.facilitatorMode, description: facilitatorDescription, feePayer },
      operator: {
        address: config.operatorAddress,
        url: explorerAddress(config.network, config.operatorAddress),
      },
      usdc: usdcAddress(config.network),
      log: chain.describeLog(),
      logPublished: chain.counts(),
      logLastError: chain.lastPublishError(),
      stats: {
        providersLive: live.length,
        providersConnected: deps.getHub()?.connectedCount() ?? 0,
        capacity: live.reduce((n, p) => n + p.capabilities.length, 0),
        jobsTotal: allJobs.length,
        jobsCompleted: allJobs.filter((j) => j.status === "completed").length,
        paidUsdMicros: settled.reduce((sum, j) => sum + (j.priceUsdMicros ?? 0), 0),
      },
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
  });

  app.get("/api/providers", (c) => {
    const hub = deps.getHub();
    return c.json({
      providers: registry.list().map((p) => ({
        id: p.id,
        label: p.label,
        address: p.address,
        addressUrl: explorerAddress(config.network, p.address),
        endpoint: p.endpoint,
        status: p.status,
        connected: hub?.isConnected(p.id) ?? false,
        activeJobs: p.activeJobs,
        capabilities: p.capabilities,
        lastHeartbeatAt: p.lastHeartbeatAt,
        registeredAt: p.registeredAt,
        uptimeSeconds: p.uptimeSeconds,
        version: p.version,
        region: p.region,
        stats: p.stats,
        humanBacked: Boolean(p.humanBacked),
        // Which proof backs the label — never the nullifier or human id itself.
        humanProof: p.humanBacked ? (p.humanId?.startsWith("world:") ? "world-id" : "agentkit") : null,
      })),
    });
  });

  // -------------------------------------------------------------------------
  // World ID — Selfie Check, requested and verified by the broker
  // -------------------------------------------------------------------------

  /**
   * Mint a signed World ID request for an address.
   *
   * `purpose: "provider"` binds the proof to a node's payout address;
   * `purpose: "buyer"` to the wallet that will pay. The response is everything
   * IDKit needs to open the request — the RP signing key stays here.
   */
  app.post("/api/worldid/request", async (c) => {
    if (!worldId?.enabled) {
      return c.json({ error: "World ID is not configured on this broker", code: "not_configured" }, 503);
    }
    const body = (await c.req.json().catch(() => ({}))) as { purpose?: string; subject?: string };
    const purpose: WorldPurpose = body.purpose === "buyer" ? "buyer" : "provider";
    try {
      return c.json(worldId.request(purpose, String(body.subject ?? "")));
    } catch (err) {
      return worldIdFailure(c, err);
    }
  });

  /** Check a proof (nonce, freshness, signal binding), forward it to World, record it. */
  app.post("/api/worldid/verify", async (c) => {
    if (!worldId?.enabled) {
      return c.json({ error: "World ID is not configured on this broker", code: "not_configured" }, 503);
    }
    const result = (await c.req.json().catch(() => null)) as WorldProofResult | null;
    try {
      const verification = await worldId.verify(result as WorldProofResult);
      const nodesMarked =
        verification.purpose === "provider"
          ? registry.markHuman(verification.subject, `world:${verification.nullifier}`)
          : 0;
      return c.json({
        verified: true,
        purpose: verification.purpose,
        subject: verification.subject,
        credential: verification.credential,
        verifiedAt: verification.verifiedAt,
        nodesMarked,
      });
    } catch (err) {
      return worldIdFailure(c, err);
    }
  });

  /** Whether an address has a recorded World ID proof. Never exposes the nullifier. */
  app.get("/api/worldid/status", (c) => {
    const subject = c.req.query("subject") ?? "";
    const purpose: WorldPurpose = c.req.query("purpose") === "buyer" ? "buyer" : "provider";
    // Same rule as minting a request: a status for "abc" is not "not verified",
    // it is a malformed question, and answering 200 hides a caller's bug.
    if (!isAccountAddress(subject)) {
      return c.json({ error: "subject must be an EVM address", code: "invalid_subject" }, 400);
    }
    const verification = worldId?.status(purpose, subject) ?? null;
    return c.json({
      enabled: Boolean(worldId?.enabled),
      purpose,
      subject: subject.toLowerCase(),
      verified: Boolean(verification),
      credential: verification?.credential ?? null,
      verifiedAt: verification?.verifiedAt ?? null,
    });
  });

  /**
   * A fresh World AgentKit challenge.
   *
   * `for=register` is signed by a provider's payout key before registering;
   * `for=quote` by a buyer (usually an agent) before asking for a quote. Sign it
   * with `createAgentkitClient(...).createHeader(challenge)` and send the result
   * in the `agentkit` header of that request.
   */
  app.get("/api/agentkit/challenge", (c) => {
    const target = c.req.query("for") === "quote" ? quoteUri : registerUri;
    return c.json({ agentkit: agentKit.challenge(target), header: AGENTKIT_HEADER });
  });

  // -------------------------------------------------------------------------
  // Provider node API (bearer token from registration)
  // -------------------------------------------------------------------------

  app.post("/api/providers/register", async (c) => {
    const body = (await c.req.json()) as RegisterRequest;
    const invalid = validateRegistration(body);
    if (invalid) return c.json({ error: invalid }, 400);

    // Optional: a node that sends a proof must send a valid one, signed by the
    // same address it wants to be paid at. A node that sends none registers as
    // before, just without the label.
    let humanId: string | null = null;
    try {
      const proof = await agentKit.verify(c.req.header(AGENTKIT_HEADER), registerUri, body.address);
      humanId = proof?.humanId ?? null;
      console.log(
        `[broker] register ${body.address}: agentkit ${
          proof ? `proof verified — ${humanId ? "human-backed in AgentBook" : "no human in AgentBook"}` : "no proof sent"
        }`,
      );
    } catch (err) {
      console.warn(`[broker] register ${body.address}: agentkit rejected — ${err instanceof Error ? err.message : err}`);
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 401);
    }

    // A World ID Selfie Check recorded for this payout address counts too.
    const worldProof = worldId?.status("provider", body.address);
    if (!humanId && worldProof) humanId = `world:${worldProof.nullifier}`;

    const provider = registry.register(body, { humanId });

    // Registration is announced on chain, but a slow block must not hold up a
    // node that is ready to work.
    const registryResult = await chain.publishRegistration(provider).catch(() => null);
    if (registryResult) provider.registryTxHash = registryResult.transactionHash;

    return c.json({
      provider: stripSecrets(provider),
      token: provider.token,
      wsUrl: `${config.publicUrl.replace(/^http/, "ws")}/ws/provider?token=${provider.token}`,
      registry: registryResult,
      network: config.network,
      usdc: usdcAddress(config.network),
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
  });

  app.post("/api/providers/:id/heartbeat", async (c) => {
    const provider = authProvider(c.req.header("authorization"));
    if (!provider || provider.id !== c.req.param("id")) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = (await c.req.json()) as HeartbeatRequest;
    const updated = registry.heartbeat(provider.id, {
      activeJobs: body.activeJobs ?? 0,
      uptimeSeconds: body.uptimeSeconds ?? 0,
      available: body.available ?? {},
    });
    if (!updated) return c.json({ error: "unknown provider" }, 404);

    // Sampled, not every beat — see Chain.publishHeartbeat for why.
    const n = (heartbeatCounters.get(provider.id) ?? 0) + 1;
    heartbeatCounters.set(provider.id, n);
    if (n % HEARTBEAT_PUBLISH_EVERY === 1) {
      void chain.publishHeartbeat({
        providerId: provider.id,
        activeJobs: updated.activeJobs,
        capacity: updated.capabilities.length,
        uptimeSeconds: updated.uptimeSeconds,
      });
    }

    return c.json({
      ok: true,
      status: updated.status,
      pending: [],
      brokerEpoch: deps.getHub()?.epoch ?? 0,
    });
  });

  // HTTP fallbacks for nodes that can't hold a socket open.
  app.post("/api/jobs/:id/events", async (c) => {
    const provider = authProvider(c.req.header("authorization"));
    if (!provider) return c.json({ error: "unauthorized" }, 401);
    const job = jobs.get(c.req.param("id"));
    if (!job || job.providerId !== provider.id) return c.json({ error: "not found" }, 404);
    const event = (await c.req.json()) as JobEvent;
    jobs.addEvent(job.id, { ...event, at: event.at || Date.now() });
    return c.json({ ok: true });
  });

  app.post("/api/jobs/:id/result", async (c) => {
    const provider = authProvider(c.req.header("authorization"));
    if (!provider) return c.json({ error: "unauthorized" }, 401);
    const job = jobs.get(c.req.param("id"));
    if (!job || job.providerId !== provider.id) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json()) as { result?: string; error?: string; durationMs?: number };
    if (body.error) {
      void finishJobFailed(job.id, provider.id, body.error, body.durationMs ?? 0);
    } else {
      void finishJobOk(job.id, provider.id, body.result ?? "", body.durationMs ?? 0);
    }
    return c.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Quotes — free, and the thing a payment is pinned to
  // -------------------------------------------------------------------------

  /**
   * Pay a quote from the deployment's demo account, for a visitor with no wallet.
   *
   * The job board used to hold this key itself, as a hosting secret. Here it
   * never leaves the machine the broker runs on, and the payment is still the
   * genuine article: the same x402 client any third party would use, against
   * this broker's own paid route, settling a real transfer on Arc. Capped per
   * job and rate limited, because anyone can press the button.
   */
  app.post("/api/demo/pay", async (c) => {
    const payerKey = process.env.KAZUO_DEMO_PAYER_KEY?.trim();
    if (!payerKey) {
      return c.json(
        { error: "No demo payer configured on this broker. Set KAZUO_DEMO_PAYER_KEY — see .env.example." },
        501,
      );
    }
    const body = (await c.req.json().catch(() => ({}))) as { quoteId?: string };
    const quoteId = body.quoteId?.trim();
    if (!quoteId) return c.json({ error: "quoteId is required" }, 400);
    const quote = jobs.getQuote(quoteId);
    if (!quote) {
      const paidJobId = jobs.paidJobIdForQuote(quoteId);
      if (paidJobId) return c.json({ error: "this quote has already been paid", jobId: paidJobId }, 409);
      return c.json({ error: "quote not found or expired — request a new one" }, 404);
    }
    if (quote.priceUsdMicros > DEMO_MAX_USD_MICROS) {
      return c.json(
        {
          error: `the demo account pays for jobs up to $${(DEMO_MAX_USD_MICROS / 1_000_000).toFixed(2)} — sign in with a wallet for this one`,
        },
        403,
      );
    }

    try {
      const payer = demoAccountFor(payerKey);
      const client = new x402Client();
      registerExactEvmScheme(client, { signer: toClientEvmSigner(payer, demoReadClient(config.network)) });
      const paidFetch = wrapFetchWithPayment(fetch, client);
      const res = await paidFetch(`http://127.0.0.1:${config.port}/api/jobs/${quoteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = (await res.json().catch(() => ({}))) as { jobId?: string; error?: string };
      if (!res.ok || !payload.jobId) {
        const error = payload.error ?? `payment failed (${res.status})`;
        if (res.status === 409) return c.json({ error }, 409);
        if (res.status === 404) return c.json({ error }, 404);
        return c.json({ error }, 502);
      }
      const settlement = new x402HTTPClient(client).getPaymentSettleResponse((name) => res.headers.get(name));
      return c.json({ jobId: payload.jobId, payer: payer.address, transaction: settlement?.transaction ?? null });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  app.post("/api/quotes", async (c) => {
    const body = (await c.req.json()) as JobRequest;
    if (!body?.prompt?.trim()) return c.json({ error: "prompt is required" }, 400);
    if (body.prompt.length > 20_000) return c.json({ error: "prompt is too long (max 20k chars)" }, 400);

    const maxPrice = Number(body.maxPriceUsdMicros);
    if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
      return c.json({ error: "maxPriceUsdMicros must be a positive number" }, 400);
    }

    let buyerHumanBacked = false;
    try {
      const proof = await agentKit.verify(c.req.header(AGENTKIT_HEADER), quoteUri);
      buyerHumanBacked = Boolean(proof?.humanId);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 401);
    }

    const humanBackedOnly = body.humanBackedOnly === true;
    const match = registry.match({
      adapter: body.adapter ?? null,
      maxPriceUsdMicros: maxPrice,
      humanBackedOnly,
    });
    if (!match) {
      const live = registry.live().length;
      return c.json(
        {
          error:
            live === 0
              ? "no providers are online right now — start one with `kazuo start`"
              : humanBackedOnly
                ? `no human-backed provider matches that request under ${formatUsd(maxPrice)}`
                : `no online provider matches that request under ${formatUsd(maxPrice)}`,
          providersLive: live,
        },
        503,
      );
    }

    metrics.inc('kazuo_quotes_total');
    const quote = jobs.createQuote({
      request: { ...body, prompt: body.prompt, maxPriceUsdMicros: maxPrice },
      providerId: match.provider.id,
      providerLabel: match.provider.label,
      providerAddress: match.provider.address,
      capabilityId: match.capability.id,
      capabilityName: match.capability.displayName,
      priceUsdMicros: match.capability.priceUsdMicros,
      usdcAmount: usdMicrosToUsdcUnits(match.capability.priceUsdMicros),
      domain: await paymentDomain(),
      providerHumanBacked: Boolean(match.provider.humanBacked),
      buyerHumanBacked,
    });

    return c.json({
      quoteId: quote.id,
      payUrl: `${config.publicUrl}/api/jobs/${quote.id}`,
      priceUsdMicros: quote.priceUsdMicros,
      priceLabel: formatUsd(quote.priceUsdMicros),
      expiresAt: quote.expiresAt,
      provider: {
        id: match.provider.id,
        label: match.provider.label,
        address: match.provider.address,
        addressUrl: explorerAddress(config.network, match.provider.address),
        capability: match.capability.displayName,
        adapter: match.capability.adapter,
        model: match.capability.model ?? null,
        stats: match.provider.stats,
        humanBacked: Boolean(match.provider.humanBacked),
      },
      buyerHumanBacked,
      // One row, because Arc has one asset. On Hedera this array carried a
      // second entry priced in HBAR at a live exchange rate.
      accepts: [{ asset: usdcAddress(config.network), amount: quote.usdcAmount }],
    });
  });

  // -------------------------------------------------------------------------
  // The paid route
  // -------------------------------------------------------------------------

  /** Pull the quote id out of the request path for the dynamic resolvers. */
  const quoteFromContext = (ctx: HTTPRequestContext): Quote | undefined => {
    const id = ctx.path.split("/").filter(Boolean).pop();
    return id ? jobs.getQuote(id) : undefined;
  };

  const routes: RoutesConfig = {
    "POST /api/jobs/:quoteId": {
      description: "Run one AI job on a live Kazuo provider",
      serviceName: "Kazuo",
      mimeType: "application/json",
      // Every field is read from the quote rather than recomputed — see
      // Quote.usdcAmount for why recomputing here silently breaks
      // correctly-signed payments.
      //
      // One row, where Hedera had two. There is no second asset on Arc.
      accepts: [
        {
          scheme: "exact",
          network: config.network as Network,
          // Straight to the provider — the broker is never the payee.
          payTo: (ctx) => quoteFromContext(ctx)?.providerAddress ?? "",
          price: (ctx) => {
            const quote = quoteFromContext(ctx);
            return {
              asset: usdcAddress(config.network),
              amount: quote?.usdcAmount ?? "0",
              // The EIP-712 domain travels with the price because x402 carries
              // it as `extra` on the requirement. See Quote.domain.
              extra: quote?.domain,
            };
          },
          maxTimeoutSeconds: 300,
        },
      ],
      unpaidResponseBody: (ctx) => {
        const quote = quoteFromContext(ctx);
        return {
          contentType: "application/json",
          body: quote
            ? {
                quoteId: quote.id,
                provider: { id: quote.providerId, label: quote.providerLabel },
                capability: quote.capabilityName,
                priceLabel: formatUsd(quote.priceUsdMicros),
                hint: "Sign the payment with an Arc address holding USDC and retry with the X-PAYMENT header. You need no gas — the facilitator relays it.",
              }
            : { error: "quote not found or expired — request a new one from POST /api/quotes" },
        };
      },
    },
  };

  app.use("/api/jobs/:quoteId", async (c, next) => {
    // Guard before the payment middleware, so an expired quote is a clean 404
    // rather than a 402 quoting a price nobody can pay.
    if (c.req.method !== "POST") return next();
    const quoteId = c.req.param("quoteId") ?? "";
    const quote = jobs.getQuote(quoteId);
    if (!quote) {
      const paidJobId = jobs.paidJobIdForQuote(quoteId);
      if (paidJobId) return c.json({ error: "this quote has already been paid", jobId: paidJobId }, 409);
      return c.json({ error: "quote not found or expired — request a new one" }, 404);
    }
    if (quote.jobId) {
      return c.json({ error: "this quote has already been paid", jobId: quote.jobId }, 409);
    }
    const provider = registry.get(quote.providerId);
    if (!provider || provider.status === "offline") {
      return c.json({ error: "the quoted provider went offline — request a new quote" }, 409);
    }
    return next();
  });

  app.use("/api/jobs/:quoteId", paymentMiddleware(routes, x402Server));

  app.post("/api/jobs/:quoteId", async (c) => {
    const quote = jobs.getQuote(c.req.param("quoteId") ?? "");
    if (!quote) return c.json({ error: "quote expired during payment" }, 409);

    metrics.inc('kazuo_payments_total');
    const job = jobs.createJob(quote);
    // The payment record is filled in from the settle response by the hook
    // below; dispatch does not wait on it.
    dispatch(job);

    return c.json({
      jobId: job.id,
      status: job.status,
      provider: { id: quote.providerId, label: quote.providerLabel },
      capability: quote.capabilityName,
      priceUsdMicros: quote.priceUsdMicros,
      priceLabel: formatUsd(quote.priceUsdMicros),
      streamUrl: `${config.publicUrl}/api/jobs/${job.id}/stream`,
      jobUrl: `${config.publicUrl}/api/jobs/${job.id}`,
    });
  });

  // A rejected payment is the single most confusing failure in this system —
  // the buyer signed something real and got a 402 back — so the reason code goes
  // to the log rather than only into an HTTP status.
  x402Server.onVerifyFailure(async (ctx) => {
    const result = (ctx as { result?: { invalidReason?: string; invalidMessage?: string } }).result;
    const error = (ctx as { error?: Error }).error;
    console.error(
      `[broker] payment verification failed: ${result?.invalidReason ?? error?.message ?? "unknown"}` +
        `${result?.invalidMessage ? ` — ${result.invalidMessage}` : ""}`,
    );
  });

  // A settlement is the one write that must never lose a race for the RPC's
  // rate budget, so background readers (the log index) wait while it runs.
  x402Server.onBeforeSettle(async () => {
    chain.noteWrite?.("start");
  });
  x402Server.onSettleFailure(async () => {
    chain.noteWrite?.("end");
  });

  /**
   * Capture settlement onto the job.
   *
   * The resource server settles after the handler returns, so this hook is the
   * only place with both the on-chain transaction hash and the job it paid for.
   */
  x402Server.onAfterSettle(async (ctx) => {
    chain.noteWrite?.("end");
    const result = ctx.result;
    if (!result?.success || !result.transaction) return;
    const payTo = ctx.requirements.payTo;
    const asset = ctx.requirements.asset;
    const amount = ctx.requirements.amount;

    // Find the job this settlement belongs to: the most recent unpaid job for
    // that provider account. Quote ids are single-use and jobs are created
    // synchronously in the handler just above, so this is unambiguous.
    const candidate = jobs
      .list({ limit: 50 })
      .find((j) => !j.payment && j.providerAddress === payTo);
    if (!candidate) return;

    const record: PaymentRecord = {
      asset: assetKind(asset),
      assetId: asset,
      amount,
      network: config.network,
      transactionHash: result.transaction,
      payer: result.payer ?? "unknown",
      payTo,
      settledAt: Date.now(),
      explorerUrl: explorerTx(config.network, result.transaction),
    };
    jobs.patch(candidate.id, { payment: record });

    // The payer is proven by the signature that just settled, so a buyer label
    // from World ID is only ever applied to the address that actually paid.
    if (record.payer !== "unknown" && worldId?.status("buyer", record.payer)) {
      jobs.patch(candidate.id, { buyerHumanBacked: true });
    }
  });

  // -------------------------------------------------------------------------
  // Job reads
  // -------------------------------------------------------------------------

  app.get("/api/jobs", (c) => {
    const limit = Number(c.req.query("limit") ?? 50);
    const providerId = c.req.query("providerId") ?? undefined;
    return c.json({ jobs: jobs.list({ limit, providerId }).map((job) => publicJob(job)) });
  });

  app.get("/api/jobs/:id", (c) => {
    const job = jobs.get(c.req.param("id"));
    if (!job) return c.json({ error: "not found" }, 404);
    return c.json({ job: publicJob(job, { events: true }) });
  });

  /**
   * Stop a running job.
   *
   * Knowing the job id is the authorisation — ids are 72 bits of randomness and
   * are only ever handed to the buyer who paid. That is a capability URL, and
   * it is the same trust model as the stream endpoint next to it.
   *
   * This does **not** refund. Settlement already happened (see the note at the
   * top of this file), and the provider may have already burned real quota. It
   * stops the work and frees their slot.
   */
  app.post("/api/jobs/:id/cancel", (c) => {
    const job = jobs.get(c.req.param("id"));
    if (!job) return c.json({ error: "not found" }, 404);
    if (job.status === "completed" || job.status === "failed") {
      return c.json({ error: `job is already ${job.status}`, status: job.status }, 409);
    }

    const reason = "cancelled by the buyer";
    if (job.providerId) {
      deps.getHub()?.send(job.providerId, { type: "job.cancel", jobId: job.id, reason });
      registry.jobFinished(job.providerId, { ok: false, durationMs: jobs.runtimeMs(job) });
    }
    jobs.addEvent(job.id, { at: Date.now(), kind: "status", text: reason });
    jobs.fail(job.id, reason);
    metrics.inc("kazuo_jobs_cancelled_total");
    // The payment already settled, so the audit trail still records it — as a
    // failed job. The provider's own late "failed" report is ignored (see
    // finishJobFailed), so this is the one place the receipt goes out.
    void publishReceiptWhenReady(job.id, jobs.runtimeMs(job), false);

    return c.json({ ok: true, jobId: job.id, status: "failed", refunded: false });
  });

  /** Server-sent events: the poster watches their job run, token by token. */
  app.get("/api/jobs/:id/stream", (c) => {
    const job = jobs.get(c.req.param("id"));
    if (!job) return c.json({ error: "not found" }, 404);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const write = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            /* client went away */
          }
        };

        write("snapshot", publicJob(job, { events: true }));

        // A fast job is routinely already finished by the time the client gets
        // here — settlement takes seconds, an echo job takes milliseconds. If
        // we only ever emitted `done` from a subsequent update, that client
        // would wait forever for an event that already happened.
        if (job.status === "completed" || job.status === "failed") {
          write("done", publicJob(job, { events: true }));
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          return;
        }

        const unsubscribe = jobs.subscribeToJob(job.id, (updated, event) => {
          if (event) write("event", event);
          write("job", publicJob(updated));
          if (updated.status === "completed" || updated.status === "failed") {
            write("done", publicJob(updated, { events: true }));
            cleanup();
          }
        });

        // Comment frames keep proxies from closing an idle SSE connection.
        const keepalive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            cleanup();
          }
        }, 15_000);

        function cleanup(): void {
          clearInterval(keepalive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }

        c.req.raw.signal?.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });

  /**
   * The public audit trail, read straight from the chain.
   *
   * Served by the broker for convenience only. Nothing here is privileged —
   * the same entries are readable by anyone from any Arc RPC endpoint, which is
   * the whole point of putting them on chain rather than in our database.
   */
  app.get("/api/receipts", async (c) => {
    const log = chain.describeLog();
    if (!log) return c.json({ receipts: [], log: null });
    if (deps.logIndex) {
      return c.json({
        log,
        receipts: deps.logIndex.entries({ kind: "job.receipt", limit: 50 }).map((e) => ({
          sequence: e.sequence,
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash,
          author: e.author,
          payload: e.payload,
        })),
        sync: deps.logIndex.sync(),
      });
    }
    try {
      const entries = await readLog(config.network, {
        kind: "job.receipt",
        limit: 50,
        address: log.address,
      });
      return c.json({
        log,
        receipts: entries.map((e) => ({
          sequence: e.sequence,
          blockNumber: e.blockNumber,
          transactionHash: e.transactionHash,
          author: e.author,
          payload: e.payload,
        })),
      });
    } catch (err) {
      return c.json({ receipts: [], log, error: (err as Error).message }, 502);
    }
  });

  app.get("/api/log/:kind", async (c) => {
    const kind = c.req.param("kind");
    const map = {
      registry: "provider.registered",
      heartbeat: "provider.heartbeat",
      receipts: "job.receipt",
    } as const;
    const mapped = map[kind as keyof typeof map];
    if (!mapped) return c.json({ error: `unknown log stream "${kind}"` }, 404);
    const log = chain.describeLog();
    if (!log) return c.json({ error: "no audit log contract configured" }, 404);
    if (deps.logIndex) {
      return c.json({ log, entries: deps.logIndex.entries({ kind: mapped, limit: 50 }), sync: deps.logIndex.sync() });
    }
    const entries = await readLog(config.network, {
      kind: mapped,
      limit: 50,
      address: log.address,
    });
    return c.json({ log, entries });
  });

  // -------------------------------------------------------------------------
  // Dispatch + completion
  // -------------------------------------------------------------------------

  function dispatch(job: Job): void {
    const hub = deps.getHub();
    const provider = job.providerId ? registry.get(job.providerId) : undefined;
    if (!provider || !hub) {
      jobs.fail(job.id, "no control channel to the provider");
      return;
    }

    const capability = provider.capabilities.find((cap) => cap.id === job.capabilityId);
    const payload: DispatchedJob = {
      jobId: job.id,
      capabilityId: job.capabilityId ?? capability?.id ?? "",
      prompt: job.request.prompt,
      timeoutMs: JOB_TIMEOUT_MS,
      priceUsdMicros: job.priceUsdMicros ?? 0,
    };

    if (!hub.send(provider.id, { type: "job.dispatch", job: payload })) {
      // The node's socket dropped between quote and payment. Try to find
      // someone else rather than failing a job that has already been paid for.
      if (!reassign(job)) jobs.fail(job.id, "provider disconnected before the job could start");
      return;
    }

    registry.jobStarted(provider.id);
    jobs.setStatus(job.id, "assigned");
  }

  /**
   * Hand an already-paid job to a different provider.
   *
   * The poster is not charged again — the money is already with the first
   * provider, and chasing it back is not worth the complexity. The original
   * provider takes the reputation hit instead, which is the incentive that
   * actually matters to them.
   */
  function reassign(job: Job): boolean {
    const match = registry.match({
      adapter: job.request.adapter ?? null,
      maxPriceUsdMicros: job.request.maxPriceUsdMicros,
    });
    if (!match || match.provider.id === job.providerId) return false;
    const hub = deps.getHub();
    if (!hub) return false;

    const sent = hub.send(match.provider.id, {
      type: "job.dispatch",
      job: {
        jobId: job.id,
        capabilityId: match.capability.id,
        prompt: job.request.prompt,
        timeoutMs: JOB_TIMEOUT_MS,
        priceUsdMicros: job.priceUsdMicros ?? 0,
      },
    });
    if (!sent) return false;

    jobs.patch(job.id, {
      providerId: match.provider.id,
      providerLabel: match.provider.label,
      capabilityId: match.capability.id,
      status: "assigned",
    });
    jobs.addEvent(job.id, {
      at: Date.now(),
      kind: "status",
      text: `reassigned to ${match.provider.label} at no extra charge`,
    });
    registry.jobStarted(match.provider.id);
    return true;
  }

  async function finishJobOk(
    jobId: string,
    providerId: string,
    result: string,
    durationMs: number,
  ): Promise<void> {
    // A terminal job stays terminal: a result racing a cancel must not turn a
    // cancelled job back into a completed one.
    const current = jobs.get(jobId);
    if (!current || current.status === "completed" || current.status === "failed") return;
    const hash = sha256(result);
    const job = jobs.complete(jobId, result, hash);
    if (!job) return;

    const earned = earnings(job);
    registry.jobFinished(providerId, { ok: true, durationMs, ...earned });
    metrics.inc('kazuo_jobs_completed_total');
    metrics.observe('kazuo_job_duration', durationMs);
    void publishReceiptWhenReady(job.id, durationMs, true);
  }

  /**
   * Publish a job's on-chain receipt once there is actually something to attest to.
   *
   * A job routinely finishes *before* its payment is recorded: the resource
   * server settles after the request handler returns, while echo-class work can
   * be done in under a second. Publishing on completion alone produced receipts
   * with an empty transaction id — a receipt that proves nothing. So both
   * triggers call in here, and the first one to find the job terminal *and*
   * paid does the write; the `published` set makes the second a no-op.
   *
   * The grace loop bounds the wait: if settlement never lands (a failed
   * payment, a facilitator error), the receipt still goes out marked unpaid
   * rather than being silently dropped.
   */
  async function publishReceiptWhenReady(
    jobId: string,
    durationMs: number,
    ok: boolean,
  ): Promise<void> {
    if (publishedReceipts.has(jobId)) return;

    const deadline = Date.now() + 20_000;
    let job = jobs.get(jobId);
    while (job && !job.payment && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      job = jobs.get(jobId);
    }
    if (!job) return;
    if (publishedReceipts.has(jobId)) return;
    publishedReceipts.add(jobId);

    const receipt = await chain.publishReceipt({
      jobId: job.id,
      providerId: job.providerId ?? "",
      providerAddress: job.providerAddress ?? "",
      payer: job.payment?.payer ?? "unpaid",
      asset: job.payment?.assetId ?? "",
      amount: job.payment?.amount ?? "0",
      transactionHash: job.payment?.transactionHash ?? "",
      resultHash: job.resultHash ?? "",
      durationMs,
      ok,
    });
    if (receipt) {
      jobs.patch(job.id, { receiptTxHash: receipt.transactionHash });
    } else {
      // Publishing failed; let a later attempt retry rather than marking this
      // job as receipted forever.
      publishedReceipts.delete(jobId);
    }
  }

  async function finishJobFailed(
    jobId: string,
    providerId: string,
    error: string,
    durationMs: number,
  ): Promise<void> {
    const job = jobs.get(jobId);
    if (!job) return;
    // A provider reports "failed" after a buyer cancels — its adapter was killed.
    // Accepting that report overwrote the real reason ("cancelled by the buyer")
    // with the adapter's generic one, counted the failure against the provider a
    // second time, and even tried to reassign a job the buyer had stopped.
    if (job.status === "completed" || job.status === "failed") return;
    registry.jobFinished(providerId, { ok: false, durationMs });
    metrics.inc('kazuo_jobs_failed_total');

    // One free retry elsewhere before the poster is told it failed.
    if (reassign(job)) return;

    jobs.fail(jobId, error);
    await publishReceiptWhenReady(jobId, durationMs, false);
  }

  function earnings(job: Job): { usdcMicros?: number } {
    if (!job.payment) return {};
    return { usdcMicros: usdcUnitsToUsdMicros(job.payment.amount) };
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  function authProvider(header: string | undefined) {
    const token = header?.replace(/^Bearer\s+/i, "").trim();
    return token ? registry.byAuthToken(token) : undefined;
  }

  /**
   * How long a node may be gone before its in-flight jobs are failed over.
   *
   * Short enough that a buyer whose provider process died hears about it in a
   * minute rather than at the ten-minute job ceiling; long enough that a node on
   * flaky wifi reconnects, or delivers over the HTTP fallback, before anyone
   * gives up on it.
   */
  const DISCONNECT_GRACE_MS = 60_000;
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    app,
    hubHandlers: {
      onEvent: (_providerId: string, jobId: string, event: JobEvent) => {
        jobs.addEvent(jobId, { ...event, at: event.at || Date.now() });
      },
      onResult: (providerId: string, jobId: string, result: string, durationMs: number) => {
        void finishJobOk(jobId, providerId, result, durationMs);
      },
      onError: (providerId: string, jobId: string, error: string, durationMs: number) => {
        void finishJobFailed(jobId, providerId, error, durationMs);
      },
      onAccepted: (_providerId: string, jobId: string) => {
        jobs.setStatus(jobId, "running");
      },
      onConnect: (providerId: string) => {
        const provider = registry.get(providerId);
        console.log(`[broker] node connected: ${provider?.label ?? providerId}`);
        clearTimeout(disconnectTimers.get(providerId));
        disconnectTimers.delete(providerId);
      },
      onDisconnect: (providerId: string) => {
        const provider = registry.get(providerId);
        console.log(`[broker] node disconnected: ${provider?.label ?? providerId}`);
        // Before this, a job whose provider died simply waited out the ten-minute
        // ceiling while its buyer — who had already paid — watched "Running".
        clearTimeout(disconnectTimers.get(providerId));
        const timer = setTimeout(() => {
          disconnectTimers.delete(providerId);
          if (deps.getHub()?.isConnected(providerId)) return;
          for (const job of jobs.list({ limit: 500, providerId })) {
            if (job.status !== "assigned" && job.status !== "running") continue;
            console.log(
              `[broker] ${job.id}: provider gone for ${DISCONNECT_GRACE_MS / 1000}s — failing it over`,
            );
            void finishJobFailed(job.id, providerId, "provider disconnected mid-job", jobs.runtimeMs(job));
          }
        }, DISCONNECT_GRACE_MS);
        timer.unref?.();
        disconnectTimers.set(providerId, timer);
      },
    },
    /** Fail jobs that have run past the ceiling; called on a timer. */
    sweep(): void {
      for (const job of jobs.overdue()) {
        void finishJobFailed(job.id, job.providerId ?? "", "job timed out", jobs.runtimeMs(job));
      }
      for (const id of registry.reap()) {
        console.log(`[broker] reaped idle provider ${id}`);
      }
    },
  };
}

function validateRegistration(body: RegisterRequest): string | null {
  if (!body?.label?.trim()) return "label is required";
  if (!body.address || !isAccountAddress(body.address)) {
    return "address must be an EVM address like 0xff21…489B";
  }
  if (!body.nodeId?.trim()) return "nodeId is required";
  if (!Array.isArray(body.capabilities) || body.capabilities.length === 0) {
    return "at least one capability is required";
  }
  for (const cap of body.capabilities as Capability[]) {
    if (!cap.id || !cap.adapter) return "each capability needs an id and an adapter";
    if (!Number.isFinite(cap.priceUsdMicros) || cap.priceUsdMicros <= 0) {
      return `capability "${cap.id}" needs a positive priceUsdMicros`;
    }
  }
  return null;
}

/** Strip the bearer token before a provider record goes anywhere public. */
function worldIdFailure(c: Context, err: unknown) {
  if (err instanceof WorldIdError) return c.json({ error: err.message, code: err.code }, err.status);
  return c.json({ error: err instanceof Error ? err.message : String(err), code: "internal" }, 500);
}

function stripSecrets<T extends { token?: string; humanId?: string | null }>(
  record: T,
): Omit<T, "token" | "humanId"> {
  // The AgentBook human id is pseudonymous but stable across every service
  // that queries it; publishing it would let anyone link one person's nodes.
  const { token: _token, humanId: _humanId, ...rest } = record;
  return rest;
}

function publicJob(job: Job, opts: { events?: boolean } = {}) {
  return {
    id: job.id,
    title: job.request.title ?? null,
    prompt: job.request.prompt,
    adapter: job.request.adapter ?? null,
    status: job.status,
    createdAt: job.createdAt,
    assignedAt: job.assignedAt ?? null,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    providerId: job.providerId ?? null,
    providerLabel: job.providerLabel ?? null,
    providerAddress: job.providerAddress ?? null,
    priceUsdMicros: job.priceUsdMicros ?? null,
    priceLabel: job.priceUsdMicros ? formatUsd(job.priceUsdMicros) : null,
    payment: job.payment ?? null,
    result: job.result ?? null,
    resultHash: job.resultHash ?? null,
    error: job.error ?? null,
    receiptTxHash: job.receiptTxHash ?? null,
    providerHumanBacked: Boolean(job.providerHumanBacked),
    buyerHumanBacked: Boolean(job.buyerHumanBacked),
    eventCount: job.events.length,
    events: opts.events ? job.events : undefined,
  };
}

export type { AdapterKind, JobRequest };
