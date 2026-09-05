"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { hederaMainnet, hederaTestnet, XORV_CHAIN } from "@/lib/chains";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Auth and wallets.
 *
 * Privy covers the whole range in one component: social sign-in for people who
 * have never held a wallet, external wallets for people who have, and an
 * embedded wallet created for the former so they end up with one either way.
 * That matters here more than usual — Xorv's whole argument is that paying for
 * a job should not require an account signup, and a login wall made of seed
 * phrases would undo it.
 *
 * If no app id is configured the app renders without auth rather than crashing.
 * The job board is useful read-only, and a missing environment variable should
 * degrade a feature, not the product.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        // Order is the order they appear. Social first: the people who need
        // this most are the ones who don't already have a wallet.
        loginMethods: ["google", "github", "email", "wallet"],

        appearance: {
          theme: "dark",
          accentColor: "#fafafa",
          // Matching the app rather than Privy's default purple — a modal in a
          // different palette reads as a third-party interruption.
          logo: "/brand/xorv-mark.svg",
          // Coinbase Smart Wallet is deliberately absent: it does not support
          // Hedera's chain ids, so offering it is a dead end the user only
          // discovers after picking it.
          walletList: ["metamask", "rainbow", "wallet_connect", "detected_wallets"],
          showWalletLoginFirst: false,
        },

        embeddedWallets: {
          // Someone who signs in with Google still needs somewhere to be paid,
          // so give them a wallet without making them think about it.
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },

        // Hedera through its JSON-RPC relay. `defaultChain` decides which
        // network a fresh wallet lands on; `supportedChains` is what we'll
        // switch to without complaint.
        defaultChain: XORV_CHAIN,
        // Deduped: XORV_CHAIN is one of these two, and listing it twice makes
        // wallet connectors evaluate the same chain id repeatedly.
        supportedChains: [hederaTestnet, hederaMainnet],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export const PRIVY_ENABLED = Boolean(APP_ID);
