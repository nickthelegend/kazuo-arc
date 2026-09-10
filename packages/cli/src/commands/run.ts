/**
 * `xorv run "<prompt>"` — the buyer side.
 *
 * Posts a job, pays for it with a real on-chain transfer over x402, watches it
 * execute on a stranger's machine, and prints the answer plus an ArcScan link.
 * The whole protocol, end to end, in one command and about four seconds.
 *
 * The buyer never broadcasts a transaction. It signs an EIP-3009
 * authorization — typed data, not a transaction — and the facilitator relays
 * it. So this command works from an address holding nothing but USDC, which is
 * the entire point.
 *
 * This is also the honest test of the network: it uses the same public HTTP
 * surface and the same `@x402/*` client any third party would, with no
 * privileged access to the broker.
 */

import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import {
  accountFor,
  formatDuration,
  formatUsd,
  explorerTx,
  networkLabel,
  parseUsd,
  readClient,
  type AdapterKind,
} from "@xorv/protocol";
import { loadConfig } from "../config.js";
import * as ui from "../ui.js";

interface RunOptions {
  broker?: string;
  max?: string;
  adapter?: string;
  account?: string;
  key?: string;
  yes?: boolean;
  json?: boolean;
}

interface QuoteResponse {
  quoteId: string;
  payUrl: string;
  priceUsdMicros: number;
  priceLabel: string;
  expiresAt: number;
  provider: {
    id: string;
    label: string;
    address: string;
    addressUrl: string;
    capability: string;
    adapter: string;
    model: string | null;
    stats: { jobsCompleted: number; jobsFailed: number };
  };
  accepts: Array<{ asset: string; amount: string }>;
}

/**
 * Leave the process, having flushed stdout.
 *
 * Less load-bearing than it was. The Hedera client held gRPC channels open with
 * no handle to close them, so a finished `xorv run` would sit there forever;
 * viem's HTTP transport has no such problem. Kept because the streaming job
 * watcher can still have a socket in flight, and because a CLI that exits
 * deliberately beats one that exits because nothing happened to be pending.
 */
async function exitAfterFlush(code: number): Promise<never> {
  await new Promise<void>((resolve) => {
    if (process.stdout.write("")) resolve();
    else process.stdout.once("drain", () => resolve());
  });
  process.exit(code);
}

/**
 * Fail in whatever shape the caller asked for.
 *
 * `--json` is a contract: a machine is parsing this. Printing prose on the
 * error path breaks every caller that succeeded in parsing the happy path —
 * including the Claude Code skill, which shells out to this exact command.
 */
async function failOut(
  json: boolean | undefined,
  stage: string,
  err: unknown,
  hints: string[] = [],
): Promise<never> {
  const message = err instanceof Error ? err.message : String(err);
  if (json) {
    console.log(JSON.stringify({ status: "failed", stage, error: message, hints }, null, 2));
  } else {
    ui.blank();
    for (const hint of hints) ui.muted(`  ${hint}`);
  }
  await exitAfterFlush(1);
  throw new Error("unreachable");
}

export async function runCommand(prompt: string, opts: RunOptions): Promise<void> {
  const config = loadConfig();
  const brokerUrl = (
    opts.broker ??
    process.env.XORV_BROKER_URL ??
    config?.brokerUrl ??
    "http://localhost:8402"
  ).replace(/\/+$/, "");

  // The buyer's key. Falls back to the node's own payout key, which is handy
  // for a solo demo but means you'd be paying yourself — called out below.
  //
  // Only a key: the address is derived from it. The Hedera version took an
  // account id *and* a key and could not check that they belonged together —
  // a mismatched pair produced INVALID_SIGNATURE on settlement and nothing
  // sooner.
  const rawKey = opts.key ?? process.env.XORV_PAYER_KEY ?? config?.privateKey ?? "";
  const network = config?.network ?? "eip155:5042002";

  if (!rawKey) {
    ui.bad("no payer key — pass --key, or set XORV_PAYER_KEY");
    process.exitCode = 1;
    return;
  }

  let payer;
  try {
    payer = accountFor(rawKey);
  } catch (err) {
    ui.bad(`payer key: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }
  const payerAddress = payer.address;

  if (!opts.json) console.log(ui.banner("post a job"));

  // -- 1. quote -------------------------------------------------------------

  const maxPrice = parseUsd(opts.max ?? "0.05");
  const quoteSpin = opts.json ? null : ui.spinner("finding a live provider…");

  let quote: QuoteResponse;
  try {
    const res = await fetch(`${brokerUrl}/api/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        adapter: (opts.adapter as AdapterKind | undefined) ?? null,
        maxPriceUsdMicros: maxPrice,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json()) as QuoteResponse & { error?: string };
    if (!res.ok) throw new Error(body.error ?? `broker returned ${res.status}`);
    quote = body;
  } catch (err) {
    if (!opts.json) quoteSpin?.fail(`no quote: ${err instanceof Error ? err.message : String(err)}`);
    await failOut(opts.json, "quote", err, [
      "no live provider matched that request under your price ceiling",
      "check with: xorv status",
    ]);
    return;
  }
  quoteSpin?.succeed(`matched ${ui.c.bold(quote.provider.label)}`);

  const usdcOption = quote.accepts[0];

  if (!opts.json) {
    ui.blank();
    console.log(
      ui.box(
        ui.kv([
          ["provider", `${ui.c.bold(quote.provider.label)} ${ui.c.muted(`· ${quote.provider.stats.jobsCompleted} jobs done`)}`],
          ["running", `${quote.provider.capability}${quote.provider.model ? ui.c.muted(` · ${quote.provider.model}`) : ""}`],
          ["price", ui.c.money(ui.c.bold(quote.priceLabel))],
          [
            "paying in",
            `${ui.c.bold("USDC")} ${ui.c.muted(usdcOption ? `(${usdcOption.amount} units)` : "")}`,
          ],
          ["goes to", `${quote.provider.address} ${ui.c.muted("— straight to the provider, not the broker")}`],
          ["from", payerAddress],
          ["gas", ui.c.muted("none — the facilitator relays and pays the fee")],
        ]),
        { title: "quote" },
      ),
    );
    if (payerAddress.toLowerCase() === quote.provider.address.toLowerCase()) {
      ui.blank();
      ui.warn("payer and provider are the same account — you're paying yourself");
    }
    ui.blank();
  }

  if (!opts.yes && !opts.json) {
    const go = await ui.confirm(`pay ${ui.c.money(quote.priceLabel)} and run it?`, true);
    if (!go) {
      ui.info("cancelled — nothing was paid");
      return;
    }
    ui.blank();
  }

  // -- 2. pay ---------------------------------------------------------------

  // No asset-preference policy, because there is only one asset to prefer. On
  // Hedera this had to narrow `accepts` to USDC or HBAR and fall back rather
  // than return an empty list, which would have failed a request the server was
  // perfectly willing to serve.
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
    signer: toClientEvmSigner(payer, readClient(network)),
  });

  const paidFetch = wrapFetchWithPayment(fetch, client);
  const httpClient = new x402HTTPClient(client);
  const paySpin = opts.json
    ? null
    : ui.spinner("signing the authorization and settling on Arc…");

  // Seeded rather than left definite-assigned: the catch below exits the
  // process, but that's an `await` of a never-returning call, which TypeScript's
  // flow analysis doesn't treat as terminal.
  let jobId = "";
  let settleTx: string | null = null;
  try {
    const res = await paidFetch(`${brokerUrl}/api/jobs/${quote.quoteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as { jobId?: string; error?: string };
    if (!res.ok || !body.jobId) {
      throw new Error(body.error ?? `broker returned ${res.status}`);
    }
    jobId = body.jobId;
    settleTx = readSettlementTx(httpClient, res);
  } catch (err) {
    if (!opts.json) paySpin?.fail(`payment failed: ${err instanceof Error ? err.message : String(err)}`);
    await failOut(opts.json, "payment", err, [
      "common causes: the payer holds no USDC, or is the same address as the",
      "provider (you can't pay yourself)",
      "check with: xorv wallet",
    ]);
  }

  paySpin?.succeed(`paid ${ui.c.money(quote.priceLabel)} — job ${ui.c.bold(jobId)}`);
  if (settleTx && !opts.json) {
    ui.ok(`${ui.glyph.chain()} settled on ${networkLabel(network)}`);
    ui.muted(`  ${explorerTx(network, settleTx)}`);
  }

  // -- 3. watch -------------------------------------------------------------

  if (!opts.json) {
    ui.blank();
    ui.heading("running");
  }

  const started = Date.now();
  let final = await watchJob(brokerUrl, jobId, opts.json ?? false);

  if (final?.status === "completed") {
    const spin = opts.json ? null : ui.spinner("waiting for the on-chain receipt…");
    final = await awaitReceipt(brokerUrl, jobId, final);
    if (final?.receiptTxHash) spin?.succeed("receipt appended to the on-chain audit log");
    else spin?.stop();
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          jobId,
          quote,
          settlementTransaction: settleTx,
          arcscan: settleTx ? explorerTx(network, settleTx) : null,
          status: final?.status,
          result: final?.result,
          error: final?.error,
          durationMs: Date.now() - started,
        },
        null,
        2,
      ),
    );
    await exitAfterFlush(final?.status === "completed" ? 0 : 1);
  }

  ui.blank();
  if (final?.status === "completed") {
    console.log(
      ui.box([final.result ?? ""], {
        title: `result · ${formatDuration(Date.now() - started)}`,
        color: ui.BRAND.mint,
      }),
    );
    ui.blank();
    console.log(
      ui.box(
        ui.kv([
          ["paid", ui.c.money(quote.priceLabel)],
          ["to", `${quote.provider.label} ${ui.c.muted(quote.provider.address)}`],
          ["tx", settleTx ? ui.c.accent(settleTx) : ui.c.muted("—")],
          ["arcscan", settleTx ? ui.c.muted(explorerTx(network, settleTx)) : ui.c.muted("—")],
          ["result sha256", ui.c.muted((final.resultHash ?? "").slice(0, 32) + "…")],
          [
            "receipt",
            final.receiptTxHash
              ? ui.c.muted(explorerTx(network, final.receiptTxHash))
              : ui.c.muted("publishing…"),
          ],
        ]),
        { title: "receipt", color: ui.BRAND.azure },
      ),
    );
  } else {
    ui.bad(`job ${final?.status ?? "unknown"}: ${final?.error ?? "no result"}`);
  }
  ui.blank();
  await exitAfterFlush(final?.status === "completed" ? 0 : 1);
}

interface JobView {
  status: string;
  result?: string | null;
  error?: string | null;
  resultHash?: string | null;
  receiptTxHash?: string | null;
}

/**
 * Follow the job's server-sent event stream to completion.
 *
 * Parsed by hand rather than with EventSource, which Node still doesn't expose
 * on the global in every supported version — and a hand-rolled reader is a
 * dozen lines against a dependency and a polyfill.
 */
async function watchJob(brokerUrl: string, jobId: string, quiet: boolean): Promise<JobView | null> {
  const res = await fetch(`${brokerUrl}/api/jobs/${jobId}/stream`, {
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok || !res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: JobView | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const name = eventLine?.slice(6).trim();
      let payload: unknown;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      if (name === "event" && !quiet) {
        const event = payload as { kind: string; text: string };
        printEvent(event.kind, event.text);
      } else if (name === "job" || name === "snapshot" || name === "done") {
        last = payload as JobView;
        // Terminal on the snapshot too: the job can finish before this stream
        // is even opened, and waiting for a `done` that already fired would
        // hang the command forever.
        if (name === "done" || last.status === "completed" || last.status === "failed") {
          reader.cancel().catch(() => {});
          return last;
        }
      }
    }
  }
  return last;
}

function printEvent(kind: string, text: string): void {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;
  const line = clean.slice(0, ui.width() - 6);
  switch (kind) {
    case "tool_call":
      console.log(`  ${ui.c.accent("⚙")} ${ui.c.muted(line)}`);
      break;
    case "file_edit":
      console.log(`  ${ui.c.warn("✎")} ${ui.c.muted(line)}`);
      break;
    case "reasoning":
      console.log(`  ${ui.c.muted("…")} ${ui.c.muted(line)}`);
      break;
    case "error":
      console.log(`  ${ui.glyph.bad()} ${ui.c.bad(line)}`);
      break;
    case "message":
      console.log(`  ${ui.c.accent("▸")} ${line}`);
      break;
    default:
      console.log(`  ${ui.glyph.dot()} ${ui.c.muted(line)}`);
  }
}

/**
 * Pull the settled transaction hash off the response.
 *
 * Goes through the protocol client's own reader rather than base64-decoding the
 * header by hand: the header's name and encoding are x402's to change, and a
 * hand-rolled parser that silently returns null on a format change would show
 * "—" where the on-chain proof should be.
 */
function readSettlementTx(httpClient: x402HTTPClient, res: Response): string | null {
  try {
    const settlement = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    return settlement?.transaction ?? null;
  } catch {
    return null;
  }
}

/**
 * Wait for the broker's on-chain receipt to land.
 *
 * The receipt is written after settlement, so a fast job outruns it. Polling
 * briefly here means the command's final output carries the audit link instead
 * of "publishing…", and giving up quietly after the window keeps a slow topic
 * from holding the terminal.
 */
async function awaitReceipt(
  brokerUrl: string,
  jobId: string,
  current: JobView | null,
  timeoutMs = 25_000,
): Promise<JobView | null> {
  if (current?.receiptTxHash) return current;
  const deadline = Date.now() + timeoutMs;
  let latest = current;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    try {
      const res = await fetch(`${brokerUrl}/api/jobs/${jobId}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { job: JobView };
      latest = body.job;
      if (latest.receiptTxHash) return latest;
    } catch {
      /* keep trying until the deadline */
    }
  }
  return latest;
}
