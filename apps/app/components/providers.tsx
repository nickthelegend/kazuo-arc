"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PrivyWalletProvider, WalletProvider } from "@/components/wallet-provider";
import { ARC_CHAIN, worldchainSepolia } from "@/lib/chains";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();

/**
 * App-wide providers.
 *
 * With a Privy app id, sign-in is Privy: email creates an embedded wallet on
 * Arc for anyone without one, and existing wallets still connect through the
 * same modal. Without one, the app falls back to the injected wallet exactly as
 * before — nothing about paying changes, only how the wallet is obtained.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <WalletProvider>{children}</WalletProvider>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#ffffff",
          walletChainType: "ethereum-only",
          landingHeader: "Sign in to Kazuo",
          loginMessage: "Pay per AI job in USDC on Arc. No gas, no extension needed.",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: ARC_CHAIN,
        supportedChains: [ARC_CHAIN, worldchainSepolia],
      }}
    >
      <PrivyWalletProvider>{children}</PrivyWalletProvider>
    </PrivyProvider>
  );
}
