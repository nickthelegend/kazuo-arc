import Link from "next/link";
import { Mark } from "@/components/ui/logo";
import {
  ARC_URL,
  CHAIN,
  CIRCLE_URL,
  INSTALL_URL,
  LOOM_URL,
  PRIVY_URL,
  REPO_URL,
  WORLD_AGENTKIT_URL,
  X402_URL,
} from "@/lib/links";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "For providers", href: "#earn" },
      { label: "Adapters", href: "#adapters" },
      { label: "Receipts", href: "#ledger" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "GitHub", href: REPO_URL, external: true },
      { label: "Install the CLI", href: INSTALL_URL, external: true },
      { label: "x402", href: X402_URL, external: true },
      { label: "Arc", href: ARC_URL, external: true },
      { label: "Circle", href: CIRCLE_URL, external: true },
      { label: "World AgentKit", href: WORLD_AGENTKIT_URL, external: true },
      { label: "Privy", href: PRIVY_URL, external: true },
    ],
  },
  {
    title: "On-chain",
    links: [
      { label: "USDC token", href: CHAIN.usdcUrl, external: true },
      { label: "Audit log contract", href: CHAIN.logUrl, external: true },
      { label: "ArcScan", href: "https://testnet.arcscan.app", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)] px-6 py-16">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5 text-fg">
              <Mark className="h-5 w-5" />
              <span className="text-[15px] font-semibold tracking-[-0.02em]">Kazuo</span>
            </div>
            <p className="mt-4 max-w-[26ch] text-[13.5px] leading-relaxed text-fg-3">
              A decentralized AI capacity network. Idle subscriptions in, paid jobs out — settled
              per request in USDC on Arc, with human-backed nodes proven by World ID and wallets
              anyone can open with an email.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[13px] font-medium text-fg">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-[13.5px] text-fg-3 transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
          <p className="text-[12.5px] text-fg-4">
            © {new Date().getFullYear()} Kazuo · MIT ·{" "}
            <Link
              href={LOOM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-fg-2"
            >
              Loompad
            </Link>
          </p>
          <p className="mono text-[12px] text-fg-4">{CHAIN.network}</p>
        </div>
      </div>
    </footer>
  );
}
