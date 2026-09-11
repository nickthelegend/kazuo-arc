# The demo video — what to record, and what to say

ETHOnline asks for a short video (keep it **under 5 minutes**; Arc and Privy both
want to see the working product, World wants AgentKit shown in use). This is a
shot list for about **4:30**, in the order the story lands. Everything in it was
run for real on 2026-09-13 — nothing here depends on a feature that isn't live.

Read it once, then record in your own words. Bracketed lines are what you do;
quoted lines are roughly what you say.

---

## Before you hit record

The demo runs on **three processes on this Mac**. Keep the machine awake and the
lid open for the whole recording.

| Process | Command | Check |
|---|---|---|
| Tunnel | `cloudflared tunnel --url http://localhost:8402` | prints a `https://…trycloudflare.com` URL |
| Broker | `node services/broker/dist/index.js` (from the repo root, reads `.env`) | `curl -s <tunnel>/health` → `{"ok":true,…}` |
| Provider | `kazuo start` | dashboard shows `LIVE` and `beat …s ago` |

Today's tunnel is `https://surround-ports-prime-audience.trycloudflare.com`. **If the
tunnel restarts, its URL changes** — put the new one in
`NEXT_PUBLIC_KAZUO_BROKER_URL` on both Vercel projects (and `KAZUO_BROKER_URL` on
`kazuo-arc-app`) and redeploy both. Budget 5 minutes.

The CLI is not on npm yet, so alias it from the clone:

```bash
alias kazuo="node $PWD/packages/cli/dist/index.js"
export KAZUO_BROKER_URL=https://surround-ports-prime-audience.trycloudflare.com
export KAZUO_PAYER_KEY=<the demo payer key>   # a DIFFERENT account from the provider
```

**A provider cannot buy from itself** — skip the payer key and every `kazuo run`
fails with a bare 402.

Then:

- Terminal at ~16pt, window 1920×1080, nothing else on screen. Notifications off.
- Browser tabs: `https://kazuo-arc.vercel.app`, `https://kazuo-arc-app.vercel.app`,
  and ArcScan (`https://testnet.arcscan.app`).
- **Browser payment — pick one before recording:**
  - *Privy (best for the Privy track):* sign in on the job board with your email,
    open the wallet popover, copy the embedded wallet address, fund it with
    testnet USDC at `faucet.circle.com`. Then paying a quote signs from that wallet.
  - *No wallet:* "Pay and run" works for anyone as long as the broker's `.env`
    has `KAZUO_DEMO_PAYER_KEY` — the job board relays the payment to the broker,
    which pays from that account on this machine. Without it the button says
    "No demo payer configured" (by design).
  - *Neither:* show the quote in the browser, then pay the same job with
    `kazuo run` in the terminal. Still real, still on-chain.
- **World App on your phone** if you want the live Selfie Check beat.
- Run one throwaway job first — the first job of a session is the slowest.

Readiness check:

```bash
kazuo doctor
```

It should end `nothing broken`. On this Mac it shows Claude Code and Echo `signed in ·
selling`; Codex, Grok and OpenCode are installed but not sold. **Run `claude` once
shortly before recording** — the node reads Claude Code's login from the keychain
for each job, and a lapsed token fails a paid job after settlement (`kazuo test
--adapter claude-code` confirms it). Codex is out of quota until 12 Oct 2026; don't
sell it on camera.

---

## 0:00 – 0:25 · The hook

**[Browser: kazuo-arc.vercel.app, top of the hero]**

> "You pay for Claude or Codex and use a fraction of it. Someone else needs one
> job done and has to buy a whole plan. Kazuo is the rail between them — every job
> settles as a USDC transfer on Arc, straight to the machine that ran it."

---

## 0:25 – 0:55 · The landing page

Scroll to **How it works**, pause two seconds. Then **Receipts**.

> "These aren't mock rows. The broker indexes a contract on Arc, KazuoLog, and
> every paid job leaves a receipt there — job, both accounts, amount."

Scroll to **Security**.

> "You're running strangers' prompts on your own machine, so every job runs in an
> OS sandbox — the payout key is unreadable to the job."

---

## 0:55 – 1:40 · Become a provider

**[Terminal]**

```bash
kazuo doctor
```

Point at three lines:

> "Sandbox — it names the mechanism, macOS seatbelt. Claude Code — signed in, selling; it
> checks the CLI is actually authenticated, not just installed. And the last line:
> nothing broken."

```bash
kazuo start
```

> "Registered — and that registration is written on chain. It holds a control
> channel open to the broker and waits for work."

Leave the dashboard up: `LIVE`, heartbeat, the two capabilities and prices.

---

## 1:40 – 2:40 · Buy a job, and watch the 402

**[Browser: kazuo-arc-app.vercel.app]**

Open **Providers**: your node, online, heartbeat, prices. Back to **Jobs**.

If you set up Privy: **Sign in** → the Privy modal (email or wallet).

> "An email is enough. Privy makes an embedded wallet on Arc, and it can pay right
> away — what it signs is an EIP-3009 authorization, typed data, never broadcast.
> The facilitator relays it and pays the fee. No gas, no extension."

In the composer, pick **Claude Code** in the model picker, set max to `0.25`, and type:

```
Write a Python one-liner that reverses a string. Just the code, nothing else.
```

Click the arrow. **Stop on the quote card.**

> "Before any money moves I get terms: which machine runs it, what it costs, and
> it pays that machine's own address. That's HTTP 402 doing real work."

Pay (Privy wallet or demo payer), or in the terminal:

```bash
kazuo run --adapter claude-code --max 0.25 "Write a Python one-liner that reverses a string. Just the code, nothing else."
```

Watch the job page: status, execution log, the answer, then the **On-chain
receipt** panel — payer, paid to, amount, `sha256` of the result.

---

## 2:40 – 3:15 · Prove it on chain

Click **View transfer on ArcScan**. Point at two things only:

> "The USDC moved buyer to provider, directly — no escrow, no platform custody. And
> the transaction was sent by the facilitator, so every fee came from it. The buyer
> never broadcast anything. On Arc the gas token is USDC, and the buyer spent none
> of it on fees."

Back on the job page, **View on-chain receipt** → the KazuoLog entry. Then the
job board's **Network** page: "Receipts from the chain".

---

## 3:15 – 3:50 · World: human-backed nodes

**[Terminal]**

```bash
kazuo agentkit status
```

> "A marketplace sorted on reputation is easy to farm with bots. So every node
> signs a World AgentKit challenge with its payout key, and the broker looks that
> address up in AgentBook on World Chain. Right now this node is not registered —
> so it's treated as anonymous. Human-backed nodes win ties, one human can back at
> most three nodes, and a buyer can demand human-backed only."

```bash
kazuo run --human-backed-only --adapter echo --max 0.01 "hello"
```

> "No human-backed node online — so it refuses rather than quietly giving me a bot."

*Optional, if you have World App:* `kazuo verify` → scan the QR → Selfie Check →
the terminal prints `human verified`, and on **Providers** the node gains the
**human** badge. Only show this if you ran it once before recording.

---

## 3:50 – 4:15 · An agent paying an agent

**[Claude Code, in any project]** (install once with `kazuo skills`)

```
/kazuo Write a Postgres query that finds duplicate rows by email, keeping the newest
```

> "This is Claude Code sending a task to someone else's machine and paying for it —
> no account, no API key, no invoice. The answer comes back with the transaction."

(The MCP server does the same for any MCP client: `kazuo_quote`, `kazuo_run_job`.)

---

## 4:15 – 4:30 · Close

```bash
kazuo earnings
pnpm test
```

> "The provider's ledger — every job and the on-chain balance underneath. And 347
> tests, no credentials, no network."

End on the green test output. No outro.

---

## Never on camera

- `.env`, `kazuo config`, `~/.kazuo*/config.json`, `apps/app/.env.local` — they hold
  keys or print account details.
- The Vercel/Railway dashboards' environment variable pages.

## Commands worth screen time

| Command | Show it? | Why |
|---|---|---|
| `kazuo doctor` | **yes** | Sandbox tier, real sign-in detection, broken vs not set up |
| `kazuo start` | **yes** | The "you're a provider now" moment, registration on chain |
| `kazuo run "…"` | **yes** | The whole buyer path in one line |
| `kazuo agentkit status` | **yes** | World AgentKit + AgentBook, live |
| `kazuo earnings` | **yes** | Job history plus the on-chain balance |
| `kazuo skills` | mention | Installs `/kazuo` in Claude Code |
| `kazuo status` | if time | Network-wide view, including the on-chain audit counts |
| `kazuo test` | if time | Runs each capability locally, free |
| `kazuo verify` | only if rehearsed | World ID Selfie Check QR |
| `kazuo config` | **never** | Prints account details |

## If you'd rather not talk

For generated narration: write **`U S D C`** and **`M C P`** letter by letter in
the TTS input, or engines collapse them into one syllable. Speech recognition
hears "Kazuo" unreliably — check auto-captions before publishing.

## Failure modes that eat takes

| Symptom on camera | Cause | Fix before recording |
|---|---|---|
| `kazuo run` fails with a bare 402 | Buying from the provider's own account | `export KAZUO_PAYER_KEY` for a different account |
| "no online provider matches" | Heartbeat lapsed, or the price ceiling is below every capability | Restart `kazuo start`; raise `--max` |
| Job board says "broker offline" | The tunnel or the broker stopped, or the tunnel restarted with a new URL | Restart it; if the URL changed, update both Vercel projects and redeploy |
| "No demo payer configured" | The broker was started without `KAZUO_DEMO_PAYER_KEY` | Add it to `.env` and restart the broker, or pay with Privy / `kazuo run` |
| Provider flaps `control channel lost` | Two `kazuo start` processes | `pgrep -fl "kazuo.*start"` — keep one |
| First job takes 20+ s | Cold start | Run a throwaway job first |
| Claude Code job fails after paying | Expired Claude Code OAuth | Run `claude` once, re-run `kazuo doctor` |
