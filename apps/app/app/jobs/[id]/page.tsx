import Link from "next/link";
import { JobView } from "@/components/job-view";
import { api, type Job } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetched server-side so the page has content on first paint even if the
  // event stream never connects; the client takes over from there.
  let initial: Job | null = null;
  try {
    initial = await api.job(id);
  } catch {
    initial = null;
  }

  return (
    <>
      <Link href="/" className="mb-5 inline-block text-xs text-muted transition-colors hover:text-foreground">
        ← all jobs
      </Link>
      <JobView jobId={id} initial={initial} />
    </>
  );
}
