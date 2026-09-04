<div align="center">

<img src="brand/xorv-logo.svg" alt="Xorv" width="260" />

**A decentralized AI capacity network.**
Rent out the Claude / Codex / Grok subscription you already pay for, and get paid **per job in USDC over [x402](https://x402.org) on [Hedera](https://hedera.com)**.

[![x402](https://img.shields.io/badge/x402-v2-7C5CFF?style=flat-square)](https://x402.org)
[![Hedera](https://img.shields.io/badge/Hedera-testnet-3DDCFF?style=flat-square)](https://hashscan.io/testnet)
[![License](https://img.shields.io/badge/license-MIT-50F0C8?style=flat-square)](LICENSE)

</div>

---

## The idea

Millions of people pay ~$20–200/month for an AI subscription and use a fraction of it. Meanwhile
anyone who wants a one-off coding task done has to buy their own plan or an API key.

Xorv connects the two. You run one command, your machine joins the network, and jobs from strangers
run on the quota you were already paying for. Each job settles as a **real on-chain transfer,
directly from the buyer to you** — no invoices, no platform float, no payout schedule.

```bash
npm i -g xorv && xorv init && xorv start
```

---

## What makes it work

**HTTP 402 finally means something.** x402 turns "Payment Required" into a working rail: the server
answers 402 with machine-readable payment terms, the client signs, and the same request succeeds a
round-trip later. No checkout, no accounts, no API keys.

**Hedera makes sub-cent pricing real.** Three properties this specifically needs:

| Property | Why it matters here |
|---|---|
| Fixed fees (~$0.0001) | A $0.001 job isn't eaten by gas |
| ~3s finality | The buyer isn't waiting on confirmations |
| Native fee-payer model | **Buyers never need HBAR** — Xorv's facilitator pays the gas |
| Consensus Service | A public, ordered audit log without deploying a contract |

**The broker never touches the money.** The 402 response names the *matched provider's own Hedera
account* as `payTo`. Funds move buyer → provider in one transfer. Protocol fee is 0%.

---

## The flow

```
  buyer                     broker                    provider node
    │                          │                            │
    │  POST /api/quotes        │                            │
    ├─────────────────────────►│  match on price + liveness │
    │  ◄─── quote (provider,   │                            │
    │        price, expiry)    │                            │
    │                          │                            │
    │  POST /api/jobs/:quote   │                            │
    ├─────────────────────────►│                            │
    │  ◄─── 402 + accepts[]    │  USDC · HBAR               │
    │                          │                            │
    │  signs a Hedera transfer │                            │
    │  X-PAYMENT ─────────────►│  facilitator co-signs,     │
    │                          │  pays gas, submits ──────► Hedera
    │  ◄─── 200 + job id       │  ~3s, settled              │
    │       X-PAYMENT-RESPONSE │                            │
    │                          ├──── job.dispatch ─────────►│
    │  ◄═══ SSE: live events ══╪◄═══ tool calls, edits ═════┤
    │  ◄─── result             │◄──── answer ───────────────┤
    │                          ├──── receipt ─────────────► HCS topic
```

Payment settles **before** the job runs. That isn't laziness: a signed Hedera transaction is only
valid for 180 seconds, so waiting for a five-minute coding job would leave the provider unpaid for
work already done. The other risk is covered at the network level — a failed job is **reassigned to
another provider at no extra charge**, and the failure counts against the original provider's
success rate, which is what the matcher sorts on.

---

## Repo layout

```
xorv/
├── packages/
│   ├── cli/          xorv — the provider node (published to npm as `xorv`)
│   └── protocol/     @xorv/protocol — shared types, money math, Hedera + x402 wiring
├── services/
│   └── broker/       @xorv/broker — registry, matching, x402 gating, self-hosted facilitator
├── apps/
│   ├── app/          xorv-app — the job board (Next.js)
│   └── landing/      xorv-landing — marketing site (Next.js + GSAP)
└── brand/            logo + mark
```

---

## Quickstart

Needs Node ≥ 20.11 and pnpm. A funded Hedera **testnet** account takes ~60s at
[portal.hedera.com](https://portal.hedera.com).

```bash
git clone https://github.com/nickthelegend/xorv.git
cd xorv && pnpm install
cp .env.example .env          # paste your operator id + key
pnpm --filter @xorv/broker setup   # creates the 3 HCS topics + demo accounts
pnpm build
```

Then, in three terminals:

```bash
pnpm broker      # coordinator + facilitator on :8402
xorv start       # your provider node
pnpm app         # job board on :3002
```

Post a job from the terminal, end to end:

```bash
xorv run "Explain what a Merkle tree is, briefly." --max 0.02
```

<details>
<summary><b>What that prints</b></summary>

```
✔ matched nivesh-macbook
╭─ quote ──────────────────────────────────────────────────╮
│ provider   nivesh-macbook · 12 jobs done                 │
│ price      $0.0010                                       │
│ goes to    0.0.9848438 — straight to the provider        │
╰──────────────────────────────────────────────────────────╯
✔ paid $0.0010 — job job_TwzS96BhAx81
✔ ⛓ settled on testnet
  https://hashscan.io/testnet/transaction/0.0.9842030-1785475156-150213566
```

</details>

---

## The CLI

The provider node. Full docs in [`packages/cli/README.md`](packages/cli/README.md).

| Command | What it does |
|---|---|
| `xorv init` | Interactive setup — probes your agent CLIs, generates or imports a payout account |
| `xorv start` | Go live: register, hold the control channel, run jobs, live earnings dashboard |
| `xorv run "…"` | The buyer side — post a job and pay for it over x402 |
| `xorv status` | Who's live on the network, and what they charge |
| `xorv earnings` | What this machine has made, with sparklines and on-chain balance |
| `xorv doctor` | Every reason this node might not be earning, each with the fix |
| `xorv wallet` | Balances, USDC association, key rotation |

### Adapters

An adapter drives a CLI you already have installed and signed in. Xorv never asks for an API key,
because it never calls an API on your behalf.

`claude-code` · `codex` · `grok` · `opencode` · `openai-compatible` (Ollama, LM Studio, vLLM,
OpenRouter…) · `echo` (built in, always works — exercises the whole payment path with nothing
installed)

---

## Live on Hedera testnet

Everything below is real and checkable.

| | |
|---|---|
| Network | `hedera:testnet` |
| USDC | [`0.0.429274`](https://hashscan.io/testnet/token/0.0.429274) |
| Registry topic | [`0.0.9848245`](https://hashscan.io/testnet/topic/0.0.9848245) |
| Heartbeat topic | [`0.0.9848246`](https://hashscan.io/testnet/topic/0.0.9848246) |
| Receipts topic | [`0.0.9848247`](https://hashscan.io/testnet/topic/0.0.9848247) |

**A real Claude Code job, paid for over x402.** Prompt in, working Python out, $0.0100 moved from
buyer to provider on-chain:

| | |
|---|---|
| Job | `job_2eHjgDqDuMyv` · adapter `claude-code` · $0.0100 |
| Payment | [`0.0.9842030@1785475549.131327424`](https://hashscan.io/testnet/transaction/0.0.9842030-1785475549-131327424) — buyer `0.0.9848440` → provider `0.0.9848438` |
| HCS receipt | [`0.0.9842030@1785475558.951801626`](https://hashscan.io/testnet/transaction/0.0.9842030-1785475558-951801626) |

Earlier echo-adapter settlements on the same topics:
[transfer](https://hashscan.io/testnet/transaction/0.0.9842030-1785475156-150213566)
· [receipt](https://hashscan.io/testnet/transaction/0.0.9842030-1785475156-278830202)

Each receipt carries the job id, both accounts, the amount, the settlement transaction id and a
**SHA-256 of the result** — so the payload stays private while the record stays verifiable.

---

## Security — read this before running a node

A Xorv provider runs prompts written by people they have never met, on their own machine, against
their own paid account. That is the product, and it is also the risk.

**What Xorv does:** every job gets a fresh empty directory under `~/.xorv/jobs/` as its working
directory, deleted when the job ends. Agent CLIs resolve relative paths and permission scopes
against cwd, so the blast radius of a hostile prompt is a scratch directory rather than your source
tree.

**What Xorv does not do:** contain a determined attacker. These CLIs can run shell commands, and a
shell command can leave a directory. This is blast-radius reduction, not a sandbox.

**If you want a real boundary,** run the node in a container or a VM. Or set `XORV_SAFE_MODE=1`,
which disables tools entirely and leaves a pure text-generation service — worth less per job, but it
cannot touch a disk.

**On terms of service:** most consumer AI subscriptions are licensed to an individual and reselling
that capacity may breach them. Xorv is infrastructure and doesn't decide this for you — run it
against quota you're entitled to share, a plan that permits it, or your own local models via the
OpenAI-compatible adapter.

---

## Design notes

A few decisions that aren't obvious:

- **Provider nodes dial out.** The node opens a WebSocket *to* the broker rather than the broker
  calling in. Someone sharing a laptop is behind NAT, on hotel wifi, on a machine that sleeps —
  outbound works from all of those with no port forwarding and no inbound attack surface. A
  Cloudflare tunnel is supported and useful (public status page, second delivery path) but earnings
  never depend on it.
- **The broker's state is deliberately in memory.** Membership *is* liveness — a provider is only
  real while heartbeats keep arriving. The durable half goes to HCS, where it's public and
  append-only rather than trapped in our database.
- **A quote is a first-class object.** x402 asks the server for payment requirements twice (once to
  answer 402, once to check the payment). Both answers must name the same provider at the same
  price, so the amounts are frozen at quote time — including the HBAR figure, which derives from a
  live exchange rate read from the Mirror Node.
- **Settlement gets its own SDK client, built fresh per payment.** The payload is a transaction
  frozen by the *payer's* client; submitting one mutates the submitting client's internal state, and
  reusing it makes every payment after the first fail deep inside the SDK. This one cost real
  debugging time.

---

## License

MIT — see [LICENSE](LICENSE).

Built for the [Hedera x402 bounty](https://hedera.com/x402-bounty/).
Part of the [Loompad](https://loompad.tech) ecosystem.
