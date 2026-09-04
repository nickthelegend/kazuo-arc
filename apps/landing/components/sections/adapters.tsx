import { Reveal } from "@/components/ui/reveal";
import { Section, SectionHeading } from "@/components/ui/kit";

const ADAPTERS = [
  {
    name: "Claude Code",
    id: "claude-code",
    detail: "Streams tool calls, file edits and extended thinking back to the buyer as the job runs.",
    live: true,
  },
  {
    name: "Codex",
    id: "codex",
    detail: "Found on PATH or inside Codex.app. Reports shell commands and file changes per turn.",
    live: true,
  },
  {
    name: "Grok Code",
    id: "grok",
    detail: "Answer plus reasoning. Grok's headless mode reports no tool steps, so Xorv claims none.",
    live: true,
  },
  {
    name: "OpenCode",
    id: "opencode",
    detail: "Any provider OpenCode is configured against, driven through its run command.",
    live: true,
  },
  {
    name: "OpenAI-compatible",
    id: "openai-compatible",
    detail: "Ollama, LM Studio, vLLM, OpenRouter, or an internal gateway. Sell a local GPU too.",
    live: true,
  },
  {
    name: "Echo",
    id: "echo",
    detail: "Built in, always available. Exercises the entire payment path with nothing installed.",
    live: false,
  },
];

export function Adapters() {
  return (
    <Section id="adapters">
      <Reveal>
        <SectionHeading
          eyebrow="Adapters"
          title={
            <>
              Sell whatever you&rsquo;ve{" "}
              <span className="grad-brand">already got</span>
            </>
          }
          sub="An adapter drives a CLI you have installed and signed in. Xorv never asks for an API key, because it never calls an API on your behalf."
        />
      </Reveal>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADAPTERS.map((adapter, i) => (
          <Reveal key={adapter.id} delay={i * 0.05}>
            <div className="card card-hover h-full p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {adapter.name}
                </h3>
                {adapter.live ? (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/[0.07] px-2 py-0.5 text-[10px] font-medium text-mint">
                    <span className="h-1 w-1 rounded-full bg-mint" />
                    live
                  </span>
                ) : (
                  <span className="mt-0.5 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-dim">
                    test
                  </span>
                )}
              </div>
              <p className="mono mt-1 text-[11px] text-dim">{adapter.id}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{adapter.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-8 text-center text-sm text-dim">
          Writing a new adapter is one class with two methods —{" "}
          <span className="mono text-muted">available()</span> and{" "}
          <span className="mono text-muted">run()</span>.
        </p>
      </Reveal>
    </Section>
  );
}
