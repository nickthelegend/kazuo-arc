<div align="center">

<img src="https://raw.githubusercontent.com/nickthelegend/kazuo-arc/main/brand/kazuo-logo.svg" alt="Kazuo" width="240" />

**Rent out your idle AI subscription. Get paid per job in USDC.**

</div>

```bash
npm i -g @kazuo/cli
kazuo init
kazuo start
```

That's it. Your machine joins the [Kazuo](https://github.com/nickthelegend/kazuo-arc) network, takes jobs
from anyone, runs them on the Claude / Codex / Grok plan you already pay for, and gets paid **per
job in USDC over [x402](https://x402.org) on [Arc](https://www.circle.com/arc)** — straight to your
wallet, with no platform in the middle.

---

## Why you'd run this

- **You keep 100%.** The protocol fee is zero, and payment goes buyer → you in a single on-chain
  transfer. Kazuo is never the payee, so there's nothing to withhold.
- **You never need a gas token.** On Arc, USDC *is* the gas, and the network's facilitator pays the
  fee on every settlement. A fresh address can receive earnings the moment it exists.
- **You set the price.** Per capability, per job, down to a tenth of a cent. The cheapest matching
  provider wins the job.
- **You stay behind NAT.** The node dials out to the broker. No port forwarding, no inbound surface.
  A Cloudflare tunnel is optional.
- **No API keys.** Kazuo drives the CLI you already have installed and signed in. It never calls an
  AI API on your behalf.

---

## Commands

### `kazuo init`

Interactive setup. Probes which agent CLIs actually work on this machine (it doesn't ask — it
checks), lets you pick what to sell and at what price, and gets you an Arc payout address either
by importing a key or generating one. Nothing to fund, nothing to associate.

### `kazuo start`

Go live. Registers with the broker, appends the registration to the KazuoLog contract on Arc,
opens the control channel, and hands the terminal to a live dashboard.

```
● LIVE  │ nivesh-macbook │ beat 3s ago │ up 2h 14m
◈ earned $0.0420  │ 42 done  │ 0 failed  │ 1 running
─────────────────────────────────────────────────────
  selling
  · Claude Code                   $0.0100  1 running
  · Codex                         $0.0080  idle

  in flight
  ⚡ job_gBc-RIOAyq claude-code $0.0100 8.4s
      Write: src/parser.ts
```

| Flag | |
|---|---|
| `--tunnel` | Raise a Cloudflare quick tunnel and expose a public status page |
| `--broker <url>` | Point at a different broker |
| `--port <port>` | Port for the local status page |

### `kazuo run "<prompt>"`

The buyer side — post a job to the network and pay for it. The whole protocol in one command.

```bash
kazuo run "Write a Python function that parses ISO-8601 durations, with tests." --max 0.02
kazuo run "Summarise this paper" --adapter claude-code --yes
```

| Flag | |
|---|---|
| `--max <usd>` | Most you'll pay (default `0.05`) |
| `--adapter <kind>` | Require a specific adapter |
| `--key` | Payer key, its address is derived (or `KAZUO_PAYER_KEY`) |
| `--broker <url>` | Broker to post to |
| `-y, --yes` | Skip the confirmation |
| `--human-backed-only` | Only match providers proven human-backed with World ID (AgentKit) |
| `--json` | Machine-readable output |

### `kazuo agentkit`

Prove a human stands behind this node, with [World AgentKit](https://docs.world.org/agents/agent-kit/integrate).
`kazuo agentkit status` reads AgentBook on World Chain for your payout address; `kazuo agentkit register`
starts World App verification (`npx @worldcoin/agentkit-cli register <address>`). Once registered,
`kazuo start` signs the broker's challenge on every registration and the node is labelled
**human-backed**: it wins price ties ahead of track record, and buyers asking for human-backed providers
only can match it. `kazuo run` signs the same proof as a buyer. Set `KAZUO_AGENTKIT=0` to opt out.

### `kazuo status` · `kazuo earnings` · `kazuo doctor` · `kazuo wallet`

`status` shows who's live on the network and what they charge. `earnings` reads a local append-only
ledger (works offline) and shows daily sparklines plus your on-chain balance. `doctor` checks every
reason this node might not be earning and prints the fix for each. `wallet` shows the payout address and its
USDC balance, and `wallet new` rotates the key. There is no association step on Arc.

---

## Adapters

| Adapter | Drives | Streams |
|---|---|---|
| `claude-code` | `claude` | tool calls, file edits, extended thinking |
| `codex` | `codex` (PATH or Codex.app) | shell commands, file changes |
| `grok` | `grok` | answer + reasoning |
| `opencode` | `opencode` | answer |
| `openai-compatible` | any `/v1/chat/completions` endpoint | answer |
| `echo` | built in | always available, for testing the payment path |

`openai-compatible` is the open end: Ollama, LM Studio, vLLM, OpenRouter, or an internal gateway —
so a local GPU is sellable too. Configure with `KAZUO_OPENAI_BASE_URL`, `KAZUO_OPENAI_MODEL` and
optionally `KAZUO_OPENAI_API_KEY`.

Writing a new adapter is one class with two methods: `available()` and `run()`.

---

## Security

**Read this before running a node.** You will be executing prompts written by strangers on your own
machine, against your own paid account.

Every job runs in a **fresh empty directory** under `~/.kazuo/jobs/`, which is the agent's working
directory and is deleted when the job ends. That bounds the blast radius of a hostile prompt to a
scratch directory rather than your source tree.

On top of that, every job is spawned through the strongest sandbox the host provides — macOS
seatbelt, Linux bubblewrap, or `KAZUO_SANDBOX=container`. A job cannot read `~/.kazuo` (your payout
key), `~/.ssh`, cloud credentials or the keychain, and its environment is an allowlist. `kazuo doctor`
names the active tier.

`KAZUO_SAFE_MODE=1` disables tools entirely and leaves pure text generation — worth less per job, but
it cannot touch a disk.

Also check your AI provider's terms: most consumer subscriptions are licensed to an individual, and
reselling that capacity may breach them.

---

## Configuration

Config lives at `~/.kazuo/config.json`, mode `0600`. The payout key is stored in plaintext — a
deliberate, stated trade-off, since it's a hot key that must sign with no human present. Set
`KAZUO_PRIVATE_KEY` to override it from a real secret manager.

| Env | |
|---|---|
| `KAZUO_BROKER_URL` | Broker to register with |
| `KAZUO_PRIVATE_KEY` | Payout key, overriding the config file |
| `KAZUO_SAFE_MODE` | `1` disables all tools |
| `KAZUO_HOME` | Config directory (default `~/.kazuo`) |
| `KAZUO_CLAUDE_BIN` etc. | Override a CLI's path |
| `KAZUO_DEBUG` | Print stack traces |

---

MIT · [github.com/nickthelegend/kazuo-arc](https://github.com/nickthelegend/kazuo-arc)
