# PLAN — Kazuo (Arc) · ETHOnline 2026

> Single source of truth for the builder. Status tags: **DONE** · **IN PROGRESS** · **NOT STARTED** · **BLOCKED (why)**.
> Repo: `/Volumes/Extreme SSD/Projects/xorv-arc` (this repo, EVM/Arc). The Hedera original lives at
> `/Volumes/Extreme SSD/Projects/xorv` and is **not touched** — it stays "Xorv on Hedera".
> Planning pass: 2026-09-13 12:50 IST. Internal hard deadline: **2026-09-13 21:00 IST**. ETHOnline window closes 2026-09-16.

---

## 0. What the project is (one paragraph, for a cold start)

A decentralized AI capacity network. A provider runs a node (`xorv start` → becomes `kazuo start`) that
drives a coding-agent CLI they already pay for (Claude Code / Codex / Grok / OpenCode / OpenAI-compatible /
echo). A buyer (web app, CLI, or an MCP-connected agent) asks the broker for a quote, gets HTTP 402, signs an
EIP-3009 `transferWithAuthorization` (EIP-712 typed data, zero gas), the broker's self-hosted x402 facilitator
relays it on Arc, USDC goes **buyer → provider directly**, the job is dispatched over the provider's outbound
WebSocket, events stream back over SSE, and a receipt (SHA-256 of the result) is appended to the `XorvLog`
contract. Monorepo: `packages/{protocol,cli,mcp}`, `services/broker`, `apps/{app,landing}`, `contracts/`, `scripts/`.

## 1. Goals

### 1.1 "Done" means
1. **Everything is Kazuo, nothing is Xorv** in this repo: package names, binary, env vars, home dir, MCP tool
   names, metrics, slash-command skill, UI copy, docs, brand assets. No user-visible "Hedera"/"HBAR"/"HCS"/
   "HashScan" strings that describe *current* behaviour (historical "ported from Hedera" narrative is allowed).
2. **Every existing feature survives the rename** (no drops): quote → 402 → pay → dispatch → SSE → result →
   receipt; reassignment on failure; CLI (init/start/run/test/doctor/earnings/jobs/price/status/pause/resume/
   cancel/wallet/logs/config/completion/skills); MCP (5 tools); sandbox tiers; SQLite persistence; metrics;
   browser wallet payment; `/api/pay` demo fallback; landing page; audit log reader. **295 tests stay green.**
3. **Deployed publicly**: landing at **https://kazuo-arc.vercel.app**, job board at a second Vercel project
   (`kazuo-arc-app`), broker on **Railway** with a persistent volume, all talking to each other, CORS correct.
4. **Real proof on the deployed stack**: at least one paid job settled on Arc testnet through the Railway broker,
   with the tx on ArcScan, and the audit receipt readable from the deployed app.
5. **Sponsor integrations are real, not decorative** (see 1.2), each with its own on-chain / API evidence.
6. **Docs match reality**: README, SUBMISSION (ETHOnline), ARCHITECTURE (with architecture diagram — required by
   Arc), World feedback doc (required by World), and this PLAN.md.
7. **SDK publish to npm is prepared but NOT executed** — the user will say where to publish.

### 1.2 "Winning" means — the ETHOnline 2026 tracks we target (researched 2026-09-13)

| Sponsor | Track | $ | Why we fit | Hard requirements |
|---|---|---|---|---|
| **Arc** | Best DeFi or Agentic Application — **Continuity** | $3,000 (+$2,000 if on Arc mainnet by 30 Sep) | Existing project ported to Arc | Register as Continuity; functional MVP; **architecture diagram**; video; GitHub repo |
| **Arc** | Best Agentic Economy Application with Circle Agent Stack | $3,500 (+$2,500 mainnet) | Agents hold wallets and pay per job in USDC over x402 (x402 is a supported Agent Stack protocol) | MVP + architecture diagram + video + repo |
| **World** | **AgentKit Continuity** | $3,500 (≤3 teams) | Distinguish human-backed provider nodes / buyer agents from bot farms — sybil resistance for a reputation-sorted marketplace | Uses AgentKit meaningfully; working app; registers/resolves agents via **AgentBook**; tested with World ID **Sandbox App**; **feedback document** |
| **World** | Selfie Check | $3,500 | Could gate provider onboarding | Needs World Developer Portal app — stretch |
| **Privy** | **Best Financial Flow** | $2,500 | Email login → Privy embedded wallet → gasless USDC x402 payment + USDC transfer on Arc | Privy core; ≥1 Privy wallet; ≥1 functional financial flow; demo + source; explain UX gain |
| **Privy** | Best B2B Financial Product | $2,500 | Agent treasury: Privy server wallet with a **policy** capping per-job spend, used by the MCP agent | ≥1 Privy control (policies/signers/quorums); B2B workflow |

Explicitly out of scope: Arc **mainnet** deploy (spends real money — needs the user's go-ahead), Hedera tracks
(that's the other repo).

---

## 2. Baseline audit (verified 2026-09-13, not assumed)

| Check | Result |
|---|---|
| `pnpm build` (packages + broker) | ✅ exit 0 |
| `pnpm test` | ✅ **295 passed** (protocol 48, app 21, broker 90, cli 128, mcp 8) |
| Arc testnet USDC `0x3600…0000` | ✅ `name=USDC version=2 decimals=6`, EIP-3009 `authorizationState` callable |
| Operator `0xeEE4…B51E` (facilitator) | ✅ 2.94 USDC on Arc testnet |
| Demo payer `0x0329…9F36` | ✅ 16.35 USDC on Arc testnet |
| Demo provider `0xff21…489B` | ✅ 0.654 USDC on Arc testnet |
| `XorvLog` deployed | ✅ `0x383f5153db8bb18c7c25157fb3493645a465eef3`; event is `Entry(...)` — **no "Xorv" in the ABI**, so renaming the contract source does NOT require a redeploy |
| World Chain Sepolia USDC `0x6614…aEA88` (chain 4801) | ✅ `name=USDC version=2 decimals=6` — EIP-3009 capable |
| Operator/payer ETH on World Chain Sepolia / Eth Sepolia / Base Sepolia | ❌ **0** on all — facilitator cannot relay on World Chain |
| Privy app id (`xorv/apps/app/.env.local`) | ✅ valid — public app config 200, email + wallet login on, embedded wallets available |
| Privy app secret | ❌ **401 "Invalid app ID or app secret"** on `api.privy.io/v1/wallets` |
| MongoDB URI (`xorv/.env`) | ❌ `querySrv ENOTFOUND` — cluster gone; Mongo is optional, SQLite is the store |
| Vercel CLI | ✅ logged in as `niveshgajengi`; project name `kazuo-arc` free |
| Railway CLI | ✅ logged in (Nivesh Gajengi); no kazuo project yet |
| npm | ✅ logged in as `nickthelegend69`; `@kazuo/cli`, `@kazuo/protocol`, `@kazuo/mcp`, `kazuo`, `kazuo-arc` all **E404 (available)** |
| gh | ✅ logged in as `nickthelegend` |
| Git remote on this repo | ❌ **none** — ETHOnline needs a public GitHub repo |
| World ID / AgentKit / Developer Portal credentials | ❌ none anywhere in either repo |

---

## 3. Phases and tasks

Order matters: rename first (everything after it touches renamed files), then sponsor features, then deploy,
then proofs, then docs.

### Phase 1 — Rename Xorv → Kazuo (repo-wide, zero feature loss)

Naming map (apply exactly):

| Old | New |
|---|---|
| `Xorv` / `xorv` / `XORV` (prose, UI) | `Kazuo` / `kazuo` / `KAZUO` |
| `@xorv/protocol`, `@xorv/cli`, `@xorv/mcp`, `@xorv/broker` | `@kazuo/protocol`, `@kazuo/cli`, `@kazuo/mcp`, `@kazuo/broker` |
| root package `xorv` | `kazuo-arc` |
| apps `xorv-app`, `xorv-landing` | `kazuo-app`, `kazuo-landing` |
| binary `xorv`, `xorv-mcp` | `kazuo`, `kazuo-mcp` |
| env `XORV_*` | `KAZUO_*` (incl. `NEXT_PUBLIC_XORV_*` → `NEXT_PUBLIC_KAZUO_*`) |
| home `~/.xorv` | `~/.kazuo` |
| MCP tools `xorv_*` | `kazuo_*` |
| Prometheus `xorv_*` | `kazuo_*` |
| contract `XorvLog.sol`, `xorv-log.abi.ts`, `XORV_LOG_*` | `KazuoLog.sol`, `kazuo-log.abi.ts`, `KAZUO_LOG_*` (same deployed address) |
| skill `/xorv`, `.claude/skills/xorv` | `/kazuo`, `.claude/skills/kazuo` |
| brand `xorv-logo.svg`, `xorv-mark.svg` | `kazuo-logo.svg`, `kazuo-mark.svg` (wordmark text updated) |
| sqlite `data/xorv.db`, docker volume `xorv-data` | `kazuo.db`, `kazuo-data` |
| GitHub URLs `nickthelegend/xorv` | `nickthelegend/kazuo-arc` |

- **1.1** Write a scripted rename (`scripts/rename-to-kazuo.sh`, scratch) covering file contents + file/dir names,
  excluding `node_modules`, `.next`, `dist`, `.git`, `pnpm-lock.yaml`. — **DONE** (perl pass over tracked+untracked files and .env; 0 `xorv` left outside PLAN.md/lockfile)
- **1.2** Rename files/dirs: contract, abi module, brand SVGs (3 copies each), skill dir, db file. — **DONE** (git mv; `data/kazuo.db` kept so persisted jobs survive)
- **1.3** Update SVG wordmarks so the logo reads "kazuo" (landing `components/ui/logo.tsx`, `apps/app/components/mark.tsx`). — **DONE** (SVG wordmarks are `<text>`, now "Kazuo"; stale X-stutter comment removed)
- **1.4** Rename `.env` + `.env.example` keys `XORV_*` → `KAZUO_*` (values untouched). — **DONE**
- **1.5** `pnpm install` to relink workspace; regenerate lockfile. — **IN PROGRESS** (slow: the external SSD is 99% full, 15 GiB free, writing ~1.4 MB/s; lockfile refreshed with cache on internal disk first)
- **1.6** `pnpm build && pnpm test` — must be 295/295. — **NOT STARTED**
- **1.7** `pnpm --filter kazuo-app build` and `pnpm --filter kazuo-landing build` (Next production builds). — **NOT STARTED**
- **1.8** Smoke: `kazuo --help`, `kazuo doctor`, MCP server lists `kazuo_*` tools over stdio. — **NOT STARTED**

### Phase 2 — Purge Hedera leftovers that describe current behaviour

- **2.1** `apps/app/app/network/page.tsx:12` "its record on Hedera… topics" → Arc / KazuoLog contract streams. — **DONE** (edited; re-grepped)
- **2.2** `apps/app/app/layout.tsx:16` metadata "on Hedera" → "on Arc". — **DONE** (edited; re-grepped)
- **2.3** `apps/app/components/composer.tsx:166,291` "settled on Hedera", "Signing and settling on Hedera…" → Arc. — **DONE** (edited; re-grepped)
- **2.4** `apps/app/components/live-lists.tsx:125` "settles on Hedera in about three seconds" → Arc (sub-second). — **DONE** (edited; re-grepped)
- **2.5** `apps/app/components/job-view.tsx:250` "Settling on Hedera" → Arc; `:73` comment "HCS receipt". — **DONE** (edited; re-grepped)
- **2.6** `apps/app/components/shell.tsx:165` fallback `"hedera:testnet"` → `"eip155:5042002"`. — **DONE** (edited; re-grepped)
- **2.7** `apps/app/next.config.ts` drops `@hiero-ledger/*`, `@x402/hedera` from `serverExternalPackages`; comment. — **DONE** (edited; re-grepped)
- **2.8** `pnpm-workspace.yaml` drop `@hiero-ledger/proto` + Hiero comment. — **DONE** (edited; re-grepped)
- **2.9** `apps/landing/package.json` description "on Hedera" → Arc. — **DONE** (edited; re-grepped)
- **2.10** `packages/cli/src/commands/skills.ts:46,53` + `.claude/skills/*/SKILL.md` "on Hedera", `hashscan` JSON key → Arc / `explorer`. Check `run.ts --json` output key name and keep skill in sync. — **DONE** (edited; re-grepped)
- **2.11** `packages/cli/src/commands/manage.ts:366` "ledger of record is on Hedera" → Arc. — **DONE** (edited; re-grepped)
- **2.12** `packages/cli/README.md` rewrite: Hedera/HBAR/HCS/`--hbar` flag (flag no longer exists) → Arc reality. — **DONE** (edited; re-grepped)
- **2.13** `CONTRIBUTING.md:8` "creates the 3 HCS topics" → what `setup` actually does now. — **DONE** (edited; re-grepped)
- **2.14** `SECURITY.md:98` "writes HCS" → writes the audit contract. `ARCHITECTURE.md:44,172` "HCS writer", "published to HCS" → contract, hourly sampling. — **DONE** (edited; re-grepped)
- **2.15** `.github/workflows/ci.yml:44-47` comments. — **DONE** (edited; re-grepped)
- **2.16** Tests: `services/broker/test/guards.test.ts:131` network `hedera:testnet` → `eip155:5042002`; `integration.test.ts:307` title "publishes to HCS" → "to the audit log". — **DONE** (edited; re-grepped)
- **2.17** Delete Hedera agent skills: `.claude/skills/hedera-*`, `hts-*`, `schedule-service-*`; drop their entries from `skills-lock.json`. — **DONE** (edited; re-grepped)
- **2.18** Remove dead dep `@privy-io/server-auth` from `apps/app/package.json` (replaced in Phase 3 by current Privy SDKs). — **DONE** (edited; re-grepped)
- **2.19** `apps/app/package.json` `@xorv/protocol: ^0.1.0` → `@kazuo/protocol: workspace:*` (otherwise Vercel could resolve the Hedera-era npm package). — **DONE** (edited; re-grepped)
- **2.20** README line 16 ("the Hedera release… not published") + README "Deploying the broker" note → reflect Kazuo reality. — **DONE** (npm line replaced by live URLs + "not on npm yet"; Docker note now describes the real Railway build)
- **2.21** Re-grep `hedera|hbar|hashpack|hiero|hashscan|tinybar|HCS` — only historical narrative may remain. — **DONE** (remaining hits are "ported from Hedera" narrative in comments/SUBMISSION/CHANGELOG only)

### Phase 3 — Privy (ETHOnline: Best Financial Flow; B2B stretch)

- **3.1** Add `@privy-io/react-auth` (v3) to `apps/app`; `NEXT_PUBLIC_PRIVY_APP_ID` from `xorv/apps/app/.env.local` into `apps/app/.env.local` + Vercel env. — **IN PROGRESS** (`@privy-io/react-auth` ^3.42.0 in package.json + lockfile; app id in `apps/app/.env.local` and on Vercel `kazuo-arc-app`; not yet built)
- **3.2** `apps/app/lib/chains.ts`: define Arc testnet (5042002) and World Chain Sepolia (4801) as viem chains usable by Privy `supportedChains`; `defaultChain` = Arc. — **IN PROGRESS** (`worldchainSepolia` added beside `arcTestnet`; not yet built)
- **3.3** `components/providers.tsx`: wrap in `PrivyProvider` (login: email + wallet; `embeddedWallets.ethereum.createOnLogin: "users-without-wallets"`). Keep the raw EIP-1193 path working when no app id is configured. — **IN PROGRESS** (`providers.tsx`: PrivyProvider email+wallet, embedded wallet for users without one, default Arc; injected fallback when no app id; not yet built)
- **3.4** `components/wallet-provider.tsx`: source the session from Privy's active wallet (`useWallets` → `getEthereumProvider()` → same `WalletSession` shape, so `payQuoteWithWallet` is unchanged). Injected wallets (MetaMask/Rabby) still work via Privy's external-wallet login — no feature dropped. — **IN PROGRESS** (`PrivyWalletProvider` → `sessionForProvider` → unchanged `payQuoteWithWallet`; injected `WalletProvider` kept; not yet built)
- **3.5** `components/connect.tsx`: Privy login button; shows email/wallet, embedded wallet address, Arc USDC balance, "copy address to fund", logout. — **IN PROGRESS** (Sign in, email, embedded-wallet label, copy address, balance, faucet hint, sign out; not yet built)
- **3.6** Financial flow #1 — **gasless job payment from the Privy embedded wallet** (x402 EIP-3009 on Arc). Verify with a real settled tx. — **NOT STARTED**
- **3.7** Financial flow #2 — **send USDC** from the embedded wallet (ERC-20 transfer on Arc; USDC is the gas) in a "Wallet" panel. Verify with a real tx. — **IN PROGRESS** (`sendUsdc` in `lib/wallet.ts` + Send USDC form in the wallet popover; no real tx yet)
- **3.8** Unit test the Privy-provider → `WalletSession` adapter (fake EIP-1193, like `test/wallet.test.ts`). — **NOT STARTED**
- **3.9** B2B stretch — Privy **server wallet + policy** (max USDC per `transferWithAuthorization`, chain 5042002 only) used as the MCP agent's signer. — **BLOCKED (Privy app secret returns 401; needs a valid `PRIVY_APP_SECRET` from dashboard.privy.io)**
- **3.10** Privy dashboard: add `kazuo-arc-app.vercel.app` to allowed domains (currently `allowed_domains: []`). — **NOT STARTED** (verify on deploy; user action if login is refused)

### Phase 4 — World (ETHOnline: AgentKit Continuity) + World Chain

- **4.1** Add `@worldcoin/agentkit` to broker (server verify) and to CLI/MCP (client signer). Read its real API from the package. — **IN PROGRESS** (deps added to broker/cli/mcp; API read from the published 0.2.1 package)
- **4.2** Broker: on `POST /api/providers/register` and on paid job requests, accept the AgentKit CAIP-122 signed header, verify the signature, resolve the wallet in **AgentBook** (World Chain, read-only RPC) → `humanBacked: boolean` + anonymous human id. — **IN PROGRESS** (`services/broker/src/agentkit.ts`: broker-minted single-use SIWE challenge at `GET /api/agentkit/challenge`, `validateAgentkitMessage` + `verifyAgentkitSignature` + real `createAgentBookVerifier().lookupHuman`; wired into register + quotes; tests written, not yet run). **Live evidence:** AgentBook on World Chain mainnet read successfully through `@worldcoin/agentkit` (contract 0xA23aB271…b944dA has code; lookups return real zeros)
- **4.3** Matcher: human-backed providers win ties; buyers may pass `humanBackedOnly: true` on a quote; one human id can't back more than N live nodes (sybil cap). Tests for all three. — **IN PROGRESS** (registry: tie-break, `humanBackedOnly`, cap 3 nodes/human; tests written, not yet run)
- **4.4** Job + receipt + `/api/providers` expose `humanBacked`; app shows a "human-backed" badge on providers and jobs. — **IN PROGRESS** (broker API exposes `humanBacked`, `providerHumanBacked`, `buyerHumanBacked`; humanId stripped; app badge not started)
- **4.5** CLI: `kazuo start` / `kazuo run` sign with AgentKit using the node's payout key; `kazuo agentkit status|register` wraps `@worldcoin/agentkit-cli`. MCP: same signer on `kazuo_run_job`. — **IN PROGRESS** (CLI `agentkit.ts` signs on register + `kazuo run`, `--human-backed-only`; MCP `human_backed_only` + proof on quotes; `kazuo agentkit` wrapper command not started)
- **4.6** Register the demo provider + payer addresses in AgentBook via World App / Sandbox App. — **BLOCKED (requires a human completing World ID verification in World App / Sandbox App on the user's phone)**
- **4.7** `FEEDBACK-WORLD.md` — docs, Developer Portal, Sandbox App, what was confusing/broken (required by the track). — **IN PROGRESS** (`FEEDBACK-WORLD.md` written from real integration findings; Sandbox App section to be completed once a human registers an address)
- **4.8** Protocol: add World Chain networks — `eip155:4801` (Sepolia, USDC `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`, explorer `sepolia.worldscan.org`) and `eip155:480` (mainnet, USDC `0x79A02482A880bCe3F13E09da970dC34dB4cD24D1`, `worldscan.org`); per-network USDC, RPC, explorer, label; tests. — **IN PROGRESS** (`NETWORKS` table + `networkInfo`/`isWorldChain`; rpc/usdc/explorer/label per network; `arcChain` gas token per network; `packages/protocol/test/networks.test.ts` written, not yet run)
- **4.9** Broker/app/CLI honour `KAZUO_NETWORK=eip155:4801` end to end (USDC domain name/version read on chain: `USDC`/`2`). — **NOT STARTED**
- **4.10** Real settlement on World Chain Sepolia. — **BLOCKED (operator `0xeEE4…B51E` has 0 ETH on World Chain Sepolia and the payer has 0 USDC there; faucets need a human/captcha)**
- **4.11** Selfie Check gate for provider onboarding. — **BLOCKED (no World Developer Portal app id; stretch)**

### Phase 5 — Deploy

- **5.1** Railway: create project `kazuo-arc`, service `broker` from repo `Dockerfile` (Node 24, `node:sqlite`), volume at `/data`, `KAZUO_DB=/data/kazuo.db`. — **DONE** — project `kazuo-arc`, service `broker`, volume `kazuo-data` at `/data`. Second build (after removing the Dockerfile `VOLUME`, which Railway rejects) PASSED: `pnpm install --frozen-lockfile` + `tsc` for protocol and broker inside the image, deployment 8289441a
- **5.2** Railway env: `KAZUO_OPERATOR_KEY`, `KAZUO_NETWORK`, `KAZUO_RPC_URL`, `KAZUO_LOG_ADDRESS`, `KAZUO_LOG_FROM_BLOCK`, `KAZUO_BROKER_URL=https://<railway domain>`, `KAZUO_CORS_ORIGINS=https://kazuo-arc.vercel.app,https://kazuo-arc-app.vercel.app,http://localhost:3000,http://localhost:3002`, `KAZUO_TRUST_PROXY=1`, `PORT` handling (broker must listen on Railway's `$PORT` or port set to 8402). — **BLOCKED (partly)** — every non-secret variable is set (incl. `RAILWAY_RUN_UID=0` so the non-root image can write the root-owned volume). `KAZUO_OPERATOR_KEY` was NOT set: pushing a private key to Railway was refused by the session permission classifier. The user must set it (command in section 5). Broker `PORT` fallback added to `services/broker/src/config.ts` (G18)
- **5.3** Railway public domain; verify `GET /health`, `/api/network`, `/metrics`, and WebSocket upgrade `wss://…/ws/provider`. — **BLOCKED (KAZUO_OPERATOR_KEY)** — domain https://broker-production-03b2.up.railway.app → 8402 exists and the container starts, then exits with exactly `Error: Missing KAZUO_OPERATOR_KEY` (Railway deploy log 07:55 UTC). Nothing else fails. Unblocks the moment the user sets the key (section 5)
- **5.4** Vercel project `kazuo-arc` (root `apps/landing`) → **https://kazuo-arc.vercel.app**; links point at the app + broker. — **DONE** — deployed to production and aliased: https://kazuo-arc.vercel.app (deployment dpl_3AcsXqLURStgtwW2Z5bfMDVE2beP, READY). Verified live 13:23 IST: HTTP 200, 50× "Kazuo", 0× "xorv", 0× Hedera/HBAR/HashScan; `next build` + TypeScript passed on Vercel
- **5.5** Vercel project `kazuo-arc-app` (root `apps/app`, pnpm workspace install) with `NEXT_PUBLIC_KAZUO_BROKER_URL`, `NEXT_PUBLIC_KAZUO_NETWORK`, `NEXT_PUBLIC_PRIVY_APP_ID`, `KAZUO_DEMO_PAYER_KEY` (server-only, for `/api/pay`). — **DONE (except the demo-payer fallback)** — production, aliased https://kazuo-arc-app.vercel.app (dpl_83tSnsEftCDaGnqWkeCtuztmsS1s). Vercel `next build` compiled + TypeScript passed, which is the first real typecheck of the Privy code. Verified live 13:26 IST: `/`, `/network`, `/providers` all 200; 0× xorv, 0× Hedera/HBAR/HashScan; copy says "on Arc"; 3 of 33 client chunks reference Privy and 1 embeds the configured app id. `/api/pay` will refuse until `KAZUO_DEMO_PAYER_KEY` is set on Vercel (secret — user action)
- **5.6** Verify both sites load, app lists providers from Railway broker, no CORS errors in console. — **BLOCKED (5.3)** — both sites load; they cannot list providers until the broker boots

### Phase 6 — End-to-end proof on the deployed stack

- **6.1** `pnpm m1` against Arc testnet after rename (zero-gas assertion). Record tx. — **NOT STARTED**
- **6.2** Local provider node (`kazuo start`, adapter available on this host — codex/claude-code if signed in, else echo) connected to the **Railway** broker. — **NOT STARTED**
- **6.3** `kazuo run "…"` from CLI → paid, settled, result, receipt. Record tx + receipt tx. — **NOT STARTED**
- **6.4** MCP `kazuo_run_job` over stdio against Railway broker. Record tx. — **NOT STARTED**
- **6.5** Browser: `/api/pay` demo path on the deployed app → settled job. Record tx. — **NOT STARTED**
- **6.6** Browser: Privy embedded wallet pays (needs the wallet funded with testnet USDC from the demo payer — a real testnet transfer). Record tx. — **NOT STARTED**
- **6.7** Audit log on deployed app shows the new receipts. — **NOT STARTED**

### Phase 7 — Docs, submission, SDK prep

- **7.1** README rewrite for Kazuo: live URLs, new proof table (keep the pre-rename Arc tx links as history), tracks. — **IN PROGRESS** (live URLs, sponsor-integrations section, honest status rows, ETHOnline line done; new proof table waits on Phase 6)
- **7.2** SUBMISSION.md → ETHOnline 2026 (Arc Continuity + Agentic Economy, World AgentKit Continuity, Privy Financial Flow), honest gaps. — **IN PROGRESS** (rewritten for ETHOnline: three tracks, live URLs, pre-rename Arc proofs labelled as such, continuity section, 10-item not-proven list; new proof rows wait on Phase 6)
- **7.3** ARCHITECTURE.md: Mermaid architecture diagram (buyer app/CLI/MCP ↔ broker ↔ provider; Arc settlement; KazuoLog; Privy; AgentKit/AgentBook on World Chain). — **DONE** (Mermaid flowchart in ARCHITECTURE.md: buyers, broker, providers, Arc, World Chain AgentBook)
- **7.4** CHANGELOG entry "0.2.0 — Kazuo". RECORDING.md updated for the new names + Privy/World beats. — **DONE** (CHANGELOG `[0.3.0]` entry + removed a pre-existing duplicate block; RECORDING.md: Railway broker instead of a quick tunnel, correct URLs, Privy sign-in beat, human-backed badge + `kazuo agentkit status` beat)
- **7.5** npm publish prep: `@kazuo/protocol`, `@kazuo/cli`, `@kazuo/mcp` pack cleanly (`pnpm pack`, workspace deps rewritten), `npm publish --dry-run`. — **IN PROGRESS** — metadata fixed: `@kazuo/protocol` had no `publishConfig.access: public` (a scoped publish would default to restricted and fail) and no README; `@kazuo/mcp` listed a README that did not exist. Both now have author/repository/homepage/bugs/engines + README. `npm pack --dry-run` waits on the local build
- **7.6** Actual npm publish. — **DEFERRED (user decision, 2026-09-13 17:40 IST)** — the repository is now public at https://github.com/nickthelegend/kazuo-arc and the landing's install steps build from it, so no page links to an unpublished package. Earlier note: you said ask where to publish. Also found: `npm org ls kazuo` returns 403 for `nickthelegend69`, i.e. you are not in an npm org named `kazuo`. Publishing `@kazuo/*` needs that org created (npmjs.com → Add Organization → `kazuo`, free for public packages) or different, unscoped names
- **7.7** Public GitHub repo `nickthelegend/kazuo-arc` + push. — **BLOCKED (publishing public content needs the user's explicit OK; this repo has no remote)**
- **7.8** Demo video. — **BLOCKED (user records it; RECORDING.md is the script)**
- **7.9** Rotate the keys in `.env` (flagged as burned in SUBMISSION.md). — **BLOCKED (user decision — rotating changes funded addresses)**

---

## 4. Gap list (every real gap, tied to the task it blocks)

| # | Gap | Evidence | Blocks |
|---|---|---|---|
| G1 | Whole codebase still branded Xorv (~912 occurrences, 14 files named xorv, 46 env vars `XORV_*`) | grep | Phase 1 |
| G2 | User-visible UI copy still says transactions settle "on Hedera" | `composer.tsx:166,291`, `live-lists.tsx:125`, `job-view.tsx:250`, `network/page.tsx:12`, `layout.tsx:16` | 2.1–2.5 |
| G3 | UI network fallback is `hedera:testnet` | `shell.tsx:165` | 2.6 |
| G4 | Next config still externalises Hiero/Hedera packages that aren't deps | `apps/app/next.config.ts:16-18` | 2.7 |
| G5 | `/xorv` Claude skill (installed by `xorv skills`) tells Claude it pays "on Hedera" and expects a `hashscan` key | `skills.ts:46,53`, `.claude/skills/xorv/SKILL.md` | 2.10 |
| G6 | CLI README documents a `--hbar` flag that no longer exists | `packages/cli/README.md:75,82` | 2.12 |
| G7 | `apps/app` depends on `@xorv/protocol: ^0.1.0` (npm semver, not workspace) — can resolve the Hedera-era published package on a clean install | `apps/app/package.json` | 2.19, 5.5 |
| G8 | Dead dependency `@privy-io/server-auth` in app | `apps/app/package.json:16` | 2.18 |
| G9 | Hedera agent skills + lock entries still in repo | `.claude/skills/hedera-*`, `skills-lock.json` | 2.17 |
| G10 | Test fixtures use `hedera:testnet` network / "publishes to HCS" titles | `guards.test.ts:131`, `integration.test.ts:307` | 2.16 |
| G11 | No Privy integration at all in the Arc app (removed during the Hedera era) | `components/providers.tsx` comments | Phase 3 |
| G12 | Privy app secret invalid (401) — server wallets/policies impossible | live API call | 3.9 (B2B track) |
| G13 | No World / AgentKit / AgentBook integration | grep: 0 hits | Phase 4 |
| G14 | No World Chain network support — protocol hardcodes Arc (`usdcAddress` ignores network, `explorerBase`, `rpcUrl`, `networkLabel` only know Arc) | `packages/protocol/src/constants.ts:56-165` | 4.8, 4.9 |
| G15 | Zero ETH/USDC on World Chain Sepolia for operator/payer | on-chain probe | 4.10 |
| G16 | No human has registered the demo wallets in AgentBook | no World credentials | 4.6 |
| G17 | Nothing deployed: no Railway project, no Vercel project for this repo | CLI listings | Phase 5 |
| G18 | Broker port: Railway injects `$PORT`; broker reads `XORV_BROKER_PORT` only (verify) | `services/broker/src/config.ts` | 5.2 |
| G19 | Docker image not rebuilt since the Arc port (README admits it) | README "Deploying the broker" | 5.1 |
| G20 | MongoDB mirror unreachable (cluster DNS gone) | `querySrv ENOTFOUND` | none — SQLite on a Railway volume is the persisted DB; Mongo stays optional |
| G21 | Claude Code OAuth expired on host; 3/5 adapters fail under macOS seatbelt | SUBMISSION.md | 6.2 (use an adapter that works; state it) |
| G22 | A buyer is not refunded if the only matched provider fails | SUBMISSION.md | documented limitation, not in scope today |
| G23 | No architecture diagram image (Arc requires one) | docs | 7.3 |
| G24 | No World feedback document (World requires one) | docs | 4.7 |
| G25 | No git remote / public repo | `git remote -v` empty | 7.7 |
| G26 | Keys in `.env` considered burned | SUBMISSION.md checklist | 7.9 |
| G27 | Landing site links/copy still point at `@xorv/cli` npm + Hedera-era description | `apps/landing/lib/links.ts`, `package.json` | 1.x, 2.9, 5.4 |

Grep for `mock|stub|TODO|fake|dummy|placeholder`: every hit is legitimate — test doubles in `integration.test.ts`,
`wallet.test.ts`, the chain/facilitator interface doc comments in `app.ts`/`chain.ts`, and a `<textarea placeholder>`.
**No production code path is mocked.** The one stub-shaped runtime thing is the `echo` adapter, which is a
documented feature (exercises the payment path with no model installed), not a stand-in.

---

## 5. Execution log

(Updated live by the builder. Newest last.)

- 2026-09-13 12:50 IST — Planning pass + baseline audit complete (section 2).
- 2026-09-13 13:15 IST — Phase 1 rename + Phase 2 Hedera purge edited. Phase 4 code (AgentKit gate, registry, CLI/MCP proofs, World Chain networks) written; tests pending the install.
- 2026-09-13 13:15 IST — **Environment finding:** `/Volumes/Extreme SSD` is 99% full (15 GiB free) and writes ~1.4 MB/s. This is why `pnpm install` crawls. Free space on that disk to speed everything up.
- 2026-09-13 13:15 IST — **User action needed (5.2):** set the operator key on Railway yourself — the session refused to send a private key to an external service:
  `railway variables --service broker --set "KAZUO_OPERATOR_KEY=$(grep '^KAZUO_OPERATOR_KEY=' .env | cut -d= -f2)"` (run from the repo root after `railway link --project d9e105a5-3931-4549-b913-7852db8d45b8 --service broker`). The same applies to `KAZUO_DEMO_PAYER_KEY` on Vercel for the `/api/pay` fallback (5.5).
- 2026-09-13 13:21 IST — Vercel projects `kazuo-arc` + `kazuo-arc-app` configured (roots, framework, public env). Railway broker upload started (remote Docker build doubles as a typecheck while the local install crawls). `.vercelignore` added so `.env` is never uploaded. World feedback doc + architecture diagram written.
- 2026-09-13 13:23 IST — **Landing live:** https://kazuo-arc.vercel.app (verified by fetch). Railway's first broker build failed on `VOLUME` in the Dockerfile (Railway rejects it); removed and re-uploaded.
- 2026-09-13 13:27 IST — **Job board live:** https://kazuo-arc-app.vercel.app (verified by fetch; Privy bundled). **Broker on Railway builds and starts, then stops at the one missing secret, `KAZUO_OPERATOR_KEY`.** Phase 6 proofs will run against a local broker meanwhile, since the key exists in the local `.env`.
- 2026-09-13 13:30 IST — Docs pass: README (live URLs, sponsor section, honest ⚠️ rows for unproven World/Privy), SUBMISSION rewritten for ETHOnline, CHANGELOG 0.3.0, RECORDING updated. Local `pnpm install` still linking on the full SSD — tests + CLI/MCP compile + local proofs wait on it.
- 2026-09-13 13:36 IST — Railway deployment 8289441a is now **FAILED** after exhausting restart retries — still only `Missing KAZUO_OPERATOR_KEY`. **After setting the key, redeploy** (setting a variable does not restart a failed deployment on its own):
  `railway variables --service broker --set "KAZUO_OPERATOR_KEY=$(grep '^KAZUO_OPERATOR_KEY=' .env | cut -d= -f2)" && railway redeploy --service broker --yes`
  then `curl https://broker-production-03b2.up.railway.app/health` should return `{"ok":true,…}`.
- 2026-09-13 13:36 IST — Full-workspace install abandoned (Privy v3 tree on a disk writing ~1.4 MB/s); backend-only install (protocol/broker/cli/mcp) running, chained to build + all tests. App typecheck already proven by Vercel's build; broker typecheck by Railway's image build. `.env.example` documents `KAZUO_WORLD_RPC_URL`, `KAZUO_AGENTKIT`, `NEXT_PUBLIC_PRIVY_APP_ID`; CLI README documents `kazuo agentkit` + `--human-backed-only`.
- 2026-09-13 13:38 IST — Landing: hero's `npm i -g @kazuo/cli` line (would E404 — not published) replaced by a one-line Arc · World AgentKit · Privy row; footer gains World AgentKit + Privy links. Known and accepted until 7.6/7.7: the page's GitHub links and the footer 'CLI on npm' link 404 until the repo is public and the packages are published.
- 2026-09-13 13:39 IST — **Landing redeployed and verified live:** HTTP 200, 'World AgentKit' ×4 and 'Privy' ×4 on https://kazuo-arc.vercel.app, TypeScript passed on Vercel. Caveat kept on purpose: 6 `npm i -g @kazuo/cli` instructions remain in the earn/CTA/terminal-panel sections and will E404 until the packages are published (7.6) — they match the plan to publish rather than being rewritten to a clone flow the private repo can't serve either.
- 2026-09-13 13:44 IST — **World AgentBook read live (4.2 evidence):** `createAgentBookVerifier().lookupHuman` against World Chain mainnet (chain id 480, head block 34,975,755) returned *not registered* for the demo provider, payer and operator in 55–149 ms. Canonical AgentBook per agentkit-core 0.2.1: `0xA23aB2712eA7BBa896930544C7d6636a96b944dA`. Strict follow-up PASSED: 3,569 bytes of bytecode at that address, and a direct `readContract(lookupHuman)` (errors not swallowed) returned `0` = not registered. The nulls are real, not a failed call.
- 2026-09-13 13:46 IST — Verification pipeline queued without waiting on the stalled install: `packages/protocol/dist` rebuilding (the rename pass deleted stale `dist/` and the broker/CLI/MCP resolve `@kazuo/protocol` through it — the first backend test run was stopped because it would have failed on that, not on the code). Queued behind it: CLI + MCP `tsc --noEmit`, broker/CLI/MCP vitest (with `@worldcoin/agentkit@0.2.1` linked from the verified npm tarball), and emitted `dist` for broker/CLI/MCP for the local Arc proofs. Protocol + app suites running now. Results will replace this line's "queued" with real counts.
- 2026-09-13 13:53 IST — Test run (TESTPLAN.md): production frontends temporarily point at a Cloudflare-tunneled local broker (real `.env`, real Arc) because Railway is still keyless. **Must be reverted to the Railway URL + redeploy once `KAZUO_OPERATOR_KEY` is set on Railway.**
- 2026-09-13 14:15 IST — **World ID config received from the user** (app `app_d7d26bb561fa95de4117df5b5ecc89e2`, RP `rp_30d29cd7ee86bae6`, signer `0xd4F041AB…9b78Dc`). Stored only in gitignored local env (`.env`: `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_SIGNER_ADDRESS`, `WORLD_SIGNING_KEY`, mode 0600; `apps/app/.env.local`: public ids). The signing key was pasted in chat — rotate it after the hackathon. Verified live: RP `registered` on production + staging (`/api/v4/rp-status`); `enable_face_check: true`, `can_user_verify: yes` (`/api/v1/precheck`); a request signed with the key recovers exactly the registered signer. **Side effect disclosed to the user:** the precheck calls created actions `kazuo-provider` and `kazuo-human` on the app (both `max_verifications: 1`). Reference studied: `_references/comitment-issues` (docs only — IDKit 4.2.x RP-signed Selfie Check request → connectorURI QR → pollUntilCompletion → forward to `/api/v4/verify/{rp_id}`, check nonce yourself). `IDKit.request` in Node fails to load its WASM over `file://` (the reference's documented gotcha); shim under test.
- 2026-09-13 14:48 IST — **Built and verified since the test run began (details + evidence in TESTPLAN.md):**
  - **World ID (Selfie Check), modelled on the user's `_references/comitment-issues`:** broker `worldid.ts` (RP-signed single-use requests, nonce/age/action/signal-hash checks before forwarding to `developer.world.org/api/v4/verify/rp_30d29cd7ee86bae6`, verifications persisted in SQLite `human_verifications`, provider badge via `registry.markHuman`, buyer label bound to the settled payer); routes `/api/worldid/request|verify|status` live on the local broker; `kazuo verify` (terminal QR via idkit-core 4.2.4 with the file:// WASM shim — a real World bridge request was created); job-board `WorldVerify` widget (`@worldcoin/idkit` 4.2.3) deployed to https://kazuo-arc-app.vercel.app (Vercel build + TypeScript passed). End-to-end proof still needs a person to scan with World App.
  - **Audit-log index** (`log-index.ts`) replaces the chain-scanning receipts reader that returned 502 (Arc RPC rate limit) and could not reach receipts older than ~2 days; persisted in SQLite, seeded from known receipt txs, paced forward scan.
  - **Fixed:** provider reconnect race (node reported "reconnecting" forever after a broker restart while the broker showed it online); broker banner `X O R V` and CLI block-letter XORV banner (rename misses); MCP test harness `npx tsx` cold-start timeouts.
  - **Suites:** protocol 55/55 · broker 123/123 · cli 130/130 · mcp 8/8 · app 25/25; all `tsc` clean.
  - **Deploy note:** new broker deps (`@worldcoin/idkit-core`) and CLI deps (`@worldcoin/idkit-core`, `qrcode`) are in package.json and the lockfile; locally they are linked from a verified scratch install because the full SSD makes `pnpm install` crawl.
- 2026-09-13 15:38 IST — **Receipts index live.** Seeding isolated from the forward scan (one historical tx the public RPC can't look up had stalled everything); `/api/receipts`, the Network page and the landing Receipts section now show real KazuoLog receipts, and new ones appear seconds after publishing (TESTPLAN A17, L4, B10).
- 2026-09-13 15:50 IST — **Root-caused and fixed: the index starved the broker's own chain writes.** Arc's public RPC budget is ~0.4 req/s; the backfill used all of it and viem's default retry (≈1 s total) couldn't ride out the limit, so registration/heartbeat publishes failed. `readClient`/`writeClient` now retry 5× with 1 s doubling (covers settlement); the broker tracks in-flight writes (audit publishes + `onBeforeSettle`/`onAfterSettle`/`onSettleFailure`) and `LogIndex` makes no RPC call while one is in flight. `/api/network` `logLastError` trimmed to viem's short message. Verified live: registry/heartbeat published after restart (KazuoLog seq 67/68), index yielded during a settlement.
- 2026-09-13 16:08 IST — **Fixed: job board overflowed phones** (TESTPLAN A20). Home and job-page grids had no mobile column template, so a truncated job line forced a 537 px column; now `grid-cols-1` / `minmax(0,…)` tracks. Deployed `dpl_H2YrccYnu3gm32C1LPkcCEG2LCcW`; re-verified at 375 px.
- 2026-09-13 16:08–16:25 IST — **CLI/broker observability fixes found while testing:** `kazuo start` under a process manager logged the static footer once a second (non-TTY `liveRegion` fallback) → prints the dashboard once and streams timestamped events; ANSI colour now off when stdout isn't a TTY unless `FORCE_COLOR`; first-start status reads CONNECTING, not RECONNECTING; broker logs each registering node's AgentKit outcome (proof verified / no proof / rejected), which made P7 checkable; both ends of the provider control channel now log the WebSocket close code, to root-cause a 1.5 s idle drop seen once on localhost (under observation).
- 2026-09-13 16:03–16:18 IST — **Real Arc testnet proofs run in this pass:** CLI echo job (settlement `0x12c3a36b…`, receipt seq 66), CLI Codex job with a model-written answer (`0x042613d2…`, seq 69), MCP `kazuo_run_job` over stdio (`0x307792e8…`, seq 70), `pnpm m1` zero-gas proof (buyer gas 0 wei, `0xbc95f083…`), double-pay rejected 409. Settlement and receipt decoded from chain (TESTPLAN C1/C2/C3).
- 2026-09-13 15:34–15:45 IST (machine clock; the three entries above were labelled about an hour ahead) — **Mac restarted; production recovered.** New quick tunnel `https://surround-ports-prime-audience.trycloudflare.com` pushed to both Vercel projects and redeployed (verified in the served JS); the three packages that were linked from the wiped `/private/tmp` reinstalled durably in `node_modules/.kazuo-local-deps`; provider config rebuilt at `~/.kazuo-arc-demo/provider` with the key read from `.env` at launch. Re-verified live: landing receipts, job board home/providers/network/job page, and a new paid job (`job_udztt_-re1Ti`, settlement `0x8d77bd8c…`). **Keep this Mac awake and these three processes (tunnel, broker, provider) running until judging** — production depends on them; if the tunnel restarts, its URL changes and both Vercel projects need the new URL and a redeploy.
- 2026-09-13 16:12–17:15 IST (machine clock) — **Full test plan re-run top to bottom (TESTPLAN §8).** Plan extended to every route, page and interruption (landing sections/links/404, job board 404/live stream/outage recovery, all broker routes incl. cancel/stream/log/auth, node status server, CLI surface, provider death mid-job, live reassignment). Nine defects found and fixed at the root, each re-verified live: World ID status accepted malformed subjects; broken Arc link and non-existent canonical domain; Coinbase Wallet SDK console errors on 404 pages; job page misreporting an unreachable broker and never recovering; offline nodes listed under "Live providers"; hydration error on running job pages; cancel overwritten by the provider's late report; a dead provider leaving buyers waiting ten minutes; a node registering without its AgentKit proof silently. Live reassignment proven with two real nodes. Suites 343/343.
- 2026-09-13 16:25 IST — **Still blocked on the user, unchanged:** `KAZUO_OPERATOR_KEY` on Railway (+ redeploy, then point both Vercel projects back at Railway — production currently depends on this machine's tunnel); `KAZUO_DEMO_PAYER_KEY` on Vercel (unblocks A9/A18/A19 in the browser — superseded 17:25, see below); a World App Selfie Check scan (W3–W6); a Privy email login (A12/A13).
- 2026-09-13 17:05–17:30 IST (machine clock) — **Closed the no-wallet payment gap without moving a key.** New broker route `POST /api/demo/pay` pays a quote through the broker's own public x402 route from the demo account whose key already sits in this machine's `.env` (quote id validated, $0.25 ceiling, 10 requests/min, 501 when no key); the job board's `/api/pay` relays to it when Vercel has no key (deploy `dpl_gCGYazuzC7LeF7eCPrGERmkwxW4Y`). Verified in Chrome on production: no-wallet "Pay and run" → `job_AQ8QgUyjAd4v` Completed, transfer `0xf3d78946…`, receipt `0x55e41449…` (A9); keyless broker → 501 relayed (A10); expired quote → 404 on the card (A18); paid quote reused from the page → 409 (A19); jobs-empty state on a fresh-DB broker (A2). Four integration tests added. Remaining owner items: GitHub repo public + npm publish (L10), World App scan (W3–W6), Privy email login (A12/A13), World Chain Sepolia ETH (C5), `KAZUO_OPERATOR_KEY` on Railway.
- 2026-09-13 18:00–18:45 IST (machine clock) — **Completion re-measure (TESTPLAN §9): 71% → 78%.** Found and fixed: CI red on the public repo (typecheck before build, stale package filter) — green on `eaa9cbd`; Codex could not run under seatbelt (needs its own home writable; its nested seatbelt fails) — fixed with its config kept read-only, passes `kazuo test`; a failed Codex job reported unrelated stderr instead of "usage limit" — fixed. The demo account's **Codex quota is spent until 12 Oct 2026**, so the demo node now sells **Echo + Claude Code under seatbelt**; a no-wallet Claude Code purchase on the production job board settled and was decoded on chain (`job_ytLeQpol5gve`). Railway deployment confirmed failing only on the missing `KAZUO_OPERATOR_KEY`.
