# Security

Xorv runs untrusted prompts on volunteers' machines and moves real money. This
document says what is protected, what isn't, and where the line is — because a
security page that only lists reassurances is worse than none.

---

## Reporting

Email **niveshgajengi@gmail.com**. Please don't open a public issue for
something exploitable.

---

## The provider risk, stated plainly

**A Xorv provider executes prompts written by strangers, on their own machine,
against their own paid AI subscription.** That is the product, and it is the
risk.

### What Xorv does

- **A fresh empty directory per job**, under `~/.xorv/jobs/`, which is the
  agent's working directory. Agent CLIs resolve relative paths and their own
  permission scopes against cwd, so the blast radius of a hostile prompt is a
  scratch directory rather than the operator's source tree.
- **The directory is deleted when the job ends**, pass or fail.
- **Job ids are sanitised** before being used as path components, so a crafted
  id can't escape the sandbox root.
- **`XORV_SAFE_MODE=1`** disables tools entirely and leaves pure text
  generation. Worth less per job; it cannot touch a disk.
- **Timeouts kill the process group**, not just the direct child, so an
  orphaned model call can't keep burning quota after the job is gone.

### What Xorv does not do

**It does not contain a determined attacker.** These CLIs can run shell
commands, and a shell command can leave a directory. Calling a working directory
a sandbox would be a lie.

If you want a real boundary:

```bash
docker run --rm -it --network none -v xorv-home:/home/node/.xorv node:24 …
```

…or a VM, or a dedicated machine. The threat model to hold in your head is
"someone I have never met gets to run code as me, for a tenth of a cent".

### Terms of service

Most consumer AI subscriptions are licensed to an individual, and reselling that
capacity may breach them. Xorv is infrastructure and does not decide this for
you. Run it against quota you are entitled to share, a plan that permits it, or
your own local models via the `openai-compatible` adapter.

---

## Keys

| Key | Where it lives | Why |
|---|---|---|
| Provider payout key | `~/.xorv/config.json`, mode `0600`, directory `0700` | Hot key — it must sign with no human present. A passphrase would either be typed once and held in memory anyway, or written next to the key. |
| Broker operator key | `.env` (gitignored) or the environment | Pays gas as facilitator and writes HCS. |
| App demo payer key | `.env.local`, server-side only | Never `NEXT_PUBLIC_`. It signs payments. |

Override the provider key with `XORV_PRIVATE_KEY` to keep it in a real secret
manager instead of on disk. Rotate with `xorv wallet new`.

**The CLI never prints a private key to stdout.** `xorv config --json` redacts
it, because that output gets pasted into issues and chat windows.

---

## Payment safety

- **The broker is never the payee.** The 402 names the provider's own account,
  so a compromised broker cannot redirect funds to itself without the buyer's
  client noticing the `payTo` it is signing for.
- **Quotes are single-use.** A replayed payment gets `409`, not a second job.
- **Amounts are frozen at quote time**, so what the buyer signs is exactly what
  was quoted.
- **The facilitator verifies the payer's signature against their on-chain
  account key** and preflights balance and token association before settling.
  Both fail closed.
- **The MCP server carries a hard per-call spending ceiling**
  (`XORV_MAX_USD`, default `$0.05`), enforced client-side as well as by the
  broker. A model that can spend without a bound is a model that can empty an
  account through a loop it did not mean to write.

### What payment safety does *not* cover

Settlement happens **before** the job runs (a signed Hedera transaction is only
valid for 180 seconds — see ARCHITECTURE.md). A provider can therefore take the
money and fail. The mitigation is network-level: the job is reassigned to
another provider at no extra charge, and the failure counts against the original
provider's success rate. **There is no refund path.**

---

## Broker exposure

The broker is designed to face the internet:

- Per-IP rate limits on the free endpoints — quoting reserves a provider for
  five minutes and costs nothing, which is the obvious thing to abuse.
- Body-size limits before parsing; prompts additionally capped at 20k chars.
- Proxy headers (`X-Forwarded-For`) are trusted **only** when
  `XORV_TRUST_PROXY=1`. Trusting them by default makes the limiter useless,
  since anyone can set the header themselves.
- Provider callbacks are authenticated by bearer token **and** checked against
  job ownership, so one provider cannot post results for another's job.
- Bearer tokens are never included in any public response.
- The node's own HTTP face (what a tunnel exposes) is read-only by
  construction — there is no route on it that changes anything — and binds to
  loopback so a node without a tunnel isn't quietly listening on the LAN.

### Known limitations

- **Job ids are capability tokens.** Anyone holding a job id can read it and
  cancel it. Ids are 72 bits of randomness and only ever given to the buyer, but
  there is no buyer authentication.
- **Rate limiting is per-process.** Running more than one broker needs shared
  state.
- **Reputation is gameable.** Success rate is computed from self-reported
  outcomes; a provider that returns garbage quickly scores as well as one that
  does the work.
- **No provider identity verification.** Anyone can register any label and any
  payout account.

These are acceptable for a testnet network and would each need addressing before
mainnet.

---

## On-chain data

Everything published to Hedera Consensus Service is **public and permanent**.
Receipts deliberately carry a **SHA-256 of the result**, never the result
itself, so the payload stays private while the record stays verifiable. Prompts
and results are never published on-chain.

Account ids, amounts and transaction ids are public by nature — that is what
makes the audit trail worth anything.
