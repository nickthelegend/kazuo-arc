import { Reveal } from "@/components/ui/reveal";

const STATS = [
  { value: "$0.001", label: "smallest job price", note: "a tenth of a cent" },
  { value: "~3s", label: "to settle on Hedera", note: "finality, not confirmations" },
  { value: "0%", label: "protocol fee", note: "providers keep everything" },
  { value: "0 ℏ", label: "gas a buyer needs", note: "the facilitator pays" },
];

/**
 * The four numbers that make the pitch credible, stated without adornment.
 * Each one is a property of the system, not a projection.
 */
export function Stats() {
  return (
    <section className="relative border-y border-[var(--border)] px-6 py-14">
      <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 0.07} y={18}>
            <div>
              <div className="grad-brand text-3xl font-semibold tracking-tight md:text-4xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{stat.label}</div>
              <div className="mt-0.5 text-xs text-dim">{stat.note}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
