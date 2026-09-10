<div align="center">

<img src="brand/kazuo-logo.svg" alt="Kazuo" width="260" />

**A decentralized AI capacity network.**
Rent out the Claude / Codex / Grok subscription you already pay for, and get paid **per job in USDC over [x402](https://x402.org) on [Arc](https://www.arc.io/)**.

[![x402](https://img.shields.io/badge/x402-v2-7C5CFF?style=flat-square)](https://x402.org)
[![Arc](https://img.shields.io/badge/Arc-testnet-3DDCFF?style=flat-square)](https://testnet.arcscan.app)
[![License](https://img.shields.io/badge/license-MIT-50F0C8?style=flat-square)](LICENSE)

</div>

<div align="center">

**Live:** [kazuo-arc.vercel.app](https://kazuo-arc.vercel.app) · job board [kazuo-arc-app.vercel.app](https://kazuo-arc-app.vercel.app) · broker served over a Cloudflare tunnel during judging (the Railway image needs its operator key)

`@kazuo/cli`, `@kazuo/mcp` and `@kazuo/protocol` are not on npm yet — build from this repo.

</div>

---

## For judges — verify in three commands

```bash
pnpm install && pnpm build && pnpm test
```

**347 tests, no credentials and no network required** — the two pieces that
touch the chain (the facilitator and the audit writer) are stubbed, so
everything from a buyer's first request to a published receipt runs as
production code.

Then one command that proves the claim against live Arc testnet:

```bash
pnpm m1
```

It prints both faces of the buyer's balance, has them sign an EIP-3009
authorization, relays it through the facilitator, and **asserts the buyer's gas
came to zero**.

Then the live proof, all on Arc testnet and all openly readable:

| What | Where |
|---|---|
| **A real model job, bought and paid for** | [`0x83f81832…5e77f7c`](https://testnet.arcscan.app/tx/0x83f81832a17b95e3c390f264abc8cb24d2cf35ad48955155bddc21e8a5e77f7c) — $0.20 to a Codex node, prompt in, working code out, 4.7s |
| The browser wallet path | [`0xb495004c…ce4c5c14`](https://testnet.arcscan.app/tx/0xb495004c5f6edf913bd80b3522e0c6c6776d967d77376c19baed83cace4c5c14) — the app's production payment code |
| Full lifecycle, quote → 402 → pay → dispatch → result → receipt | [`0xad0887af…ff8113d`](https://testnet.arcscan.app/tx/0xad0887afa017182d22f82fd7a51336381fae0f69cbb8df42686b63e45ff8113d) |
| The audit log | [`0x383f5153…65eef3`](https://testnet.arcscan.app/address/0x383f5153db8bb18c7c25157fb3493645a465eef3) |
| Codex job after the Kazuo rename (ETHOnline) | [`0x042613d2…6ddb`](https://testnet.arcscan.app/tx/0x042613d2c1f4fddb37629bb96aafafcc28e8654798d695ca18ed2690d5c46ddb) — $0.20, answer `print(input()[::-1])`, receipt [`0xaffd433d…07c1`](https://testnet.arcscan.app/tx/0xaffd433d023631b1890f840eb766974a08c06886bb5b4bdd0457ad1b82f007c1) |
| An agent paying over MCP (ETHOnline) | [`0x307792e8…9f99`](https://testnet.arcscan.app/tx/0x307792e88f11bd6c5d88661ddc1390b4c5321dd1d184c7fc0c0d0eeb76cd9f99), receipt [`0x2cdcae5c…454a`](https://testnet.arcscan.app/tx/0x2cdcae5c05ada8cb70f432a8fcbfdabe4a47d8e3ab7d944f0736a6b54857454a) |
| Zero-gas proof, re-run after the rename | [`0xbc95f083…4d12`](https://testnet.arcscan.app/tx/0xbc95f083b33b2d95c8317cdca5386a70b6ea88dc2e9c2075e03b1deabd9c4d12) — buyer's gas 0 wei |

### What is proven, and what isn't

| | |
|---|---|
| ✅ x402 payments settling on Arc | Many, on-chain, links above |
| ✅ Buyer pays **zero gas** | Asserted, not assumed — `pnpm m1` fails if it isn't 0 wei |
| ✅ A real model job, paid per job | Codex: prompt in, working code out |
| ✅ On-chain audit trail | `KazuoLog` — registrations, liveness, receipts as indexed events |
| ✅ Browser wallet paying directly | EIP-712 typed data; any EVM wallet, no relay, no project id |
| ✅ MCP: an agent buying capacity | Verified over stdio |
| ✅ Survives a broker restart | SQLite — jobs, receipts index and cursor survived a full machine reboot (MongoDB mirror is optional and not configured) |
| ✅ OS-level job sandbox | Seatbelt / bubblewrap / container — a hostile prompt cannot read the payout key |
| ⚠️ Claude Code, paid | Its OAuth token had expired on this host; the paid attempt failed *after* settlement. `kazuo doctor` names it exactly. Codex was used for the proof instead |
| ⚠️ Three of five adapters under the sandbox | Codex and OpenCode can't start under seatbelt, Grok returns empty. `kazuo test` catches all three before a node goes live. The real-model proof above ran with `KAZUO_SANDBOX=none` |
| ✅ Landing + job board deployed | [kazuo-arc.vercel.app](https://kazuo-arc.vercel.app), [kazuo-arc-app.vercel.app](https://kazuo-arc-app.vercel.app) — built and typechecked on Vercel |
| ✅ Public receipts feed | The job board's Network page and the landing page read real `KazuoLog` receipts from a persisted forward index |
| ⚠️ Broker hosting | Live for judging through a Cloudflare tunnel to a broker on the builder's machine. The Railway image builds, but the service needs its operator key before it serves |
| ⚠️ World AgentKit | Live: nodes sign a broker-minted SIWE challenge on register, the broker verifies it and reads AgentBook on World Chain (`agentkit proof verified — no human in AgentBook`); human-backed nodes win ties, one human backs ≤ 3 nodes, `--human-backed-only` returns 503 when none qualify. Not yet proven: no address is registered in AgentBook — that needs a person in World App |
| ⚠️ World ID Selfie Check | Live: RP-signed single-use requests (signature recovers to the registered signer), nonce/replay checks before World's verify API, `kazuo verify` terminal QR, job-board widget. Not yet proven: a real scan |
| ⚠️ Privy | Live: the Privy modal (email + wallet) loads with the app's config on the deployed job board; embedded wallets pay with the same EIP-712 path, plus Send USDC. Not yet proven with an on-chain payment from an embedded wallet — that needs a signed-in email user |

Every one of those caveats is expanded, with the failing output, in
[SUBMISSION.md](SUBMISSION.md).

---

---

## `/kazuo` — buy compute from inside Claude Code

```bash
kazuo skills
```

That installs Kazuo as a slash command. Then, in any project:

```
/kazuo Write a Postgres query that finds duplicate rows by email, keeping the newest
```

Claude Code hands the task to a *different* machine — someone else's Claude or
Codex subscription — pays for it in USDC over x402, and returns the answer with
the settlement transaction beside it.

An agent paying another agent for compute, per request. No account, no API key,
no invoice. It shells out to `kazuo run --json`, so the price ceiling, the quote,
and the receipt are the same ones the CLI already enforces.

Add `--global` to install it for every project.

---

## Sponsor integrations — ETHOnline 2026

**Arc (Circle).** Every job settles as a USDC transfer on Arc testnet over x402: the buyer — a person in the
browser, the CLI, or an agent over MCP — signs an EIP-3009 authorization, the broker's facilitator relays it,
and the money goes straight to the provider. USDC is the gas token, so a buyer needs nothing but the USDC
they spend. Receipts land in the `KazuoLog` contract on Arc.

**World — AgentKit.** A capacity market sorted on reputation is easy to farm with bots. Provider nodes sign a
broker-issued SIWE challenge with their payout key (`GET /api/agentkit/challenge`); the broker verifies it with
`@worldcoin/agentkit` and resolves the address in **AgentBook** on World Chain. Human-backed nodes win price
ties ahead of track record, buyers can ask for human-backed providers only (`kazuo run --human-backed-only`,
MCP `human_backed_only`), and one human can back at most three live nodes. Buying agents prove themselves the
same way, and every job records whether a human stood behind each side. `kazuo agentkit status` reads
AgentBook for your address; `kazuo agentkit register` starts World App verification. Feedback for the World
team is in [FEEDBACK-WORLD.md](FEEDBACK-WORLD.md).

**Privy.** The job board signs people in with Privy. An email address is enough: Privy creates an embedded
wallet on Arc, and that wallet pays for a job immediately — a job payment is an EIP-712 signature, not a
transaction, so there is no gas, no extension and no network to add. The wallet popover also sends USDC.
Existing wallets connect through the same modal. (The Hedera version had to remove Privy, because Hedera's
x402 scheme needs a native protobuf signature; on Arc it came back.)

---

## The idea

Millions of people pay ~$20–200/month for an AI subscription and use a fraction of it. Meanwhile
anyone who wants a one-off coding task done has to buy their own plan or an API key.

Kazuo connects the two. You run one command, your machine joins the network, and jobs from strangers
run on the quota you were already paying for. Each job settles as a **real on-chain transfer,
directly from the buyer to you** — no invoices, no platform float, no payout schedule.

```bash
pnpm install && pnpm build
alias kazuo="node $PWD/packages/cli/dist/index.js"
kazuo init
kazuo start
```

> The CLI will ship as `@kazuo/cli` (npm rejects the bare name `kazuo` as too close
> to existing packages); until it is published, run it from a clone as above.
> The binary is `kazuo` either way.

---

## What makes it work

**HTTP 402 finally means something.** x402 turns "Payment Required" into a working rail: the server
answers 402 with machine-readable payment terms, the client signs, and the same request succeeds a
round-trip later. No checkout, no accounts, no API keys.

**Arc makes sub-cent pricing real, and removes the gas token entirely.**

| Property | Why it matters here |
|---|---|
| **USDC *is* the native gas token** | There is no second currency to acquire, and no exchange rate that can go stale between quoting a job and paying for it |
| EIP-3009 on a real Circle FiatTokenV2 | The buyer signs typed data, never broadcasts, and **needs no gas at all** — the facilitator relays it and pays |
| Measured $0.00185 to settle | A $0.001 job isn't eaten by gas |
| Sub-second blocks | The buyer isn't waiting on confirmations |
| Ordinary EVM | Any wallet can pay with `eth_signTypedData_v4`. No relay, no project id, no chain-specific SDK |

**The broker never touches the money.** The 402 response names the *matched provider's own Arc
address* as `payTo`. Funds move buyer → provider in one transfer. Protocol fee is 0%.

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
    │  ◄─── 402 + accepts[]    │  USDC + EIP-712 domain     │
    │                          │                            │
    │  signs an EIP-3009 auth  │                            │
    │  (typed data, NOT a tx)  │                            │
    │  X-PAYMENT ─────────────►│  facilitator relays it     │
    │                          │  and pays the fee ───────► Arc
    │  ◄─── 200 + job id       │  ~1s, settled              │
    │       X-PAYMENT-RESPONSE │                            │
    │                          ├──── job.dispatch ─────────►│
    │  ◄═══ SSE: live events ══╪◄═══ tool calls, edits ═════┤
    │  ◄─── result             │◄──── answer ───────────────┤
    │                          ├──── receipt ─────────────► KazuoLog
```

Payment settles **before** the job runs. That isn't laziness: a signed authorization is only
valid for 180 seconds, so waiting for a five-minute coding job would leave the provider unpaid for
work already done. The other risk is covered at the network level — a failed job is **reassigned to
another provider at no extra charge**, and the failure counts against the original provider's
success rate, which is what the matcher sorts on.

---

## Repo layout

```
kazuo/
├── packages/
│   ├── cli/          @kazuo/cli — the provider node; the binary is `kazuo`
│   ├── mcp/          @kazuo/mcp — Kazuo as an MCP server, so agents can buy capacity
│   └── protocol/     @kazuo/protocol — shared types, money math, Arc + x402 wiring
├── services/
│   └── broker/       @kazuo/broker — registry, matching, x402 gating, self-hosted
│                     facilitator, on-chain audit trail, SQLite, metrics
├── apps/
│   ├── app/          kazuo-app — the job board (Next.js)
│   └── landing/      kazuo-landing — marketing site (Next.js + GSAP)
└── brand/            logo + mark
```

---

## Quickstart

Needs Node ≥ 20.11 and pnpm. Claim Arc **testnet** USDC at
[faucet.circle.com](https://faucet.circle.com) — pick Arc Testnet. There is no
separate gas token to acquire; USDC is the gas.

```bash
git clone https://github.com/nickthelegend/kazuo-arc.git
cd kazuo-arc && pnpm install
cp .env.example .env          # paste your operator id + key
pnpm deploy:log                   # deploys the audit contract
pnpm setup                        # checks the config, reports what's funded
pnpm build
```

Then, in three terminals:

```bash
pnpm broker      # coordinator + facilitator on :8402
kazuo start       # your provider node
pnpm app         # job board on :3002
```

Post a job from the terminal, end to end:

```bash
kazuo run "Explain what a Merkle tree is, briefly." --max 0.02
```

<details>
<summary><b>What that prints</b></summary>

```
✔ matched nivesh-macbook
╭─ quote ──────────────────────────────────────────────────╮
│ provider   nivesh-macbook · 12 jobs done                 │
│ price      $0.0010                                       │
│ goes to    0xff21…489B — straight to the provider        │
│ from       0x0329…9F36                                   │
│ gas        none — the facilitator relays and pays the fee │
╰──────────────────────────────────────────────────────────╯
✔ paid $0.0010 — job job_TwzS96BhAx81
✔ ⛓ settled on testnet
  https://testnet.arcscan.app/tx/0xad0887afa017182d22f82fd7a51336381fae0f69cbb8df42686b63e45ff8113d
```

</details>

---

## The CLI

The provider node. Full docs in [`packages/cli/README.md`](packages/cli/README.md).

| Command | What it does |
|---|---|
| `kazuo init` | Interactive setup — probes your agent CLIs, generates or imports a payout account |
| `kazuo start` | Go live: register, hold the control channel, run jobs, live earnings dashboard |
| `kazuo run "…"` | The buyer side — post a job and pay for it over x402 |
| `kazuo test` | Run a real job through each adapter **locally and free** — proves the node will actually earn |
| `kazuo doctor` | Every reason this node might not be earning, each with the fix |
| `kazuo earnings` | What this machine has made, with sparklines and on-chain balance |
| `kazuo jobs` | Jobs this node has run |
| `kazuo price` | Show or change what this node charges |
| `kazuo status` | Who's live on the network, and what they charge |
| `kazuo pause` / `resume` | Stop taking new jobs without going offline |
| `kazuo cancel <job>` | Stop a running job |
| `kazuo wallet` | The payout address, what it holds, key rotation |
| `kazuo logs` / `config` | Local job log; current configuration (key redacted) |
| `kazuo completion` | Shell completions for bash, zsh, fish |

### Adapters

An adapter drives a CLI you already have installed and signed in. Kazuo never asks for an API key,
because it never calls an API on your behalf.

`claude-code` · `codex` · `grok` · `opencode` · `openai-compatible` (Ollama, LM Studio, vLLM,
OpenRouter…) · `echo` (built in, always works — exercises the whole payment path with nothing
installed)

---

## For agents: the MCP server

This is the part x402 was actually invented for. An agent that needs work done
finds capacity, pays for it, and gets the result — no human, no account, no card.

```bash
# @kazuo/mcp is not published to npm yet — point at the built file in your clone:
claude mcp add kazuo -- node /absolute/path/to/kazuo/packages/mcp/dist/index.js
```

```bash
KAZUO_PAYER_KEY=0x...       # the key the agent spends from; its address is derived
KAZUO_MAX_USD=0.05          # hard ceiling per call, enforced client-side too
```

Five tools: `kazuo_list_providers`, `kazuo_network_status`, `kazuo_quote`,
`kazuo_run_job`, `kazuo_get_job`. Only `run_job` spends, and it refuses anything
over the ceiling — a model that can spend without a bound is a model that can
empty an account through a loop it didn't mean to write.

A real call returns the answer plus its proof:

```
Reply with a haiku about paying for compute.
> …

---
Paid $0.0010 to nivesh-macbook (0xff212ecb82E3b06c0a2A7a9Ce343e0a1868c489B)
Transaction: https://testnet.arcscan.app/tx/0xad0887af…ff8113d
On-chain receipt: https://testnet.arcscan.app/tx/0xd36ae7e5…b4d65cba
```

---

## Tests

```bash
pnpm test    # 347 tests, no credentials, no network
```

Unit tests for money math, key parsing, the matcher and the terminal layout —
plus a **full-lifecycle integration suite** that boots a real HTTP server, the
real Hono app, the real x402 resource server and the real WebSocket hub, and
drives a fake provider through quote → pay → dispatch → stream → result →
receipt. Only the two pieces that touch the chain are stubbed.

They earn their keep: writing them turned up five real bugs, including a stale
provider status being read by the guard that decides whether a quoted node is
still alive enough to be paid.

---

## Deploying the broker

```bash
docker compose up -d
```

Persists to a volume, health-checks itself, and runs as a non-root user. Set
`KAZUO_TRUST_PROXY=1` behind a reverse proxy so rate limiting sees real client
IPs. `/metrics` speaks Prometheus.

> Built on Railway from this Dockerfile (Node 24 for `node:sqlite`, a Railway
> volume at `/data`, `RAILWAY_RUN_UID=0` so the non-root image can write it).
> Doing so found one incompatibility: Railway rejects a Dockerfile `VOLUME`
> instruction, so the volume is attached to the service and compose mounts its
> own. The broker listens on `KAZUO_BROKER_PORT`, falling back to `PORT`. The
> Railway service does not serve yet: it needs `KAZUO_OPERATOR_KEY`, which is set
> by the owner, never pushed by tooling. During judging the same build runs on the
> builder's machine behind a Cloudflare tunnel.

---

## Live on Arc testnet

Everything below is real and checkable.

| | |
|---|---|
| Network | `eip155:5042002` — Arc testnet |
| USDC | [`0x3600…0000`](https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000) — Circle FiatTokenV2, the ERC-20 face of native USDC |
| Audit log | [`0x383f5153…65eef3`](https://testnet.arcscan.app/address/0x383f5153db8bb18c7c25157fb3493645a465eef3) — one contract, three indexed streams |

**Settlement, verified on-chain.** Jobs across the CLI, the browser payment path
and the MCP client — and the buyer's gas spend was zero through every one of
them, because the buyer never broadcast anything:

| | |
|---|---|
| A real Codex job | [`0x83f81832…5e77f7c`](https://testnet.arcscan.app/tx/0x83f81832a17b95e3c390f264abc8cb24d2cf35ad48955155bddc21e8a5e77f7c) — $0.20, prompt in, `print(input()[::-1])` out |
| Its on-chain receipt | job id, both addresses, amount, and a SHA-256 of the result |
| The browser wallet path | [`0xb495004c…ce4c5c14`](https://testnet.arcscan.app/tx/0xb495004c5f6edf913bd80b3522e0c6c6776d967d77376c19baed83cace4c5c14) |
| Buyer's gas | **zero wei.** Asserted by `pnpm m1`, which fails if it isn't |

Measured costs, from those exact transactions:

| | |
|---|---|
| x402 settlement | 91,641 gas — $0.00185 |
| Audit-log append | 43,460 gas — $0.00088 |
| Contract deploy | 211,940 gas — $0.0043 |

---

## Security — read this before running a node

A Kazuo provider runs prompts written by people they have never met, on their own machine, against
their own paid account. That is the product, and it is also the risk.

**What Kazuo does:** every job is spawned through a sandbox that applies the strongest containment the
host provides — macOS seatbelt, Linux bubblewrap, or an opt-in container. On macOS and Linux a job
cannot read `~/.kazuo` (**your payout private key**), `~/.ssh`, `~/.aws`, `~/.config/gh`, `~/.npmrc`,
the keychain, or your browser profile, and cannot write outside its own job directory. On every host
the environment is an allowlist — a job never sees `AWS_SECRET_ACCESS_KEY` or `GITHUB_TOKEN` — and
CPU, file size and process count are capped.

Claude Code authenticates from the keychain, so the node reads its token once at startup, outside the
sandbox, and injects only that token into the job. The keychain itself stays denied; otherwise any
prompt could run `security find-internet-password -w` and take your GitHub token.

`kazuo doctor` names the active tier. Take it seriously if it says `env` or `limits` — those hosts
have no filesystem boundary.

**What Kazuo does not do:** hide the agent session being rented. The agent's own token is in the job's
environment because the agent needs it to run.

**For full isolation on any host:** `KAZUO_SANDBOX=container kazuo start`. Or `KAZUO_SAFE_MODE=1`, which
disables tools entirely and leaves a pure text-generation service — worth less per job, but it cannot
touch a disk.

**On terms of service:** most consumer AI subscriptions are licensed to an individual and reselling
that capacity may breach them. Kazuo is infrastructure and doesn't decide this for you — run it
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
  real while heartbeats keep arriving. The durable half goes to the `KazuoLog` contract, where it's
  public and append-only rather than trapped in our database — but every entry costs gas, so the
  on-chain liveness proof is sampled hourly rather than written every beat. At the cadence inherited
  from Hedera it would have cost $0.25/day per idle provider, which is more than a hundred settled
  jobs earn.
- **A quote is a first-class object.** x402 asks the server for payment requirements twice (once to
  answer 402, once to check the payment). Both answers must name the same provider at the same
  price, so the amounts are frozen at quote time — along with the token's EIP-712 domain, which the
  buyer signs against. x402's EVM scheme fills that domain in automatically only for networks in its
  built-in stablecoin registry, and Arc is not one of them (checked, not assumed). Leave it out and
  the buyer signs against a domain of its own guessing, producing a valid signature that verifies
  against nothing.
- **The client registers the `eip155:*` wildcard, not one named network.** Pinning it to a network
  read from local config means a buyer can only pay a broker that happens to match their own node's
  configuration, and the failure is baffling — the 402 arrives correctly and the client refuses with
  "no network/scheme registered". Nothing is lost by widening it: the EIP-712 domain binds each
  signature to one chain id, so an authorization can't be replayed elsewhere.

---

## Documentation

| | |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How it's put together, and why the awkward parts are that way |
| [SECURITY.md](SECURITY.md) | The provider risk stated plainly, key handling, and known limitations |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, and how to write an adapter |
| [CHANGELOG.md](CHANGELOG.md) | What shipped |
| [packages/cli/README.md](packages/cli/README.md) | Full CLI reference |

---

## License

MIT — see [LICENSE](LICENSE).

Built for **ETHOnline 2026** — Arc, World (AgentKit) and Privy tracks.
Part of the [Loompad](https://loompad.tech) ecosystem.
