# Changelog

All notable changes to this project.

## [0.2.0] — Arc

Ported from Hedera to [Arc](https://www.circle.com/arc), Circle's L1 where USDC
is the native gas token. The 0.1.0 entry below describes the Hedera release and
is kept for the record.

### Changed

- **Settlement** is now the stock x402 EVM `exact` scheme over **EIP-3009
  `transferWithAuthorization`**. The buyer signs typed data, never broadcasts,
  and needs no gas; the facilitator relays it and pays the fee. No Xorv-specific
  scheme code, where Hedera needed a bespoke signer.
- **The audit trail** is the `XorvLog` contract — one contract, three indexed
  event streams — replacing three Consensus Service topics. Same envelope
  format, so a consumer written against the old topics still parses it.
- **Any EVM wallet can pay.** HashPack over WalletConnect is gone, along with the
  project id, the relay handshake and the second copy of the Hedera SDK. The
  browser signs `eth_signTypedData_v4`.
- **On-chain heartbeats are sampled hourly**, not every five minutes. Each entry
  costs $0.00088; at the inherited cadence an idle provider cost the broker
  $0.25/day against a 0% fee.
- Clients register the `eip155:*` wildcard rather than a network read from local
  config, so a buyer can pay whatever a broker quotes.

### Removed

- **HBAR, and the choice of asset.** Arc has one. With it went the exchange-rate
  client, its cache, the tinybar conversions, and the dual `accepts` array.
- **`xorv wallet associate`.** ERC-20 needs no opt-in; the failure it guarded
  against cannot happen.
- **Address→account-id resolution.** On Arc the address *is* the account, and it
  exists without ever being funded.
- Key-curve guessing. An EVM private key has one format.

## [0.1.0] — 2026-07-31

First release. Built for the [Hedera x402 bounty](https://hedera.com/x402-bounty/).

### The network

- **Provider CLI** (`xorv`) — `init`, `start`, `run`, `status`, `earnings`,
  `doctor`, `wallet`, `jobs`, `price`, `test`, `logs`, `config`, `pause`,
  `resume`, `cancel`, `completion`.
- **Six adapters** — `claude-code`, `codex`, `grok`, `opencode`,
  `openai-compatible` (Ollama, LM Studio, vLLM, OpenRouter…), and a built-in
  `echo` that exercises the whole payment path with nothing installed.
- **Broker** — provider registry, heartbeat liveness, price × reputation
  matching, x402 402-gating, self-hosted facilitator, HCS audit trail, SQLite
  persistence, Prometheus metrics, per-IP rate limits.
- **MCP server** (`@xorv/mcp`) — five tools that let any agent discover
  capacity, price a job, buy it, and get a HashScan link back.
- **Job board** and **landing site**.

### Payments

- x402 `exact` scheme on Hedera, via partially-signed `TransferTransaction`.
- **Buyers never need HBAR** — the facilitator co-signs as fee payer.
- Payment goes **directly from buyer to provider**; the broker is never the
  payee. Protocol fee 0%.
- USDC or HBAR, buyer's choice, priced from the Mirror Node's own exchange rate.
- Free reassignment to another provider when a job fails.

### On Hedera testnet

- Registry topic `0.0.9848245`, heartbeat `0.0.9848246`, receipts `0.0.9848247`.
- USDC `0.0.429274`.
- Receipts carry a SHA-256 of the result, so the payload stays private and the
  record stays verifiable.

### Quality

- 220 tests — unit plus a full-lifecycle integration suite that needs no Hedera
  credentials and no network.
- CI on Node 22 and 24, a Node 20.11 floor check for the CLI, and a
  committed-secret scan.
- Dockerfile and compose for the broker.

### Known limitations

Stated in full in `SECURITY.md`. The short version: the per-job directory is
blast-radius reduction rather than a sandbox; reputation is gameable; job ids
are capability tokens with no buyer authentication; there is no refund path;
rate limiting is per-process.
## 0.2.0 — Arc

Ported from Hedera to [Arc](https://www.circle.com/arc), Circle's L1 where USDC
is the native gas token. The 0.1.0 entry below describes the Hedera release and
is kept for the record.

### Changed

- **Settlement** is now the stock x402 EVM `exact` scheme over **EIP-3009
  `transferWithAuthorization`**. The buyer signs typed data, never broadcasts,
  and needs no gas; the facilitator relays it and pays the fee. No Xorv-specific
  scheme code, where Hedera needed a bespoke signer.
- **The audit trail** is the `XorvLog` contract — one contract with three
  indexed event streams — replacing three Consensus Service topics. Same
  envelope format, so a consumer written against the old topics still parses it.
- **Any EVM wallet can pay.** HashPack over WalletConnect is gone, along with the
  project id, the relay handshake and the second copy of the Hedera SDK. The
  browser signs `eth_signTypedData_v4`.
- **On-chain heartbeats are sampled hourly**, not every five minutes. Each entry
  costs $0.00088; at the inherited cadence an idle provider cost the broker
  $0.25/day against a 0% fee.
- Clients register the `eip155:*` wildcard rather than a network read from local
  config, so a buyer can pay whatever a broker quotes.

### Removed

- **HBAR, and the choice of asset.** Arc has one. With it went the exchange-rate
  client, its cache, the tinybar conversions, and the dual `accepts` array.
- **`xorv wallet associate`.** ERC-20 needs no opt-in; the failure it guarded
  against cannot happen.
- **Address→account-id resolution.** On Arc the address *is* the account, and it
  exists without ever being funded.
- Key-curve guessing. An EVM private key has one format.

## 0.1.0