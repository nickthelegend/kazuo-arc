# Arc hackathon — Agentic Economy

**Xorv turns idle AI subscription quota into a paid marketplace, settled per job
in USDC over x402 on Arc.**

You pay for Claude, Codex or Grok. You use a fraction of it. Someone else needs
one job done and has to buy a whole plan to get it. Xorv is the rail between
them, and the rail is a real Arc transaction every time.

The track asks for autonomous agents that hold wallets and pay, settle and
transact in USDC without a human in the loop. Xorv is both halves of that: the
buyer can be an agent — an MCP server ships in this repo, so any model can
discover capacity, price it, pay for it and get a result with no account and no
card — and the seller is a machine too, a provider node that takes work,
executes it, and is paid directly. The human is optional on **both** sides of
the trade.

---

## What is proven, with links

Every line below is a transaction anyone can open. Nothing here is a mock, a
screenshot, or a plan.

| | |
|---|---|
| **A real model job, bought and paid for** | [`0x83f81832…5e77f7c`](https://testnet.arcscan.app/tx/0x83f81832a17b95e3c390f264abc8cb24d2cf35ad48955155bddc21e8a5e77f7c) — $0.20 to a Codex node, prompt in, `print(input()[::-1])` out, 4.7s |
| **The browser wallet path** | [`0xb495004c…ce4c5c14`](https://testnet.arcscan.app/tx/0xb495004c5f6edf913bd80b3522e0c6c6776d967d77376c19baed83cace4c5c14) — the app's production payment code, signing EIP-712 typed data |
| **Full lifecycle: quote → 402 → pay → dispatch → result → receipt** | [`0xad0887af…ff8113d`](https://testnet.arcscan.app/tx/0xad0887afa017182d22f82fd7a51336381fae0f69cbb8df42686b63e45ff8113d) |
| **The zero-gas proof** | [`0x9c1fed2b…f4f0c67`](https://testnet.arcscan.app/tx/0x9c1fed2b2c87bf85bef22045ff3a440e3d4463c2147cdd00f66777163f4f0c67) — buyer's gas: **0 wei**, asserted, not assumed |
| **The audit log contract** | [`0x383f5153…65eef3`](https://testnet.arcscan.app/address/0x383f5153db8bb18c7c25157fb3493645a465eef3) — registrations, liveness and receipts as indexed events |
| **USDC** | [`0x3600…0000`](https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000) — Circle FiatTokenV2, the ERC-20 face of native USDC |

Measured on those transactions:

| | |
|---|---|
| x402 settlement | 91,641 gas — **$0.00185** |
| Audit-log append | 43,460 gas — **$0.00088** |
| Contract deploy | 211,940 gas — **$0.0043** |
| Buyer's gas, ever | **$0.00** |

---

## Why Arc, specifically

This project ran on Hedera first. The port is the argument.

**The gas token stops being a problem, rather than being worked around.** On
Arc, USDC *is* the native gas asset. There is no second currency to acquire, no
exchange rate to fetch, and no window in which a stale rate misprices someone's
work. An entire module of exchange-rate plumbing — a rate client, a cache with
collapse-on-concurrent-miss, tinybar conversions, and the "pay in USDC or HBAR"
branch threaded through the quote path, the 402 `accepts` array, the CLI, the
MCP server and the browser — deleted, because the choice it existed to offer no
longer exists.

**The buyer needs no gas at all, and that is mechanical.** They sign an EIP-3009
`transferWithAuthorization` — typed data, not a transaction. It never enters a
mempool. The facilitator relays it and pays the fee. Hedera reached the same
guarantee through its native fee-payer model; Arc reaches it with a standard
every EVM wallet already implements, which matters for the next reason.

**Any wallet can pay.** Hedera's x402 scheme settles a native protobuf
transfer, so ordinary EVM wallets could authenticate a user and then be unable
to pay — Privy had to be removed for exactly this. What replaced it was HashPack
over WalletConnect: a project id, a relay handshake, a second copy of the Hedera
SDK, and a genuinely nasty bug where the wallet signed only the first of several
candidate node bodies while the library merged that one signature into all of
them. On Arc the browser wallet code is one file, needs no third-party service,
and the signature is `eth_signTypedData_v4`.

**Onboarding a seller went from four steps to zero.** On Hedera a provider had
to generate an *ECDSA* key specifically, visit a faucet, wait to be assigned an
account id, paste it back, and then run `xorv wallet associate` — spending the
gas token they might not have — before USDC could land at all. Miss that last
step and payments were rejected at preflight with nothing useful said. On Arc an
address is a function of its key, exists without funding, and can receive USDC
immediately. `xorv wallet associate` is gone; there was nothing left for it to
do.

---

## Effective use of Arc's infrastructure

- **USDC as native gas** — the whole design rests on it. It is why a single
  balance is both the money and the fee budget, why there is one asset instead
  of two, and why the ERC-20/native dual view exists at all.
- **EIP-3009 on a real Circle FiatTokenV2** — the buyer signs offline and never
  broadcasts. This is what makes an autonomous agent holding one asset workable
  rather than a demo.
- **Fast, cheap blocks** — sub-second means the buyer isn't waiting on
  confirmations; thousandths of a cent means a $0.001 job isn't eaten by gas.
- **Ordinary EVM** — the audit trail is a 100-line contract, and the whole
  wallet story is a standard signature.

---

## Run it yourself

```bash
git clone <repo> && cd xorv-arc && pnpm install
cp .env.example .env          # add XORV_OPERATOR_KEY, fund it at faucet.circle.com
pnpm deploy:log               # deploy the audit contract, paste the address back
pnpm m1                       # prove a settlement, end to end, in one script
```

Then the network itself:

```bash
pnpm broker                   # terminal 1
xorv init && xorv start       # terminal 2 — become a provider
xorv run "…"                  # terminal 3 — buy a job
```

`pnpm m1` is the fastest way to see the claim: it prints both faces of the
buyer's balance, has them sign an authorization, relays it, and asserts the
buyer's gas came to zero.

---

## Stated plainly: what is not proven

A judge will find these anyway, and finding them undisclosed is worse than
reading them here.

- **Claude Code did not run a paid job on this machine.** Its OAuth token had
  expired, so the one attempt failed *after* payment — the buyer was charged
  $0.25 for nothing. That is the real failure mode and it is worth showing:
  `xorv doctor` diagnoses it exactly (*installed but signed out — every job will
  fail*), and `xorv test` catches it locally before anyone pays. The proven
  real-model job above used **Codex** instead. This is a host-environment
  problem, not a code one.

- **Three of five adapters fail under the macOS sandbox.** Codex and OpenCode
  cannot start under the seatbelt profile (`Operation not permitted` — Codex
  wants PATH aliases and an app-server socket; OpenCode wants a log file outside
  the job directory), and Grok returns empty. Confirmed by isolation: Codex runs
  fine with `XORV_SANDBOX=none`, so this is the sandbox, not the adapter and not
  Arc. **The real-model proof above was produced with the sandbox off**, and
  says so. `xorv test` reports all three as failures before a node goes live,
  which is the mitigation that matters — but the profile needs widening
  per-adapter before those three are safely sellable.

- **A buyer whose only matched provider fails is not refunded.** Payment settles
  before the job runs, because a signed authorization has a validity window a
  five-minute job would outlive. The network-level protection is reassignment to
  another provider at no extra charge — which needs a second provider to exist.
  With one, the money is gone. Observed, above, for $0.25.

- **The economics of the audit log are thin, and were nearly wrong.** Every
  entry costs gas. The heartbeat cadence inherited from Hedera — one on-chain
  proof per provider per five minutes — works out at **$0.25/day per idle
  provider**, paid by the broker, which takes a 0% fee: more per day than a
  hundred settled jobs. It is now hourly ($0.021/day). The general point stands:
  on a chain where the audit trail costs money, "write everything down" is a
  budget decision, and HCS pricing hid that.

- **Nothing is deployed publicly yet.** The Hedera version ran on Vercel behind
  a Cloudflare tunnel; this one has been proven locally against live Arc
  testnet, and the deploy has not been done.

- **A job can read the agent session it runs on.** The sandbox denies the payout
  key, SSH keys, cloud credentials and the keychain, and confines writes to the
  job directory. But the agent's own token is in the job's environment, because
  the agent needs it to work. `XORV_SANDBOX=container` closes that too.

- **The public RPC rate-limits.** Audit writes were rejected with *rate limit
  exceeded*; the canonical `rpc.testnet.arc.network` is now the default and a
  production deployment wants its own endpoint. Related: `eth_getLogs` is capped
  at ~10k blocks, so the log reader walks backwards in windows — a naive
  full-range scan does not run slowly, it *errors*, and the natural catch renders
  an empty audit trail that looks like a working feature with nothing in it yet.

---

## Before submitting

- [ ] **Rotate every credential** — the operator, buyer and provider keys in
      `.env` have been handled in a chat session and should be considered burned.
- [ ] Deploy the broker and both apps
- [ ] Record the demo video
- [ ] Re-authenticate Claude Code (`claude` once) if it should appear in the demo
