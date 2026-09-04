import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/kit";
import { CHAIN } from "@/lib/links";

const FLOW = [
  { label: "POST /api/jobs/:quote", note: "no payment attached", tone: "muted" },
  { label: "402 Payment Required", note: "accepts: USDC · HBAR", tone: "amber" },
  { label: "X-PAYMENT: signed transfer", note: "buyer signs, does not submit", tone: "violet" },
  { label: "facilitator adds signature", note: "and pays the gas", tone: "azure" },
  { label: "200 OK + X-PAYMENT-RESPONSE", note: "settled on Hedera", tone: "mint" },
];

const TONE: Record<string, string> = {
  muted: "text-muted border-[var(--border)]",
  amber: "text-amber border-amber/30 bg-amber/[0.06]",
  violet: "text-violet border-violet/30 bg-violet/[0.06]",
  azure: "text-azure border-azure/30 bg-azure/[0.06]",
  mint: "text-mint border-mint/30 bg-mint/[0.06]",
};

export function Payments() {
  return (
    <Section id="payments" className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/3 h-[420px] aurora opacity-60"
        aria-hidden="true"
      />

      <Reveal>
        <SectionHeading
          eyebrow="Payments"
          title={
            <>
              Real money, <span className="grad-brand">no checkout</span>
            </>
          }
          sub="Every job on Xorv is a genuine on-chain transfer. There is no credit system, no off-chain balance, and no moment where the network is holding your funds."
        />
      </Reveal>

      <Reveal delay={0.08}>
        <div className="relative mt-14 card p-6 md:p-8">
          <ol className="grid gap-3 md:grid-cols-5">
            {FLOW.map((step, i) => (
              <li key={step.label} className="relative">
                <div
                  className={`mono rounded-xl border px-3 py-3 text-[11.5px] leading-snug ${TONE[step.tone]}`}
                >
                  {step.label}
                </div>
                <p className="mt-2 px-1 text-[11px] leading-snug text-dim">{step.note}</p>
                {i < FLOW.length - 1 ? (
                  <span
                    className="pointer-events-none absolute -right-2 top-5 hidden text-dim md:block"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Reveal delay={0.04}>
          <div className="card card-hover h-full p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Buyers never hold gas</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Hedera&rsquo;s x402 scheme lets a third party pay the network fee. Xorv runs its own
              facilitator, so a buyer with nothing but USDC can transact. That removes the single
              most common reason a crypto payment fails for a normal person.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card card-hover h-full p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Paid up front, insured by the network</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              A signed Hedera transaction is only valid for 180 seconds, so settling after a long
              job would leave providers unpaid. Xorv settles first — and if a provider fails, the
              job is reassigned to another one at no extra charge.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.16}>
          <div className="card card-hover h-full p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Auditable by anyone</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted">
              Registrations, heartbeats and receipts are written to Hedera Consensus Service. You
              don&rsquo;t have to trust the broker&rsquo;s database — read the topics yourself.
            </p>
            <div className="mono mt-4 space-y-1.5 text-[11px]">
              {Object.entries(CHAIN.topics).map(([kind, id]) => (
                <a
                  key={kind}
                  href={CHAIN.topicUrl(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-dim transition-colors hover:text-cyan"
                >
                  <span>{kind}</span>
                  <span>{id} ↗</span>
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
