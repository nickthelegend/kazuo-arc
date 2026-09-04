import Link from "next/link";
import { Mark } from "@/components/ui/logo";
import { CHAIN, HEDERA_URL, LOOM_URL, NPM_URL, REPO_URL, X402_URL } from "@/lib/links";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "For providers", href: "#earn" },
      { label: "Payments", href: "#payments" },
      { label: "Adapters", href: "#adapters" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "GitHub", href: REPO_URL, external: true },
      { label: "CLI on npm", href: NPM_URL, external: true },
      { label: "x402 protocol", href: X402_URL, external: true },
      { label: "Hedera", href: HEDERA_URL, external: true },
    ],
  },
  {
    title: "On-chain",
    links: [
      { label: `USDC ${CHAIN.usdc}`, href: CHAIN.usdcUrl, external: true },
      { label: "Registry topic", href: CHAIN.topicUrl(CHAIN.topics.registry), external: true },
      { label: "Heartbeat topic", href: CHAIN.topicUrl(CHAIN.topics.heartbeat), external: true },
      { label: "Receipts topic", href: CHAIN.topicUrl(CHAIN.topics.receipts), external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] px-6 py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark id="footer" className="h-6 w-6" />
              <span className="font-semibold tracking-tight text-white">Xorv</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              A decentralized AI capacity network. Idle subscriptions in, paid jobs out — settled
              per request in USDC over x402 on Hedera.
            </p>
            <p className="mt-5 text-xs text-dim">
              Part of the{" "}
              <Link
                href={LOOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-cyan"
              >
                Loompad
              </Link>{" "}
              ecosystem.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-dim">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...("external" in link && link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-dim">
            © {new Date().getFullYear()} Xorv · MIT licensed
          </p>
          <p className="mono text-xs text-dim">{CHAIN.network}</p>
        </div>
      </div>
    </footer>
  );
}
