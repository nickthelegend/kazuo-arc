# World AgentKit — builder feedback

From integrating `@worldcoin/agentkit@0.2.1` into Kazuo (an x402 marketplace for AI capacity on Arc)
during ETHOnline 2026. Written while building, not afterwards, so each point is something we actually hit.

## What we built with it

- **Provider nodes prove a human is behind them.** On registration the node signs a broker-issued
  CAIP-122/SIWE challenge with its payout key; the broker verifies it and resolves the address in
  **AgentBook**. A human-backed node wins price ties ahead of track record, a buyer can require
  human-backed providers only, and one human id can back at most three live nodes. That makes the
  reputation a bot farm can manufacture (success rate) subordinate to the thing it cannot (a World ID).
- **Buying agents prove a human is behind them.** `kazuo run` and the MCP server sign the same kind of
  challenge before a quote; the job and its receipt record `buyerHumanBacked`.
- Code: `services/broker/src/agentkit.ts`, `services/broker/src/registry.ts`,
  `packages/cli/src/agentkit.ts`, `packages/mcp/src/index.ts`.

## Docs

- **The npm package has no README.** `@worldcoin/agentkit` ships only `dist/`; the npm page is empty and
  (for us) returned 403 to automated fetches. We learned the server API by reading `index.d.mts` and the
  compiled `index.mjs`. Even a short README with the three server primitives
  (`parseAgentkitHeader` → `validateAgentkitMessage` → `verifyAgentkitSignature` → `lookupHuman`) would
  have saved most of an hour.
- **The integration guide is built around `createAgentkitHooks` + x402 free-trial / discount modes.**
  That fits a paywalled API. It does not fit a marketplace that *always* charges and wants the human
  signal for ranking and sybil resistance, not for a discount. The primitives underneath support that
  perfectly well — the docs just never show them used on their own.
- **The canonical AgentBook address and chain are not stated in the guide.** It says resolution happens
  against "the canonical World Chain deployment"; the address is only discoverable in the compiled
  source. Please print it in the docs so an integrator can read it on WorldScan and check it exists. For the record,
  `@worldcoin/agentkit-core@0.2.1` hardcodes `0xA23aB2712eA7BBa896930544C7d6636a96b944dA` on World Chain mainnet.

## The x402 extension vs. a pinned quote

`agentkitResourceServerExtension.enrichPaymentRequiredResponse` mints a fresh nonce and `issuedAt` on
every 402. Kazuo freezes its payment requirements on a quote so that x402's two passes (answer 402, then
verify the payment) see byte-identical terms — anything that varies between them turns a
correctly-signed payment into a rejected one. We could not convince ourselves the per-response nonce is
excluded from the client's echo check in every path, so we used a separate challenge endpoint built from
the same primitives. **Suggestion:** document whether `agentkit` extension info is covered by
`dynamicInfoFields`, and show a "challenge endpoint" pattern for services that don't gate on the 402.

## Verification

- `verifyAgentkitSignature` for an `eip191` payload goes through `publicClient.verifyMessage`, i.e. an
  RPC round-trip, even for a plain EOA. That is the right default (it makes ERC-1271/6492 smart wallets
  work), but it means the verifier is unusable offline and every verification depends on a World Chain
  RPC being up. **Suggestion:** try local `ecrecover` first and fall back to the RPC only when it fails.
- `createAgentBookVerifier().lookupHuman` swallows every error and returns `null`. An RPC outage is
  therefore indistinguishable from "this address is not a human". For a ranking signal that is
  tolerable; for access control it silently fails closed with no log. A typed error or an `onError`
  callback would help.
- `validateAgentkitMessage` accepts a `checkNonce` callback but not an "issued by me" notion. We keep a
  map of nonces the broker minted and reject anything else, which we think should be the documented
  default rather than an integrator's idea.

## Developer Portal / Sandbox App

- Registration (`npx @worldcoin/agentkit-cli register <address>`) needs a human in World App — correct,
  and the whole point — but it means an automated build agent cannot complete the loop. We shipped and
  tested everything up to AgentBook resolution against real signatures; the final "this address resolves
  to a human" step is waiting on a person running the CLI with the Sandbox App.
- It was not obvious from the track description how the **World ID Sandbox App** relates to AgentBook on
  World Chain mainnet: does a sandbox registration write to the canonical AgentBook, or to a separate
  deployment the verifier must be pointed at via `contractAddress`? A one-line answer in the docs would
  settle it.

## What worked well

- The primitives compose cleanly and are small. Broker-side verification is ~40 lines.
- `createAgentkitClient().createHeader(extension)` made the client side trivial for both an EOA CLI and
  an MCP server — no World-specific key handling at all.
- Resolving humans on World Chain regardless of which chain the service settles on (Arc, here) is the
  right design: the identity layer and the payment layer stay independent.
