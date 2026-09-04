import { PostJob } from "@/components/post-job";
import { JobList, ProviderList } from "@/components/live-lists";
import { PageTitle } from "@/components/ui";

export default function Home() {
  return (
    <>
      <PageTitle
        title="AI capacity, priced per job"
        sub="Post a prompt. The network routes it to a live provider running a real Claude, Codex or Grok subscription — and pays them directly, on-chain, per job."
      />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <PostJob />
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
              Recent jobs
            </h2>
            <JobList />
          </section>
        </div>

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
            Live providers
          </h2>
          <ProviderList />
        </section>
      </div>
    </>
  );
}
