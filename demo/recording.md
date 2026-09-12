# Kazuo demo — beat plan for one raw take

**Blockchain app: yes.** Arc testnet (`eip155:5042002`) settles every job in USDC over x402; the audit log is the
`KazuoLog` contract; World AgentKit reads AgentBook on World Chain; World ID Selfie Check verifies humans.

**Wallet for the take:** a testnet-only demo key already in `.env` (`KAZUO_DEMO_PAYER_KEY`, address
`0x03294Ce27e218d1611B2ebc0b0ffdDb95F129F36`, ~12 test USDC, no mainnet value). It is injected into the real
Google Chrome page as an EIP-6963 wallet, found by Privy's "Continue with a wallet", and auto-approved for this
session: every signature it returns is a real secp256k1 signature over the exact bytes the app asked for.

**Recorder:** Playwright driving installed Google Chrome; video captured from the page at a fixed viewport
(`DEMO_W`×`DEMO_H`), so only the app is in frame. SVG cursor and click rings are drawn in the page.

| id | beat | signing |
|---|---|---|
| intro | Title: what Kazuo is | |
| landing | Landing page hero on kazuo-arc.vercel.app — idle AI subscriptions, paid per job in USDC on Arc | |
| receipts | Landing "Receipts" section — live rows read from the KazuoLog contract | |
| contract | ArcScan: the KazuoLog contract page | |
| board | Job board home — composer, recent jobs, the live provider | |
| providers | Providers page — the node online, capabilities and prices, human-backed "not proven" (World AgentKit) | |
| privy | Privy sign-in modal — connect the demo wallet, sign in (off-chain sign-in signature) | wallet signature (off-chain) |
| selfie | World ID Selfie Check — "Verify you're human" opens World's QR for World App | |
| compose | Pick Claude Code, type a task, get a quote — provider, price, pays-to address | |
| pay | Pay from the wallet — EIP-3009 authorization signed, facilitator settles on Arc; overlay held until confirmed | **SIGNING — on-chain** |
| job | Job page runs live and completes with the answer and the receipt panel | |
| settlement | ArcScan: this take's settlement transaction (USDC buyer → provider) | |
| receipt | ArcScan: this take's on-chain receipt transaction (KazuoLog entry) | |
| network | Network page — facilitator pays gas, receipts read back from chain | |
| node | Provider's own node page — earnings, capabilities, connected | |
| outro | Close and thanks for watching | |
