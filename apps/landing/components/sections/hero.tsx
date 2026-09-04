"use client";

import { useRef } from "react";
import { gsap, useGSAP, shouldAnimate } from "@/lib/gsap";
import { Button, Pill } from "@/components/ui/kit";
import { APP_URL, REPO_URL } from "@/lib/links";

/**
 * The hero.
 *
 * One promise, stated plainly, plus the two commands that make it true. The
 * terminal on the right is the real output of `xorv start` and `xorv run` —
 * not a mock of a product that doesn't exist.
 */
export function Hero() {
  const scope = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      // Nothing to do when we shouldn't animate: the markup is already in its
      // final state, which is the whole point of fromTo rather than from.
      if (!shouldAnimate()) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const rise = (opacity: number, y: number) => ({ opacity, y });

      tl.fromTo("[data-hero-badge]", rise(0, 14), { ...rise(1, 0), duration: 0.5 })
        // Lines rise in sequence, so the headline reads as it assembles.
        .fromTo(
          "[data-hero-line]",
          rise(0, 26),
          { ...rise(1, 0), duration: 0.75, stagger: 0.1 },
          "-=0.22",
        )
        .fromTo("[data-hero-sub]", rise(0, 18), { ...rise(1, 0), duration: 0.6 }, "-=0.42")
        .fromTo("[data-hero-cta]", rise(0, 16), { ...rise(1, 0), duration: 0.55 }, "-=0.36")
        .fromTo("[data-hero-chain]", { opacity: 0 }, { opacity: 1, duration: 0.6 }, "-=0.3")
        .fromTo(
          "[data-hero-term]",
          { opacity: 0, y: 30, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.85 },
          "-=0.75",
        )
        .fromTo(
          "[data-term-line]",
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.35, stagger: 0.055 },
          "-=0.45",
        );
    },
    { scope },
  );

  return (
    <div ref={scope} className="relative overflow-hidden px-6 pb-24 pt-36 md:pb-32 md:pt-44">
      <div className="pointer-events-none absolute inset-0 grid-bg" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-[720px] aurora" aria-hidden="true" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div data-hero-badge>
            <Pill className="border-violet/25 bg-violet/[0.08] text-foreground">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint" />
              Live on Hedera testnet
              <span className="text-dim">·</span>
              <span className="text-muted">x402 payments</span>
            </Pill>
          </div>

          <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
            <span data-hero-line className="grad-text block">
              Your AI subscription
            </span>
            <span data-hero-line className="grad-text block">
              is idle most of
            </span>
            <span data-hero-line className="grad-brand block">
              the day.
            </span>
          </h1>

          <p data-hero-sub className="mt-6 max-w-xl text-base leading-relaxed text-muted">
            Xorv turns that idle quota into income. Run one command, and the Claude, Codex or Grok
            plan you already pay for starts taking jobs from the network — settling{" "}
            <span className="text-foreground">per job, in USDC</span>, straight to your wallet.
            No invoices, no platform holding your money.
          </p>

          <div data-hero-cta className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={APP_URL}>Post a job →</Button>
            <Button href={REPO_URL} variant="ghost" external>
              Start earning
            </Button>
          </div>

          <div data-hero-chain className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-dim">
            <span className="mono">npm i -g xorv</span>
            <span className="h-3 w-px bg-white/10" />
            <span>settles in ~3s</span>
            <span className="h-3 w-px bg-white/10" />
            <span>from $0.001 a job</span>
            <span className="h-3 w-px bg-white/10" />
            <span>0% protocol fee</span>
          </div>
        </div>

        <Terminal />
      </div>
    </div>
  );
}

/**
 * A transcript of a real `xorv start` session.
 *
 * Labelled "example session" in the chrome, because it is static markup rather
 * than a live feed. The live numbers are in the strip below the hero, fetched
 * from the broker's public API — so nothing on this page claims traffic that
 * isn't there.
 */
function Terminal() {
  return (
    <div data-hero-term className="card glow-ring overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
        <span className="mono ml-2 text-[11px] text-dim">xorv — provider node</span>
        <span className="ml-auto rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-dim">
          example session
        </span>
      </div>

      <div className="mono space-y-1.5 p-5 text-[12.5px] leading-relaxed">
        <Line>
          <span className="text-violet">$</span> <span className="text-foreground">xorv start</span>
        </Line>
        <Line>
          <span className="text-mint">✔</span>{" "}
          <span className="text-muted">2/2 capabilities ready — Claude Code, Codex</span>
        </Line>
        <Line>
          <span className="text-mint">✔</span>{" "}
          <span className="text-muted">registered as</span>{" "}
          <span className="text-cyan">prv_1LanKLZA8vhK</span>
        </Line>
        <Line>
          <span className="text-mint">✔</span> <span className="text-azure">⛓</span>{" "}
          <span className="text-muted">registration on HCS</span>{" "}
          <span className="text-dim">0.0.9848245</span>
        </Line>
        <Line>
          <span className="text-dim">─────────────────────────────────────</span>
        </Line>
        <Line>
          <span className="text-mint">●</span> <span className="text-foreground">LIVE</span>{" "}
          <span className="text-dim">│</span> <span className="text-muted">nivesh-macbook</span>{" "}
          <span className="text-dim">│</span> <span className="text-muted">beat 3s ago</span>
        </Line>
        <Line>
          <span className="text-mint">◈</span> <span className="text-muted">earned</span>{" "}
          <span className="font-semibold text-mint">$0.0420</span>{" "}
          <span className="text-dim">│</span> <span className="text-mint">42</span>{" "}
          <span className="text-muted">done</span> <span className="text-dim">│</span>{" "}
          <span className="text-cyan">1</span> <span className="text-muted">running</span>
        </Line>
        <Line>
          <span className="text-amber">⚡</span>{" "}
          <span className="text-foreground">job_gBc-RIOAyqW5</span>{" "}
          <span className="text-muted">claude-code</span>{" "}
          <span className="text-mint">$0.0100</span>
        </Line>
        <Line>
          <span className="pl-5 text-dim">Write: src/parser.ts</span>
        </Line>
        <Line>
          <span className="text-mint">✔</span>{" "}
          <span className="text-muted">job done in 8.4s — earned</span>{" "}
          <span className="text-mint">$0.0100</span>
        </Line>
      </div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div data-term-line>{children}</div>;
}
