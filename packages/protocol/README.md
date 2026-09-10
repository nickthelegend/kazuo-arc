# @kazuo/protocol

Shared types, money math, chain plumbing and x402 wiring for [Kazuo](https://github.com/nickthelegend/kazuo-arc) —
a marketplace for idle AI subscription capacity, paid per job in USDC over x402 on Arc.

Used by `@kazuo/cli`, `@kazuo/mcp` and the Kazuo broker. You only need it directly if you are building your
own buyer, provider or broker against the Kazuo protocol.

```bash
npm i @kazuo/protocol
```

## What is in it

| Area | Exports |
|---|---|
| Networks | `NETWORKS`, `networkInfo`, `isWorldChain`, `rpcUrl`, `usdcAddress`, `explorerTx`, `explorerAddress` — Arc testnet/mainnet (`eip155:5042002` / `eip155:5042`) and World Chain Sepolia/mainnet (`eip155:4801` / `eip155:480`) |
| Chain | `arcChain`, `readClient`, `writeClient`, `accountFor`, `parsePrivateKey`, `fetchBalances`, `usdcBalance`, `usdcDomain` |
| Money | `parseUsd`, `formatUsd`, `usdMicrosToUsdcUnits`, `usdcUnitsToUsdMicros` — every amount is USDC's 6 decimals |
| x402 | `buildFacilitator`, payment option helpers for the stock EVM `exact` scheme over EIP-3009 |
| Audit log | `readLog`, envelope types, the `KazuoLog` ABI |
| Types | `Provider`, `Capability`, `Job`, `JobRequest`, `PaymentRecord`, `RegisterRequest`, wire messages |

```ts
import { networkInfo, usdcAddress, formatUsd } from "@kazuo/protocol";

networkInfo("eip155:5042002").name; // "Arc Testnet"
usdcAddress("eip155:4801");         // World Chain Sepolia USDC
formatUsd(1_000);                   // "$0.0010"
```

`KAZUO_RPC_URL` overrides the RPC and `KAZUO_STABLECOIN` the token, read per call.

MIT
