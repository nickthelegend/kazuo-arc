import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/kit";

const STEPS = [
  {
    n: "01",
    title: "Someone posts a job",
    body: "A prompt, a preferred model, a price ceiling. The broker matches it to the cheapest live provider that can run it — liveness proven by heartbeat, not by a status page.",
    accent: "from-violet/25",
  },
  {
    n: "02",
    title: "The network quotes a price",
    body: "The quote pins one provider at one price, and answers HTTP 402 with the exact amounts — payable in USDC or HBAR, the buyer's choice.",
    accent: "from-indigo/25",
  },
  {
    n: "03",
    title: "The buyer signs a transfer",
    body: "A real Hedera TransferTransaction, signed but unsubmitted. Xorv's facilitator adds the second signature and pays the gas, so the buyer only ever needs the stablecoin.",
    accent: "from-azure/25",
  },
  {
    n: "04",
    title: "Money moves, then the job runs",
    body: "Settlement lands in about three seconds — straight from buyer to provider. The broker never takes custody. Then the job is dispatched to that node and streams back live.",
    accent: "from-cyan/25",
  },
  {
    n: "05",
    title: "A receipt goes on-chain",
    body: "Job id, provider, amount, transaction id and a SHA-256 of the result are written to a Hedera Consensus Service topic — public, ordered, append-only.",
    accent: "from-mint/25",
  },
];

export function How() {
  return (
    <Section id="how">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              A job, a payment and a receipt —{" "}
              <span className="grad-brand">in one request</span>
            </>
          }
          sub="x402 turns HTTP 402 Payment Required from a status code nobody used into a working payment rail. Xorv runs the whole loop on Hedera."
        />
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} delay={i * 0.06}>
            <div
              className={`card card-hover relative h-full overflow-hidden p-6 ${
                i === 0 ? "lg:col-span-2" : ""
              }`}
            >
              <div
                className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${step.accent} to-transparent blur-2xl`}
                aria-hidden="true"
              />
              <div className="mono relative text-xs font-semibold text-violet">{step.n}</div>
              <h3 className="relative mt-3 text-lg font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="relative mt-2.5 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
