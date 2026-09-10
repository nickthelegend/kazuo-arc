#!/usr/bin/env node
/**
 * Kazuo as an MCP server.
 *
 * This is the part of the story x402 was actually invented for: an agent that
 * needs work done finds capacity, pays for it, and gets the result — without a
 * human opening a browser, creating an account, or pasting a card number. The
 * agent holds an Arc key, the network quotes a price, the payment settles in
 * about a second, and the job runs on a stranger's machine.
 *
 * The agent never broadcasts a transaction and needs no gas token. It signs an
 * EIP-3009 authorization and a facilitator relays it — which is what makes an
 * autonomous wallet holding nothing but USDC a workable thing to give a model.
 *
 * Point any MCP client at it:
 *
 *   claude mcp add kazuo -- npx -y @kazuo/mcp
 *
 * Configuration is environment-only, because an MCP server is launched by
 * another program and has no terminal to prompt at:
 *
 *   KAZUO_BROKER_URL   broker to buy from (default http://localhost:8402)
 *   KAZUO_PAYER_KEY    the private key that pays for jobs (the address is
 *                     derived from it — there is nothing else to configure)
 *   KAZUO_NETWORK      default eip155:5042002 (Arc testnet)
 *   KAZUO_MAX_USD      hard ceiling per job, default 0.05 — see below
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { accountFor, formatUsd, explorerTx, parseUsd, readClient } from "@kazuo/protocol";
import { createAgentkitClient, type AgentkitExtension } from "@worldcoin/agentkit";

/**
 * A World AgentKit proof for a quote, signed by the payer key.
 *
 * An agent buying compute is exactly what AgentKit exists to label: if the
 * payer address is registered in AgentBook to a human, the broker records the
 * job as bought by a human-backed agent. Never fatal — no key, no challenge,
 * or an unregistered address all just mean no label.
 */
async function agentkitQuoteHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!PAYER_KEY || process.env.KAZUO_AGENTKIT === "0") return headers;
  try {
    const res = await fetch(`${BROKER_URL}/api/agentkit/challenge?for=quote`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return headers;
    const { agentkit } = (await res.json()) as { agentkit?: AgentkitExtension };
    if (!agentkit) return headers;
    const account = accountFor(PAYER_KEY);
    const client = createAgentkitClient({
      signer: {
        address: account.address,
        chainId: "eip155:480",
        type: "eip191",
        signMessage: (message) => account.signMessage({ message }),
      },
    });
    headers.agentkit = await client.createHeader(agentkit);
  } catch {
    /* no label, same job */
  }
  return headers;
}

const BROKER_URL = (process.env.KAZUO_BROKER_URL ?? "http://localhost:8402").replace(/\/+$/, "");
const NETWORK = process.env.KAZUO_NETWORK ?? "eip155:5042002";
const PAYER_KEY = process.env.KAZUO_PAYER_KEY?.trim();

/**
 * A hard spending ceiling per job.
 *
 * An MCP server is driven by a model, and a model that can spend without a
 * bound is a model that can empty an account through a loop it didn't mean to
 * write. The tool schema lets the caller ask for less than this; nothing lets
 * it ask for more.
 */
const MAX_USD_MICROS = parseUsd(process.env.KAZUO_MAX_USD ?? "0.05");

interface QuoteResponse {
  quoteId: string;
  priceUsdMicros: number;
  priceLabel: string;
  expiresAt: number;
  provider: {
    id: string;
    label: string;
    address: string;
    capability: string;
    adapter: string;
    model: string | null;
    stats: { jobsCompleted: number; jobsFailed: number };
    humanBacked?: boolean;
  };
  accepts: Array<{ asset: string; amount: string }>;
  error?: string;
}

interface JobView {
  id: string;
  status: string;
  result: string | null;
  error: string | null;
  resultHash: string | null;
  priceLabel: string | null;
  providerLabel: string | null;
  receiptTxHash: string | null;
  payment: { transactionHash: string; explorerUrl: string; asset: string } | null;
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BROKER_URL}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Build a paying fetch. Throws when no key is configured — read-only still works. */
function payingClient() {
  if (!PAYER_KEY) {
    throw new Error(
      "No payer configured. Set KAZUO_PAYER_KEY in this MCP server's environment to let it buy jobs.",
    );
  }
  const payer = accountFor(PAYER_KEY);
  const client = new x402Client();
  // Registered as the `eip155:*` wildcard rather than one named network, which
  // `registerExactEvmScheme` does when `networks` is omitted.
  //
  // This is a correctness fix, not a shortcut. Pinning the client to a network
  // read from *local* config means a buyer can only pay a broker that happens
  // to match their own node's configuration — and the failure is baffling:
  // the 402 arrives correctly, the requirements are valid, and the client
  // refuses with "no network/scheme registered" while naming two networks that
  // look fine in isolation. A buyer should be able to pay whatever the broker
  // quotes.
  //
  // Nothing is lost by widening it. The EIP-712 domain binds the signature to a
  // specific chain id and verifying contract, so an authorization signed for one
  // network cannot be replayed on another, and the price ceiling still applies.
  registerExactEvmScheme(client, {
    signer: toClientEvmSigner(payer, readClient(NETWORK)),
  });
  // No asset-preference policy: Arc has one asset. On Hedera this had to pick
  // between USDC and HBAR and fall back rather than return an empty list.
  return { paidFetch: wrapFetchWithPayment(fetch, client), httpClient: new x402HTTPClient(client) };
}

const server = new McpServer({ name: "kazuo", version: "0.1.0" });

// ---------------------------------------------------------------------------
// Read-only tools — no key needed
// ---------------------------------------------------------------------------

server.tool(
  "kazuo_list_providers",
  "List the AI providers currently live on the Kazuo network, what models they run, and what they charge per job. Use this before buying to see what capacity is available.",
  {},
  async () => {
    try {
      const { providers } = await getJson<{
        providers: Array<{
          label: string;
          status: string;
          address: string;
          region: string | null;
          capabilities: Array<{ displayName: string; adapter: string; priceUsdMicros: number }>;
          stats: { jobsCompleted: number; jobsFailed: number };
        }>;
      }>("/api/providers");

      const live = providers.filter((p) => p.status !== "offline");
      if (live.length === 0) {
        return text(
          "No providers are online right now. Anyone can start one with `npm i -g @kazuo/cli && kazuo init && kazuo start`.",
        );
      }

      const lines = live.map((p) => {
        const caps = p.capabilities
          .map((c) => `${c.displayName} (${c.adapter}) ${formatUsd(c.priceUsdMicros)}/job`)
          .join(", ");
        return `- ${p.label} [${p.status}]${p.region ? ` · ${p.region}` : ""} — ${caps} · ${p.stats.jobsCompleted} jobs done, ${p.stats.jobsFailed} failed · pays to ${p.address}`;
      });
      return text(`${live.length} provider(s) live on ${NETWORK}:\n${lines.join("\n")}`);
    } catch (err) {
      return fail(`Could not reach the Kazuo broker at ${BROKER_URL}: ${String(err)}`);
    }
  },
);

server.tool(
  "kazuo_network_status",
  "Show the Kazuo network's overall state: how many providers are live, how many jobs have settled, the facilitator, and the on-chain audit log carrying the public record.",
  {},
  async () => {
    try {
      const info = await getJson<{
        network: string;
        facilitator: { description: string; feePayer: string };
        usdc: string;
        log: { address: string; url: string } | null;
        stats: {
          providersLive: number;
          jobsTotal: number;
          jobsCompleted: number;
          paidUsdMicros: number;
        };
      }>("/api/network");


      return text(
        [
          `Network: ${info.network}`,
          `Facilitator: ${info.facilitator.description} (gas paid by ${info.facilitator.feePayer})`,
          `USDC token: ${info.usdc}`,
          `Providers live: ${info.stats.providersLive}`,
          `Jobs: ${info.stats.jobsCompleted} completed of ${info.stats.jobsTotal}`,
          `Settled: ${formatUsd(info.stats.paidUsdMicros)}`,
          `Audit log (public, on chain): ${info.log ? `${info.log.address} — ${info.log.url}` : "not configured"}`,
        ].join("\n"),
      );
    } catch (err) {
      return fail(`Could not reach the Kazuo broker at ${BROKER_URL}: ${String(err)}`);
    }
  },
);

server.tool(
  "kazuo_quote",
  "Get a price for a job WITHOUT paying for it. Returns which provider would run it and what it would cost. Use this to check the price before calling kazuo_run_job.",
  {
    prompt: z.string().min(1).describe("The job to price."),
    adapter: z
      .string()
      .optional()
      .describe("Require a specific adapter: claude-code, codex, grok, opencode, openai-compatible."),
    max_usd: z.number().positive().optional().describe("Most you'd pay, in US dollars."),
    human_backed_only: z
      .boolean()
      .optional()
      .describe("Only quote providers whose operator proved they are a real human with World ID (AgentKit)."),
  },
  async ({ prompt, adapter, max_usd, human_backed_only }) => {
    const ceiling = Math.min(max_usd ? parseUsd(max_usd) : MAX_USD_MICROS, MAX_USD_MICROS);
    try {
      const res = await fetch(`${BROKER_URL}/api/quotes`, {
        method: "POST",
        headers: await agentkitQuoteHeaders(),
        body: JSON.stringify({
          prompt,
          adapter: adapter ?? null,
          maxPriceUsdMicros: ceiling,
          humanBackedOnly: Boolean(human_backed_only),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const quote = (await res.json()) as QuoteResponse;
      if (!res.ok) return fail(quote.error ?? `Broker returned ${res.status}`);

      return text(
        [
          `Quote ${quote.quoteId} (expires in ${Math.round((quote.expiresAt - Date.now()) / 1000)}s)`,
          `Price: ${quote.priceLabel}`,
          `Provider: ${quote.provider.label} running ${quote.provider.capability}${quote.provider.model ? ` (${quote.provider.model})` : ""}`,
          `Track record: ${quote.provider.stats.jobsCompleted} completed, ${quote.provider.stats.jobsFailed} failed`,
          `Human-backed provider (World ID): ${quote.provider.humanBacked ? "yes" : "no"}`,
          `Payment goes directly to ${quote.provider.address} — the broker never holds it.`,
          `Payable in: USDC (${quote.accepts[0]?.amount ?? "?"} units). You need no gas — the facilitator relays and pays the fee.`,
        ].join("\n"),
      );
    } catch (err) {
      return fail(`Quote failed: ${String(err)}`);
    }
  },
);

// ---------------------------------------------------------------------------
// The paying tool
// ---------------------------------------------------------------------------

server.tool(
  "kazuo_run_job",
  `Run an AI job on the Kazuo network and PAY FOR IT with a real on-chain transfer. This spends money — at most ${formatUsd(MAX_USD_MICROS)} per call. The job runs on someone else's machine using their AI subscription, and they are paid directly. Returns the result plus an ArcScan link proving the payment.`,
  {
    prompt: z.string().min(1).describe("The job to run."),
    adapter: z
      .string()
      .optional()
      .describe("Require a specific adapter: claude-code, codex, grok, opencode, openai-compatible."),
    max_usd: z
      .number()
      .positive()
      .optional()
      .describe(`Most to pay in US dollars. Capped at ${formatUsd(MAX_USD_MICROS)} regardless.`),
    human_backed_only: z
      .boolean()
      .optional()
      .describe("Only use providers whose operator proved they are a real human with World ID (AgentKit)."),
    // No `pay_with`: there is one asset on Arc, and offering a choice the
    // network cannot honour is worse than not offering one.
  },
  async ({ prompt, adapter, max_usd, human_backed_only }) => {
    const ceiling = Math.min(max_usd ? parseUsd(max_usd) : MAX_USD_MICROS, MAX_USD_MICROS);

    let paidFetch: typeof fetch;
    let httpClient: x402HTTPClient;
    try {
      const built = payingClient();
      paidFetch = built.paidFetch as typeof fetch;
      httpClient = built.httpClient;
    } catch (err) {
      return fail(String(err instanceof Error ? err.message : err));
    }

    try {
      // 1. Quote — so the price is pinned and we can refuse it before paying.
      const quoteRes = await fetch(`${BROKER_URL}/api/quotes`, {
        method: "POST",
        headers: await agentkitQuoteHeaders(),
        body: JSON.stringify({
          prompt,
          adapter: adapter ?? null,
          maxPriceUsdMicros: ceiling,
          humanBackedOnly: Boolean(human_backed_only),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const quote = (await quoteRes.json()) as QuoteResponse;
      if (!quoteRes.ok) return fail(quote.error ?? `No quote: broker returned ${quoteRes.status}`);

      // Belt and braces: the ceiling is enforced here too, not only server-side.
      if (quote.priceUsdMicros > ceiling) {
        return fail(
          `Refusing to pay ${quote.priceLabel}, which is over the ${formatUsd(ceiling)} limit.`,
        );
      }

      // 2. Pay. The 402 dance happens inside paidFetch.
      const payRes = await paidFetch(`${BROKER_URL}/api/jobs/${quote.quoteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const paid = (await payRes.json()) as { jobId?: string; error?: string };
      if (!payRes.ok || !paid.jobId) {
        return fail(
          `Payment failed (${payRes.status}): ${paid.error ?? "the payer may hold no USDC, or not be associated with the token"}`,
        );
      }
      const settlement = httpClient.getPaymentSettleResponse((n) => payRes.headers.get(n));

      // 3. Wait for the answer.
      const job = await pollUntilDone(paid.jobId, 10 * 60_000);

      if (job.status !== "completed") {
        return fail(`Job ${job.status}: ${job.error ?? "no result"}`);
      }

      const proof = settlement?.transaction
        ? `\n\n---\nPaid ${quote.priceLabel} to ${quote.provider.label} (${quote.provider.address})\nTransaction: ${explorerTx(NETWORK, settlement.transaction)}${
            job.receiptTxHash
              ? `\nOn-chain receipt: ${explorerTx(NETWORK, job.receiptTxHash)}`
              : ""
          }`
        : "";

      return text(`${job.result ?? ""}${proof}`);
    } catch (err) {
      return fail(`Job failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
);

server.tool(
  "kazuo_get_job",
  "Look up a Kazuo job by id — its status, result, and the on-chain payment record.",
  { job_id: z.string().describe("The job id, e.g. job_TwzS96BhAx81.") },
  async ({ job_id }) => {
    try {
      const { job } = await getJson<{ job: JobView }>(`/api/jobs/${job_id}`);
      return text(
        [
          `Job ${job.id} — ${job.status}`,
          `Provider: ${job.providerLabel ?? "unassigned"}`,
          `Price: ${job.priceLabel ?? "—"}`,
          job.payment ? `Payment: ${job.payment.explorerUrl}` : "Payment: not settled",
          job.resultHash ? `Result sha256: ${job.resultHash}` : "",
          "",
          job.result ?? job.error ?? "(no result yet)",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (err) {
      return fail(`Could not read job ${job_id}: ${String(err)}`);
    }
  },
);

/**
 * Poll a job to completion.
 *
 * Polling rather than SSE: an MCP tool call is a request/response, there is no
 * one watching a stream, and a 2s poll against a job that takes seconds to
 * minutes is not worth a streaming client's failure modes.
 */
async function pollUntilDone(jobId: string, timeoutMs: number): Promise<JobView> {
  const deadline = Date.now() + timeoutMs;
  let last: JobView | null = null;
  while (Date.now() < deadline) {
    try {
      const { job } = await getJson<{ job: JobView }>(`/api/jobs/${jobId}`);
      last = job;
      if (job.status === "completed" || job.status === "failed") {
        // Give the on-chain receipt a moment so the proof link is in the answer.
        if (job.status === "completed" && !job.receiptTxHash) {
          await new Promise((r) => setTimeout(r, 4_000));
          const { job: withReceipt } = await getJson<{ job: JobView }>(`/api/jobs/${jobId}`);
          return withReceipt;
        }
        return job;
      }
    } catch {
      // Transient broker blip; keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return last ?? { id: jobId, status: "timed out", result: null, error: "timed out waiting for the provider", resultHash: null, priceLabel: null, providerLabel: null, receiptTxHash: null, payment: null };
}

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr, never stdout: stdout is the JSON-RPC channel and anything else on it
// corrupts the protocol.
console.error(`[kazuo-mcp] ready — broker ${BROKER_URL}, network ${NETWORK}, cap ${formatUsd(MAX_USD_MICROS)}/job`);
