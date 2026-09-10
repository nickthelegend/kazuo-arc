# ETHOnline 2026 — Kazuo

**Kazuo turns idle AI subscription quota into a paid marketplace: every job settles as a USDC transfer on
Arc over x402, World AgentKit tells human-backed nodes and agents apart from bots, and Privy gives anyone
with an email a wallet that can pay.**

You pay for Claude, Codex or Grok and use a fraction of it. Someone else needs one job done and has to buy a
whole plan to get it. Kazuo is the rail between them. The buyer can be a person in a browser, a terminal, or
an **agent over MCP** — and the seller is a machine too: a provider node that takes work, runs it in a sandbox
and is paid directly. The human is optional on both sides of the trade, which is exactly why proving when a
human *is* there matters.

| | |
|---|---|
| Landing | https://kazuo-arc.vercel.app |
| Job board | https://kazuo-arc-app.vercel.app |
| Broker | `https://broker-production-03b2.up.railway.app` (Railway) |
| Architecture diagram | [ARCHITECTURE.md](ARCHITECTURE.md#architecture-diagram) |
| World feedback | [FEEDBACK-WORLD.md](FEEDBACK-WORLD.md) |
| Continuity | Yes — this began as Xorv on Hedera; see "What is new at this event" below |

---

## Tracks

### Arc — Best Agentic Economy Application · Best DeFi or Agentic Application (Continuity)

Agents hold wallets and pay per job in USDC over **x402**, one of the protocols Circle's Agent Stack supports.

- **USDC is the gas token**, so a buyer — human or agent — needs nothing but the USDC it is spending.
- The buyer signs an **EIP-3009 `transferWithAuthorization`** (typed data, never broadcast). The broker's
  facilitator relays it and pays the fee. **The buyer's gas is asserted to be zero**, not assumed.
- Money moves **buyer → provider in one transfer**. The broker is never the payee; protocol fee 0%.
- Receipts (a SHA-256 of each result) are appended to the **`KazuoLog`** contract on Arc.
- An **MCP server** lets any model discover capacity, price a job, pay and get the result, with a hard
  per-call spending ceiling.

### World — AgentKit (Continuity)

A capacity market sorted on reputation has an obvious attack: spin up a thousand nodes and farm the success
score. Kazuo uses **AgentKit** to make the one signal a bot farm cannot mint:

- Provider nodes sign a broker-issued **SIWE challenge** with their payout key
  (`GET /api/agentkit/challenge`); the broker verifies it with `@worldcoin/agentkit` and resolves the address
  in **AgentBook** on World Chain.
- **Human-backed nodes win price ties ahead of track record.** Buyers can require human-backed providers only
  (`kazuo run --human-backed-only`, MCP `human_backed_only`). **One human can back at most three live nodes**,
  so the label cannot be bought in bulk.
- **Buying agents prove themselves the same way.** Every job records `providerHumanBacked` and
  `buyerHumanBacked`; the job board shows the badge.
- The proof never changes the price and never gates payment — an anonymous agent still gets its job done.
- `kazuo agentkit status` reads AgentBook for the node's address; `kazuo agentkit register` starts World App
  verification. Feedback on docs, portal and testing: [FEEDBACK-WORLD.md](FEEDBACK-WORLD.md).

### Privy — Best Financial Flow

- **Email → wallet → paid job, with no gas and no extension.** Privy creates an embedded wallet on Arc at
  sign-in. A job payment is an EIP-712 signature rather than a transaction, so that wallet can pay the moment
  it holds USDC — no network to add, no gas token to buy.
- **Send USDC** from the same wallet popover (an ERC-20 transfer; on Arc its gas is USDC too).
- Existing wallets (MetaMask, Rabby, …) connect through the same Privy modal and pay through the same code.
- Why it matters here: the Hedera version of this app *had to remove Privy*, because Hedera's x402 scheme
  settles a native protobuf transfer an EVM wallet cannot sign. On Arc the payment is typed data, and Privy
  came back as the default way in.

---

## Proof

### Already on Arc testnet (produced before the Xorv → Kazuo rename, same contracts and code paths)

| | |
|---|---|
| A real model job, bought and paid for | [`0x83f81832…5e77f7c`](https://testnet.arcscan.app/tx/0x83f81832a17b95e3c390f264abc8cb24d2cf35ad48955155bddc21e8a5e77f7c) — $0.20 to a Codex node, prompt in, working code out |
| The browser wallet path | [`0xb495004c…ce4c5c14`](https://testnet.arcscan.app/tx/0xb495004c5f6edf913bd80b3522e0c6c6776d967d77376c19baed83cace4c5c14) — EIP-712 typed data from the app's payment code |
| Full lifecycle: quote → 402 → pay → dispatch → result → receipt | [`0xad0887af…ff8113d`](https://testnet.arcscan.app/tx/0xad0887afa017182d22f82fd7a51336381fae0f69cbb8df42686b63e45ff8113d) |
| The zero-gas proof | [`0x9c1fed2b…f4f0c67`](https://testnet.arcscan.app/tx/0x9c1fed2b2c87bf85bef22045ff3a440e3d4463c2147cdd00f66777163f4f0c67) — buyer's gas: 0 wei |
| The audit log contract (`KazuoLog`) | [`0x383f5153…65eef3`](https://testnet.arcscan.app/address/0x383f5153db8bb18c7c25157fb3493645a465eef3) |
| USDC | [`0x3600…0000`](https://testnet.arcscan.app/token/0x3600000000000000000000000000000000000000) — Circle FiatTokenV2 |

Measured on those transactions: x402 settlement 91,641 gas ($0.00185); audit append 43,460 gas ($0.00088);
contract deploy 211,940 gas ($0.0043); buyer's gas, ever: $0.00.

### Deployed at this event

| | |
|---|---|
| Landing | https://kazuo-arc.vercel.app — built and typechecked on Vercel, verified live |
| Job board, with Privy | https://kazuo-arc-app.vercel.app — built and typechecked on Vercel; Privy bundled with the app id |
| Broker image | Builds on Railway (`pnpm install --frozen-lockfile` + `tsc` inside the image) |

---

## What is new at this event (continuity)

- **World AgentKit** end to end: broker gate, registry rules, CLI and MCP proofs, `kazuo agentkit`, UI badge.
- **Privy** sign-in with embedded wallets that pay over x402, and Send USDC.
- **World Chain networks** (`eip155:4801`, `eip155:480`) in the protocol package.
- **Renamed Xorv → Kazuo** across every package, binary, env var, tool and doc.
- **Public deployment**: Vercel (landing, job board) and Railway (broker with a persistent volume).
- Architecture diagram, World feedback document.

What existed before the event: the x402 marketplace on Arc — broker, CLI, MCP server, sandbox, job board,
landing page, the audit trail (then named `XorvLog`), and the Arc proofs above.

---

## Stated plainly: what is not proven

A judge will find these anyway, and finding them undisclosed is worse than reading them here.

- **The Railway broker is not serving yet.** Its image builds and the container starts, then stops at one
  missing secret: the operator key. That key was deliberately not pushed to Railway by the build agent; the
  owner sets it. Until then the deployed job board cannot list providers.
- **No address is registered in AgentBook yet.** The verification, AgentBook resolution and ranking rules are
  implemented, but registering an address requires a person to verify in World App. Until someone does, every
  node reads as "not proven".
- **The Privy flow has no on-chain payment from an embedded wallet yet.** It is deployed and bundled; the
  first payment needs a signed-in user holding testnet USDC.
- **World Chain settlement is supported in configuration only.** The facilitator holds no ETH on World Chain
  Sepolia, so no job has settled there. Arc is the settlement network that is proven.
- **Privy server wallets and policies (the B2B track) are not built.** The app secret available to the build
  was rejected by Privy's API.
- **Claude Code did not run a paid job on the original host** — its OAuth token had expired, so the proven
  real-model job used Codex. `kazuo doctor` names the failure; `kazuo test` catches it before anyone pays.
- **Three of five adapters fail under the macOS sandbox** (Codex and OpenCode cannot start under seatbelt,
  Grok returns empty). The real-model proof ran with `KAZUO_SANDBOX=none`, and says so.
- **A buyer whose only matched provider fails is not refunded.** Payment settles before the job runs because
  an EIP-3009 authorization expires; the protection is free reassignment, which needs a second provider.
- **The audit log costs gas.** Heartbeats are sampled hourly ($0.021/day per idle provider) because every
  entry costs $0.00088 and the broker takes a 0% fee.
- **Keys in the development `.env` have passed through chat sessions** and should be rotated before any real
  value touches them.
