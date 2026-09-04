"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

/**
 * The questions a careful person actually asks before running this.
 *
 * Including the uncomfortable ones. A provider is about to run prompts from
 * strangers against a paid account on their own laptop; pretending that has no
 * downside would be the fastest way to lose their trust.
 */
const FAQ = [
  {
    q: "Is this against my AI provider's terms of service?",
    a: "Possibly — check yours. Most consumer AI subscriptions are licensed to an individual, and reselling that capacity to third parties may breach them. Xorv is infrastructure and doesn't decide this for you: run it against quota you're entitled to share, a team or enterprise plan that permits it, or your own local models via the OpenAI-compatible adapter.",
  },
  {
    q: "What can a stranger's prompt do to my machine?",
    a: "Each job runs in a fresh empty directory under ~/.xorv/jobs, which is deleted when the job ends, and that directory is the agent's working directory. But these CLIs can run shell commands, and a shell command can leave a directory — so this is a blast-radius reduction, not a sandbox. Run the node in a container or VM if you want a real boundary, or set XORV_SAFE_MODE=1 to disable tools entirely and sell text generation only.",
  },
  {
    q: "How do I get paid if I hold no HBAR?",
    a: "You don't need any. Xorv runs its own x402 facilitator, which signs as fee payer and covers the network fee on every settlement. Your account needs only to be associated with USDC — one command, `xorv wallet associate` — and it can then receive payments with a zero HBAR balance.",
  },
  {
    q: "What stops a provider taking the money and not doing the work?",
    a: "Payment settles before the job runs, because a signed Hedera transaction expires after 180 seconds and a five-minute job would outlive it. The protection is at the network level: a failed job is reassigned to another provider at no extra cost to the buyer, and the failure is recorded against the original provider's success rate, which is what the matcher sorts on.",
  },
  {
    q: "Why Hedera rather than an EVM chain?",
    a: "Three properties this specifically needs: fixed, predictable fees measured in hundredths of a cent, so a $0.001 job isn't eaten by gas; finality in about three seconds, so the buyer isn't waiting on confirmations; and a native fee-payer model, which is what lets buyers transact without holding the gas token. Consensus Service also gives an ordered public audit log without deploying a contract.",
  },
  {
    q: "Do I need a Cloudflare tunnel?",
    a: "No. The node opens an outbound WebSocket to the broker, so jobs reach it from behind NAT with no inbound ports. `xorv start --tunnel` adds a public URL if you want one — it gives your node a status page anyone can health-check, and gives the broker a second delivery path — but earnings don't depend on it.",
  },
  {
    q: "Is the broker a middleman that can take a cut?",
    a: "It isn't the payee. The 402 response names the matched provider's own Hedera account as payTo, so funds move directly from buyer to provider in one transfer and the broker never has custody. The protocol fee is currently zero.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq">
      <Reveal>
        <SectionHeading
          eyebrow="FAQ"
          title="The questions worth asking"
          sub="Including the ones with awkward answers."
        />
      </Reveal>

      <div className="mx-auto mt-14 max-w-3xl space-y-3">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={Math.min(i * 0.04, 0.2)}>
              <div className={cn("card overflow-hidden transition-colors", isOpen && "border-[var(--border-strong)]")}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[15px] font-medium text-foreground">{item.q}</span>
                  <span
                    className={cn(
                      "shrink-0 text-lg text-muted transition-transform duration-300",
                      isOpen && "rotate-45 text-violet",
                    )}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
