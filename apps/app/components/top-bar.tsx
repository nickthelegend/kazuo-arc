import Link from "next/link";
import { Mark } from "@/components/mark";
import { NetworkBadge } from "@/components/network-badge";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark id="bar" className="h-6.5 w-6.5 transition-transform duration-500 group-hover:rotate-90" />
          <span className="font-semibold tracking-tight text-white">Xorv</span>
          <span className="hidden text-xs text-dim sm:inline">job board</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/providers" className="text-sm text-muted transition-colors hover:text-foreground">
            Providers
          </Link>
          <Link href="/network" className="text-sm text-muted transition-colors hover:text-foreground">
            Network
          </Link>
          <NetworkBadge />
        </div>
      </div>
    </header>
  );
}
