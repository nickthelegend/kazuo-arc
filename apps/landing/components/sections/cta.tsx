import { Reveal } from "@/components/ui/reveal";
import { Button, Command, Section } from "@/components/ui/kit";
import { APP_URL, REPO_URL } from "@/lib/links";

export function Cta() {
  return (
    <Section className="pb-32">
      <Reveal>
        <div className="card glow-ring relative overflow-hidden px-8 py-16 text-center md:px-16 md:py-20">
          <div className="pointer-events-none absolute inset-0 aurora opacity-70" aria-hidden="true" />
          <div className="relative">
            <h2 className="grad-text mx-auto max-w-2xl text-3xl font-semibold leading-[1.12] tracking-[-0.025em] sm:text-4xl md:text-[2.85rem]">
              There is a subscription sitting idle on your machine right now.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
              Point it at the network and let it pay for itself. One install, one wizard, and it
              starts taking jobs.
            </p>

            <div className="mx-auto mt-9 max-w-md">
              <Command>npm i -g xorv &amp;&amp; xorv init</Command>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button href={APP_URL}>Post a job</Button>
              <Button href={REPO_URL} variant="ghost" external>
                Read the source
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
