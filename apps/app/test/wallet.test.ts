/**
 * The browser wallet, without a browser.
 *
 * Everything here drives a fake EIP-1193 provider, which is exactly what a real
 * wallet exposes — `request({method, params})` plus two events. That is the
 * whole interface Xorv uses, so a fake is not an approximation of the extension;
 * it is the same contract.
 *
 * The chain handling is what earns the most attention. An EIP-712 domain
 * includes `chainId`, so a wallet sitting on the wrong network produces a
 * structurally valid authorization that verifies against nothing — the payment
 * is refused with no field to point at. Getting on Arc *before* asking for a
 * signature is therefore load-bearing, and so is handling the case where the
 * wallet has never heard of Arc at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARC_CHAIN } from "../lib/chains";
import {
  connectWallet,
  restoreWallet,
  shortAddress,
  switchToArc,
  walletAvailable,
  watchWallet,
} from "../lib/wallet";

const ADDRESS = "0x03294ce27e218d1611b2ebc0b0ffddb95f129f36";
const CHECKSUMMED = "0x03294Ce27e218d1611B2ebc0b0ffdDb95F129F36";
const ARC_HEX = `0x${ARC_CHAIN.id.toString(16)}`;

interface FakeOpts {
  accounts?: string[];
  chainId?: string;
  /** Throw this from wallet_switchEthereumChain. 4902 = unknown chain. */
  switchError?: { code: number } | null;
}

function fakeProvider(opts: FakeOpts = {}) {
  const calls: Array<{ method: string; params?: unknown }> = [];
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  let chainId = opts.chainId ?? ARC_HEX;

  const provider = {
    calls,
    listeners,
    async request({ method, params }: { method: string; params?: unknown }) {
      calls.push({ method, params });
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return opts.accounts ?? [ADDRESS];
        case "eth_chainId":
          return chainId;
        case "wallet_switchEthereumChain":
          if (opts.switchError) throw opts.switchError;
          chainId = ARC_HEX;
          return null;
        case "wallet_addEthereumChain":
          chainId = ARC_HEX;
          return null;
        case "eth_signTypedData_v4":
          return "0xsignature";
        default:
          throw new Error(`unexpected method ${method}`);
      }
    },
    on(event: string, handler: (...a: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeListener(event: string, handler: (...a: unknown[]) => void) {
      listeners.get(event)?.delete(handler);
    },
  };
  (globalThis as { window?: unknown }).window = { ethereum: provider };
  return provider;
}

const methods = (p: ReturnType<typeof fakeProvider>) => p.calls.map((c) => c.method);

beforeEach(() => {
  (globalThis as { window?: unknown }).window = {};
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.restoreAllMocks();
});

describe("walletAvailable", () => {
  it("is false with no injected provider, and says so rather than throwing", () => {
    expect(walletAvailable()).toBe(false);
  });

  it("is true once a provider is injected", () => {
    fakeProvider();
    expect(walletAvailable()).toBe(true);
  });
});

describe("connectWallet", () => {
  it("prompts for accounts and returns a checksummed address", async () => {
    const p = fakeProvider();
    const session = await connectWallet();
    // Checksummed, not the lowercase form the wallet returned: one address must
    // have one spelling, or comparisons against `payTo` start failing.
    expect(session.address).toBe(CHECKSUMMED);
    expect(methods(p)).toContain("eth_requestAccounts");
  });

  it("switches the wallet to Arc when it is on another network", async () => {
    const p = fakeProvider({ chainId: "0x1" });
    const session = await connectWallet();
    expect(methods(p)).toContain("wallet_switchEthereumChain");
    expect(session.chainId).toBe(ARC_CHAIN.id);
  });

  it("does not prompt a switch when the wallet is already on Arc", async () => {
    const p = fakeProvider({ chainId: ARC_HEX });
    await connectWallet();
    expect(methods(p)).not.toContain("wallet_switchEthereumChain");
  });

  it("offers to add Arc when the wallet has never heard of it (EIP-1193 4902)", async () => {
    // The realistic first-run case. Without this the user is told to configure
    // an RPC endpoint by hand, which is where most people stop.
    const p = fakeProvider({ chainId: "0x1", switchError: { code: 4902 } });
    await connectWallet();
    expect(methods(p)).toContain("wallet_addEthereumChain");
    const added = p.calls.find((c) => c.method === "wallet_addEthereumChain");
    const [params] = added!.params as Array<{ chainId: string; rpcUrls: string[] }>;
    expect(params.chainId).toBe(ARC_HEX);
    expect(params.rpcUrls[0]).toContain("arc");
  });

  it("propagates any other switch failure instead of silently adding a chain", async () => {
    // 4001 is "user rejected". Adding the chain anyway would re-prompt someone
    // who just said no.
    fakeProvider({ chainId: "0x1", switchError: { code: 4001 } });
    await expect(connectWallet()).rejects.toMatchObject({ code: 4001 });
  });

  it("fails with an actionable message when there is no wallet at all", async () => {
    await expect(connectWallet()).rejects.toThrow(/No EVM wallet found/);
  });

  it("fails when the wallet returns an empty account list", async () => {
    fakeProvider({ accounts: [] });
    await expect(connectWallet()).rejects.toThrow(/no account/i);
  });
});

describe("restoreWallet", () => {
  it("reconnects silently via eth_accounts, which never prompts", async () => {
    const p = fakeProvider();
    const session = await restoreWallet();
    expect(session?.address).toBe(CHECKSUMMED);
    expect(methods(p)).toContain("eth_accounts");
    expect(methods(p)).not.toContain("eth_requestAccounts");
  });

  it("never prompts a network switch on page load", async () => {
    // A silent restore that pops a wallet dialog on every reload is worse than
    // no restore. The connect and payment paths both ensure Arc instead.
    const p = fakeProvider({ chainId: "0x1" });
    const session = await restoreWallet();
    expect(methods(p)).not.toContain("wallet_switchEthereumChain");
    // …and reports the wrong chain so the UI can offer the switch itself.
    expect(session?.chainId).toBe(1);
  });

  it("returns null rather than throwing when nothing is authorised", async () => {
    fakeProvider({ accounts: [] });
    expect(await restoreWallet()).toBeNull();
  });

  it("returns null when there is no wallet", async () => {
    expect(await restoreWallet()).toBeNull();
  });
});

describe("signTypedData", () => {
  it("uses v4 specifically", async () => {
    // Not interchangeable with v3: the two hash arrays and nested structs
    // differently, so a v3 signature over the same EIP-3009 authorization
    // verifies against nothing and reports only "invalid signature".
    const p = fakeProvider();
    const session = await connectWallet();
    await session.signTypedData({
      domain: { name: "USDC", version: "2" },
      types: {},
      primaryType: "TransferWithAuthorization",
      message: {},
    });
    expect(methods(p)).toContain("eth_signTypedData_v4");
  });

  it("passes the account first and the message as a JSON string", async () => {
    const p = fakeProvider();
    const session = await connectWallet();
    await session.signTypedData({
      domain: { name: "USDC", version: "2" },
      types: {},
      primaryType: "TransferWithAuthorization",
      message: { value: "1000" },
    });
    const call = p.calls.find((c) => c.method === "eth_signTypedData_v4");
    const [account, json] = call!.params as [string, string];
    expect(account).toBe(CHECKSUMMED);
    expect(JSON.parse(json).message.value).toBe("1000");
  });
});

describe("switchToArc", () => {
  it("is a no-op when already on Arc", async () => {
    const p = fakeProvider({ chainId: ARC_HEX });
    await switchToArc();
    expect(methods(p)).not.toContain("wallet_switchEthereumChain");
  });

  it("switches when elsewhere", async () => {
    const p = fakeProvider({ chainId: "0x2105" });
    await switchToArc();
    expect(methods(p)).toContain("wallet_switchEthereumChain");
  });
});

describe("watchWallet", () => {
  it("subscribes to account and chain changes and unsubscribes cleanly", () => {
    // A user who switches account has changed who is paying. Missing that means
    // paying from an address other than the one on screen.
    const p = fakeProvider();
    const onChange = vi.fn();
    const stop = watchWallet(onChange);
    expect(p.listeners.get("accountsChanged")?.size).toBe(1);
    expect(p.listeners.get("chainChanged")?.size).toBe(1);
    stop();
    expect(p.listeners.get("accountsChanged")?.size).toBe(0);
    expect(p.listeners.get("chainChanged")?.size).toBe(0);
  });

  it("returns a no-op unsubscribe when there is no wallet", () => {
    expect(() => watchWallet(vi.fn())()).not.toThrow();
  });
});

describe("shortAddress", () => {
  it("shortens a full address for chrome", () => {
    expect(shortAddress(CHECKSUMMED)).toBe("0x0329…9F36");
  });

  it("leaves something already short alone rather than mangling it", () => {
    expect(shortAddress("0x1234")).toBe("0x1234");
  });
});
