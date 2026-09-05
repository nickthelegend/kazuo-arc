import { PostJob } from "@/components/post-job";
import { JobList, ProviderList } from "@/components/live-lists";
import { PageHeader } from "@/components/ui";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Post a job"
        sub="It runs on a stranger's machine, on the AI subscription they already pay for, and they get paid for it — directly, on-chain, per job."
      />

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="space-y-10">
          <PostJob />
          <section>
            <h2 className="mb-3 text-[13px] font-medium text-fg">Recent jobs</h2>
            <JobList />
          </section>
        </div>

        <section>
          <h2 className="mb-3 text-[13px] font-medium text-fg">Live providers</h2>
          <ProviderList />
        </section>
      </div>
    </>
  );
}
