---
name: kazuo
description: Run a task on someone else's AI subscription and pay for it per job in USDC over x402 on Arc. Use when the user asks to offload, delegate, or outsource work to the Kazuo network; when they want a second model's take on something; when a job would burn context or quota that is better spent locally; or when they explicitly say /kazuo. Also use to check what this machine has earned as a provider.
---

# Kazuo — buy compute from the network

Kazuo is a marketplace for idle AI subscription quota. Someone else's machine
runs the job on the Claude / Codex / Grok plan they already pay for, and they
get paid per job — a real USDC transfer on Arc, settled in about a
second, straight to them.

You are already inside an agent. This skill exists for the work that does not
need *this* agent: a second opinion from a different model, a long mechanical
task not worth the context, or anything you would rather not spend the local
plan on.

## Running a job

```bash
kazuo run --json --yes --max 0.30 "<the task, as a complete self-contained prompt>"
```

The prompt goes to a stranger's machine with **no other context** — no repo, no
files, no conversation history. Write it so it stands alone. If the task needs
code, paste the code into the prompt.

`--max` is a hard ceiling in dollars. Never raise it above what the user
authorised. If no ceiling was given, use `0.30` and say so.

`--adapter claude-code` (or `codex`, `grok`) pins a specific agent when the
user wants a particular model. Omit it and the network matches the cheapest
live provider that can do the work.

## Reading the result

`--json` returns:

```json
{
  "jobId": "job_…",
  "quote": { "provider": { "label": "…", "accountId": "0.0.…" }, "priceLabel": "$0.2500" },
  "settlementTransaction": "0.0.…@…",
  "arcscan": "https://arcscan.io/testnet/transaction/…",
  "status": "completed",
  "result": "…"
}
```

Report three things back, always:

1. **The answer** — `result`.
2. **Who ran it and what it cost** — the provider label and `priceLabel`.
3. **The receipt** — the `arcscan` link.

The third one is not decoration. A payment happened on a public ledger; the
user should be able to check it. Never report a paid job without its link.

`status` other than `completed` means the job failed. Say so plainly and show
`error`. A failed job is reassigned by the network at no extra charge, so
offer to retry rather than treating it as final.

## Before spending anything

Money leaves the user's account when this runs. So:

- **Confirm the first job of a session** unless the user already said to go
  ahead. Show the task and the ceiling. After that, stay inside the ceiling
  they set without re-asking each time.
- **Never invent a higher ceiling** because a quote came back above it. Report
  the quote and let them decide.
- If `kazuo` is not installed, say so and stop: `npm i -g @kazuo/cli`.

## When payment fails

A `"status": "failed"` with `"stage": "payment"` is almost always one of three
things, and the `hints` array says which. The one people hit first: **you
cannot pay yourself.** If this machine is also running `kazuo start`, its
config account is the provider, and buying from itself is rejected. Buy from a
separate account:

```bash
export KAZUO_PAYER_ID=0.0.xxxxx
export KAZUO_PAYER_KEY=...
```

Those are read by `kazuo run` directly; nothing else needs changing.

## Other things worth knowing

`kazuo status` — who is live on the network right now, and at what price.
`kazuo earnings` — what this machine has earned as a provider, job by job,
plus its on-chain balance. Use this when the user asks what they have made.
`kazuo doctor` — why a node is not earning; it names the sandbox tier, whether
each agent CLI is actually signed in, and whether the payout account can
receive USDC.

Broker for this install: `http://localhost:8402`

## What this is not

This does not give you access to the user's Kazuo payout key, and it does not
run jobs *for* the network on this machine — that is `kazuo start`, which is a
deliberate decision the user makes at a terminal, not something to do on their
behalf.
