# ETHOnline 2026 — Kazuo

**Kazuo turns idle AI subscription quota into a paid marketplace: every job settles as a USDC transfer on
Arc over x402, World AgentKit and World ID tell human-backed nodes and agents apart from bots, and Privy
gives anyone with an email a wallet that can pay.**

You pay for Claude, Codex or Grok and use a fraction of it. Someone else needs one job done and has to buy a
whole plan to get it. Kazuo is the rail between them. The buyer can be a person in a browser, a terminal, or
an **agent over MCP** — and the seller is a machine too: a provider node that takes work, runs it in a sandbox
and is paid directly. The human is optional on both sides of the trade, which is exactly why proving when a
human *is* there matters.

| | |
|---|---|
| Landing | https://kazuo-arc.vercel.app |
| Job board | https://kazuo-arc-app.vercel.app |
| Broker | Served during judging through a Cloudflare tunnel to the broker on the builder's machine (current URL is baked into both deployments); the Railway image is built and waits for its operator key |
| Architecture diagram | [ARCHITECTURE.md](ARCHITECTURE.md#architecture-diagram) |
| World feedback | [FEEDBACK-WORLD.md](FEEDBACK-WORLD.md) |
| Demo script | [RECORDING.md](RECORDING.md) |
| Continuity | Yes — this began as Xorv on Hedera; see "What is new at this event" below |

---

## Tracks

### Arc — Best Agentic Economy Application · Best DeFi or Agentic Application (Continuity)

Agents hold wallets and pay per job in USDC over **x402**, one of the protocols Circle's Agent Stack supports.

- **USDC is the gas token**, so a buyer — human or agent — needs nothing but the USDC it is spending.
- The buyer signs an **EIP-3009 `transferWithAuthorization`** (typed data, never broadcast). The broker's
  facilitator relays it and pays the fee. **The buyer's gas is asserted to be zero**, not assumed.
- Money moves **buyer → provider in one transfer**. The broker is never the payee; protocol fee 0%.
- Registrations, sampled heartbeats and receipts (a SHA-256 of each result) are appended to the
  **`KazuoLog`** contract on Arc, and the job board and landing page read them back from a persisted index.
- An **MCP server** lets any model discover capacity, price a job, pay and get the result, with a hard
  per-call spending ceiling; `/kazuo` does the same from inside Claude Code.

### World — AgentKit (Continuity) · Selfie Check

A capacity market sorted on reputation has an obvious attack: spin up a thousand nodes and farm the success
score. Kazuo uses World to make the one signal a bot farm cannot mint:

- Provider nodes sign a broker-issued **SIWE challenge** with their payout key
  (`GET /api/agentkit/challenge`); the broker verifies it with `@worldcoin/agentkit` and resolves the address
  in **AgentBook** on World Chain. Buyers' agents sign the same way on every quote.
- **Human-backed nodes win price ties ahead of track record.** Buyers can require human-backed providers only
  (`kazuo run --human-backed-only`, MCP `human_backed_only`). **One human can back at most three live nodes**,
  so the label cannot be bought in bulk.
- **World ID Selfie Check** as a second route to the label: the broker issues RP-signed, single-use requests,
  checks nonce, expiry, action and signal hash itself, then verifies the proof with World's API.
  `kazuo verify` shows the QR in a terminal; the job board has the same flow for buyers.
- Every job records `providerHumanBacked` and `buyerHumanBacked`; the job board shows the badge. The proof
  never changes the price and never gates payment — an anonymous agent still gets its job done.
- Feedback on docs, portal and testing: [FEEDBACK-WORLD.md](FEEDBACK-WORLD.md).

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

### Produced at this event, after the rename (Arc testnet)

| | |
|---|---|
| A real Codex job, $0.20 | settlement [`0x042613d2…6ddb`](https://testnet.arcscan.app/tx/0x042613d2c1f4fddb37629bb96aafafcc28e8654798d695ca18ed2690d5c46ddb) · receipt [`0xaffd433d…07c1`](https://testnet.arcscan.app/tx/0xaffd433d023631b1890f840eb766974a08c06886bb5b4bdd0457ad1b82f007c1) — answer `print(input()[::-1])` |
| An agent paying over MCP | settlement [`0x307792e8…9f99`](https://testnet.arcscan.app/tx/0x307792e88f11bd6c5d88661ddc1390b4c5321dd1d184c7fc0c0d0eeb76cd9f99) · receipt [`0x2cdcae5c…454a`](https://testnet.arcscan.app/tx/0x2cdcae5c05ada8cb70f432a8fcbfdabe4a47d8e3ab7d944f0736a6b54857454a) |
| CLI job, decoded from chain | settlement [`0x12c3a36b…6d10`](https://testnet.arcscan.app/tx/0x12c3a36b9eb6a36498982b35b7d14e697655e92afdefc55647ac90a32f386d10) — one USDC `Transfer` payer → provider, `from` = facilitator · receipt [`0x093bb763…acd3`](https://testnet.arcscan.app/tx/0x093bb76328c49befbb8b0482e4ec99c4bd7abe3a2baf3595c99cfe850a56acd3) with the same `resultHash` the job page shows |
| Zero-gas proof, re-run | [`0xbc95f083…4d12`](https://testnet.arcscan.app/tx/0xbc95f083b33b2d95c8317cdca5386a70b6ea88dc2e9c2075e03b1deabd9c4d12) — buyer's gas 0 wei |
| Provider registration on chain | [`0x530bcd9f…1520`](https://testnet.arcscan.app/tx/0x530bcd9f1e0014ef8edd9e9fc054db890e62b3772eb2d773689d0246c5831520) (KazuoLog kind 1) |
| Recovered after a machine restart | settlement [`0x8d77bd8c…c60a`](https://testnet.arcscan.app/tx/0x8d77bd8ca593dc229e2e926e8fd49dda50fa13701150f78ebe0e2d7a9b97c60a) · receipt [`0x748f671b…2512`](https://testnet.arcscan.app/tx/0x748f671ba0639ac43296d872991a1b08a8c3f44627ec99d532690d3347392512) |
| The audit log contract (`KazuoLog`) | [`0x383f5153…65eef3`](https://testnet.arcscan.app/address/0x383f5153db8bb18c7c25157fb3493645a465eef3) |
| World AgentKit, live | broker log on register: `agentkit proof verified — no human in AgentBook` (AgentBook `0xA23aB271…b944dA` on World Chain) |
| World ID RP signature | a request's signature recovers exactly to the registered signer `0xd4F041AB…9b78Dc` |

Every item above, plus 60 browser, API and on-chain checks with their evidence, is in
[TESTPLAN.md](TESTPLAN.md).

### Before the rename (same contracts and code paths)

| | |
|---|---|
| A real model job | [`0x83f81832…5e77f7c`](https://testnet.arcscan.app/tx/0x83f81832a17b95e3c390f264abc8cb24d2cf35ad48955155bddc21e8a5e77f7c) — $0.20 to a Codex node |
| The browser wallet path | [`0xb495004c…ce4c5c14`](https://testnet.arcscan.app/tx/0xb495004c5f6edf913bd80b3522e0c6c6776d967d77376c19baed83cace4c5c14) — EIP-712 typed data from the app's payment code |
| Full lifecycle | [`0xad0887af…ff8113d`](https://testnet.arcscan.app/tx/0xad0887afa017182d22f82fd7a51336381fae0f69cbb8df42686b63e45ff8113d) |
| The zero-gas proof | [`0x9c1fed2b…f4f0c67`](https://testnet.arcscan.app/tx/0x9c1fed2b2c87bf85bef22045ff3a440e3d4463c2147cdd00f66777163f4f0c67) |

Measured: x402 settlement 91,641 gas ($0.00185); audit append 43,460 gas ($0.00088); buyer's gas, ever: $0.00.

---

## What is new at this event (continuity)

- **World AgentKit** end to end: broker-minted SIWE challenge, verification, AgentBook resolution on World
  Chain, ranking and sybil rules, CLI and MCP proofs, `kazuo agentkit`, UI badge.
- **World ID Selfie Check**: RP-signed requests, broker-side nonce/replay checks, World verify API,
  `kazuo verify` terminal QR, job-board widget.
- **Privy** sign-in with embedded wallets that pay over x402, and Send USDC.
- **World Chain networks** (`eip155:4801`, `eip155:480`) in the protocol package.
- **A persisted forward index of the audit log**, so receipts are readable however old, without scanning the
  chain per request; RPC-budget aware so it never starves settlements.
- **Renamed Xorv → Kazuo** across every package, binary, env var, tool and doc.
- **Public deployment** of the landing page and job board on Vercel; broker image for Railway.
- Architecture diagram, World feedback document, end-to-end test plan with live evidence.

What existed before the event: the x402 marketplace on Arc — broker, CLI, MCP server, sandbox, job board,
landing page, the audit trail (then named `XorvLog`), and the pre-rename Arc proofs above.

---

## Stated plainly: what is not proven

A judge will find these anyway, and finding them undisclosed is worse than reading them here.

- **The broker runs on the builder's machine during judging**, reached through a Cloudflare quick tunnel.
  The Railway image builds, but the service needs its operator key, which the owner sets and tooling never
  pushes. If the tunnel restarts its URL changes and both frontends need a redeploy.
- **No address is registered in AgentBook, and no Selfie Check scan has been completed.** Verification,
  AgentBook resolution, the RP-signed World ID request and the ranking rules are live, but the human step
  needs a person with World App. Until then every node reads "not proven".
- **No on-chain payment from a Privy embedded wallet yet.** The Privy modal and app config are live on the
  deployed job board; the first payment needs a signed-in email user holding testnet USDC.
- **World Chain settlement is supported in configuration only.** The facilitator holds no ETH on World Chain
  Sepolia, so no job has settled there. Arc is the settlement network that is proven.
- **Privy server wallets and policies (the B2B track) are not built.** The app secret available was rejected
  by Privy's API.
- **The CLI, MCP server and protocol package are not on npm yet.** Every install path builds from the public
  repository, https://github.com/nickthelegend/kazuo-arc, and the landing page says so.
- **The demo node sells Claude Code, not Codex, since 18:20 IST on 13 Sep.** The demo account's Codex usage limit
  is spent until 12 Oct 2026, and a paid Codex job failed after settlement because of it (`job_aDSA7n2vmveY`).
  Claude Code runs under the macOS seatbelt sandbox and has a paid proof. It reads its login from the keychain
  for each job, so a lapsed token fails a job; `kazuo test` catches that before a node sells it.
- **Codex under the sandbox is fixed but not proven by a paid job**, for the same quota reason. It used to exit
  before reading its prompt under seatbelt; now it passes `kazuo test` there. OpenCode and Grok are unproven under
  seatbelt; `kazuo test` and `kazuo doctor` say which adapters work under which sandbox.
- **A buyer whose only matched provider fails is not refunded.** Payment settles before the job runs because
  an EIP-3009 authorization expires; the protection is free reassignment, which needs a second provider.
- **The audit log costs gas.** Heartbeats are sampled hourly because every entry costs $0.00088 and the broker
  takes a 0% fee.
- **Keys in the development `.env` have passed through chat sessions** and must be rotated before any real
  value touches them.
