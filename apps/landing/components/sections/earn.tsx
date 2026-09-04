import { Reveal } from "@/components/ui/reveal";
import { Button, Command, Section, SectionHeading } from "@/components/ui/kit";
import { REPO_URL } from "@/lib/links";

const POINTS = [
  {
    title: "You keep 100%",
    body: "The protocol fee is zero. Payment goes from the buyer's account to yours in a single transfer — Xorv is never the payee, so there is nothing to withhold.",
  },
  {
    title: "You never need HBAR",
    body: "Xorv's facilitator is the fee payer on every settlement. Your account can hold nothing but earnings and still get paid.",
  },
  {
    title: "You set the price",
    body: "Per capability, per job, down to a tenth of a cent. Cheapest matching provider wins the job, so the market decides what idle Claude quota is worth.",
  },
  {
    title: "You stay behind NAT",
    body: "The node opens an outbound socket to the broker. No port forwarding, no inbound surface on your machine. A Cloudflare tunnel is optional, not required.",
  },
];

export function Earn() {
  return (
    <Section id="earn">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <Reveal>
            <SectionHeading
              align="left"
              eyebrow="For providers"
              title={
                <>
                  Ninety seconds from{" "}
                  <span className="grad-brand">install to income</span>
                </>
              }
              sub="Xorv drives the agent CLIs you already have installed and signed in. It doesn't need your API keys, because it never touches an API — it runs the same binary you run."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 space-y-3">
              <Command>npm i -g xorv</Command>
              <Command>xorv init</Command>
              <Command>xorv start</Command>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mt-8">
              <Button href={REPO_URL} external>
                Read the provider guide →
              </Button>
            </div>
          </Reveal>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {POINTS.map((point, i) => (
            <Reveal key={point.title} delay={0.08 * i}>
              <div className="card card-hover h-full p-6">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {point.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
