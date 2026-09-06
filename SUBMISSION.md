# Hedera x402 bounty — submission

## Requirements

| Requirement | Status |
|---|---|
| Public open-source GitHub repo | ✅ [nickthelegend/xorv](https://github.com/nickthelegend/xorv), MIT |
| Demo video under 5 minutes | ⬜ **you record this** — script below |
| HashScan links proving testnet transactions | ✅ below |
| Completed submission form | ⬜ **you submit this** |

## Judging criteria

**A functional end-to-end payment flow.** Post a job → 402 with machine-readable
terms → sign → settle → the job runs on a stranger's machine → result returns →
receipt goes on-chain. Provable in one command: `xorv run "…"`.

**Legitimate on-chain payments through x402.** The official `@x402/hedera` v2
`exact` scheme, partially-signed `TransferTransaction`, verified and settled by a
facilitator Xorv runs itself. Every payment below is a real ledger transaction.

**Effective use of Hedera's infrastructure.** Three things, each chosen because
Hedera does it and other chains don't:

- **Native fee-payer model** — the facilitator co-signs and pays, so a buyer
  holding only a stablecoin can transact. This is the single biggest reason a
  normal person's crypto payment fails, and Hedera removes it.
- **Consensus Service** — an ordered, public, append-only audit log of
  registrations, liveness and receipts, with no contract deployed.
- **Token Service** — sub-cent settlement at a fixed, predictable fee. A $0.001
  job is not viable where gas floats.

## On-chain proof (testnet)

| | |
|---|---|
| **Circle USDC** settlement | [`0.0.9842030@1785516412.478664506`](https://hashscan.io/testnet/transaction/0.0.9842030-1785516412-478664506) — buyer `0.0.9848440` −0.2500 USDC, provider `0.0.9848438` +0.2500, **buyer paid zero gas** |
| Real Claude Code job, paid | [`0.0.9842030@1785475549.131327424`](https://hashscan.io/testnet/transaction/0.0.9842030-1785475549-131327424) |
| Its HCS receipt | [`0.0.9842030@1785475558.951801626`](https://hashscan.io/testnet/transaction/0.0.9842030-1785475558-951801626) |
| Registry topic | [`0.0.9848245`](https://hashscan.io/testnet/topic/0.0.9848245) |
| Heartbeat topic | [`0.0.9848246`](https://hashscan.io/testnet/topic/0.0.9848246) |
| Receipts topic | [`0.0.9848247`](https://hashscan.io/testnet/topic/0.0.9848247) |

Open the receipts topic on HashScan and you can read every settled job: id,
both accounts, amount, transaction id, and a SHA-256 of the result — so the
record is verifiable without the payload ever being public.

## Demo video — a script that fits in five minutes

1. **The problem (20s).** You pay for Claude. You use a fraction of it. Someone
   else wants one job done and has to buy a whole plan.
2. **Become a provider (60s).** `xorv init` → it probes which agent CLIs are
   actually installed → `xorv start` → registration appears on HCS. Show the
   live dashboard.
3. **Buy a job (90s).** In the app: type a prompt → **show the quote** — this is
   who will run it and what it costs, before any money moves → pay → watch the
   log stream → the answer arrives.
4. **Prove it (60s).** Open the HashScan link. Point at two things: the token
   moved buyer → provider directly, and **every HBAR fee came from the
   facilitator, not the buyer**. Then open the receipts topic.
5. **The agent case (40s).** `xorv_run_job` through MCP — an agent discovers
   capacity, pays, gets its answer. No human, no account, no card.
6. **Close (20s).** `pnpm test` — 220 tests, no credentials, no network.

Record with a provider node already running and the broker warm, or you'll
spend a minute of the five on startup.

## Before you submit

- [ ] Rotate the GitHub token, Privy app secret and MongoDB password
- [ ] Record the video
- [ ] Submit the form

## Stated plainly: what is not proven

A judge will find these anyway, and finding them undisclosed is worse than
reading them here.

- **Browser wallets cannot pay yet.** Privy auth is live, but Hedera's x402
  scheme signs a *native* transfer, not an EVM one, so payments route through a
  server-side signer.
- **Docker is unbuilt.** The files are written; Docker wasn't available here.
- **npm packages are unpublished.** Everything runs from a clone.
- **A job can read the agent session it runs on.** The sandbox denies the payout
  key, SSH keys, cloud credentials and the keychain, and confines writes to the
  job directory — but the agent's own token is in the job's environment, because
  the agent needs it to work. `XORV_SANDBOX=container` closes that too. On a host
  with neither seatbelt nor bubblewrap there is no filesystem boundary at all,
  and `xorv doctor` says so. See `SECURITY.md`.
