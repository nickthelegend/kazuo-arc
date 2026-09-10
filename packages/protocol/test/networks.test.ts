import { afterEach, describe, expect, it } from "vitest";
import {
  ARC_TESTNET_CAIP2,
  NETWORKS,
  WORLDCHAIN_SEPOLIA_CAIP2,
  chainIdFor,
  explorerTx,
  isWorldChain,
  networkInfo,
  networkLabel,
  rpcUrl,
  usdcAddress,
} from "../src/constants.js";

/**
 * World Chain is a second settlement network, so every helper that used to
 * assume Arc now has to answer per network. The addresses below were read on
 * chain (FiatTokenV2 `name=USDC`, `version=2`) before being written here.
 */
describe("networks", () => {
  afterEach(() => {
    delete process.env.KAZUO_RPC_URL;
    delete process.env.KAZUO_STABLECOIN;
  });

  it("keeps Arc testnet exactly as it was", () => {
    expect(usdcAddress(ARC_TESTNET_CAIP2)).toBe("0x3600000000000000000000000000000000000000");
    expect(rpcUrl(ARC_TESTNET_CAIP2)).toBe("https://rpc.testnet.arc.network");
    expect(networkLabel(ARC_TESTNET_CAIP2)).toBe("testnet");
    expect(explorerTx(ARC_TESTNET_CAIP2, "0xabc")).toBe("https://testnet.arcscan.app/tx/0xabc");
  });

  it("answers for World Chain Sepolia with its own token, RPC and explorer", () => {
    expect(chainIdFor(WORLDCHAIN_SEPOLIA_CAIP2)).toBe(4801);
    expect(usdcAddress(WORLDCHAIN_SEPOLIA_CAIP2)).toBe("0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88");
    expect(rpcUrl(WORLDCHAIN_SEPOLIA_CAIP2)).toContain("worldchain-sepolia");
    expect(explorerTx(WORLDCHAIN_SEPOLIA_CAIP2, "0xabc")).toBe("https://sepolia.worldscan.org/tx/0xabc");
    expect(networkInfo(WORLDCHAIN_SEPOLIA_CAIP2).gasToken).toBe("ETH");
  });

  it("uses World Chain mainnet's native USDC", () => {
    expect(usdcAddress("eip155:480")).toBe("0x79A02482A880bCe3F13E09da970dC34dB4cD24D1");
    expect(explorerTx("eip155:480", "0x1")).toBe("https://worldscan.org/tx/0x1");
  });

  it("classifies World Chain and nothing else as World Chain", () => {
    expect(isWorldChain("eip155:4801")).toBe(true);
    expect(isWorldChain("eip155:480")).toBe(true);
    expect(isWorldChain(ARC_TESTNET_CAIP2)).toBe(false);
    expect(isWorldChain("eip155:8453")).toBe(false);
  });

  it("falls back to Arc testnet for an unknown network rather than throwing", () => {
    expect(networkInfo("eip155:1").caip2).toBe(ARC_TESTNET_CAIP2);
  });

  it("still lets the environment override the RPC and the token", () => {
    process.env.KAZUO_RPC_URL = "https://my.rpc";
    process.env.KAZUO_STABLECOIN = "0x1111111111111111111111111111111111111111";
    expect(rpcUrl(WORLDCHAIN_SEPOLIA_CAIP2)).toBe("https://my.rpc");
    expect(usdcAddress(WORLDCHAIN_SEPOLIA_CAIP2)).toBe("0x1111111111111111111111111111111111111111");
  });

  it("every network entry is keyed by its own CAIP-2 id", () => {
    for (const [key, info] of Object.entries(NETWORKS)) {
      expect(info.caip2).toBe(key);
      expect(chainIdFor(key)).toBe(info.chainId);
      expect(info.usdc).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
