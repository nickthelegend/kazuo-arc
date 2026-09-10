/**
 * Typed access to the broker.
 *
 * The browser reads freely — providers, jobs, receipts are all public — but it
 * never signs with a server key. A connected wallet signs in the tab (see
 * lib/pay-with-wallet.ts); the fallback for a visitor without one goes through
 * a server route holding the demo account (see app/api/pay/route.ts).
 */

export const BROKER_URL = (
  process.env.NEXT_PUBLIC_KAZUO_BROKER_URL ?? "http://localhost:8402"
).replace(/\/+$/, "");

export const NETWORK = process.env.NEXT_PUBLIC_KAZUO_NETWORK ?? "eip155:5042002";

export interface Capability {
  id: string;
  adapter: string;
  displayName: string;
  model: string | null;
  priceUsdMicros: number;
  maxConcurrency: number;
}

export interface Provider {
  id: string;
  label: string;
  address: string;
  addressUrl: string;
  endpoint: string;
  status: "online" | "busy" | "offline";
  connected: boolean;
  activeJobs: number;
  capabilities: Capability[];
  lastHeartbeatAt: number;
  registeredAt: number;
  uptimeSeconds: number;
  version: string;
  region: string | null;
  stats: {
    jobsCompleted: number;
    jobsFailed: number;
    earnedUsdcMicros: number;
    avgDurationMs: number;
  };
  /** Operator proved a real human is behind the payout address (World AgentKit). */
  humanBacked?: boolean;
}

export interface PaymentRecord {
  asset: "usdc";
  assetId: string;
  amount: string;
  network: string;
  transactionHash: string;
  payer: string;
  payTo: string;
  settledAt: number;
  explorerUrl: string;
}

export interface JobEvent {
  at: number;
  kind: "status" | "message" | "tool_call" | "file_edit" | "error" | "reasoning";
  text: string;
}

export interface Job {
  id: string;
  title: string | null;
  prompt: string;
  adapter: string | null;
  status: "quoted" | "paid" | "assigned" | "running" | "completed" | "failed" | "expired";
  createdAt: number;
  assignedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  providerId: string | null;
  providerLabel: string | null;
  providerAddress: string | null;
  priceUsdMicros: number | null;
  priceLabel: string | null;
  payment: PaymentRecord | null;
  result: string | null;
  resultHash: string | null;
  error: string | null;
  receiptTxHash: string | null;
  /** The provider was human-backed (World AgentKit) when the job was quoted. */
  providerHumanBacked?: boolean;
  /** The buyer — often an agent — proved a human behind it. */
  buyerHumanBacked?: boolean;
  eventCount: number;
  events?: JobEvent[];
}

export interface NetworkInfo {
  network: string;
  facilitator: { mode: string; description: string; feePayer: string };
  operator: { address: string; url: string };
  usdc: string;
  log: { address: string; url: string } | null;
  logPublished: { registry: number; heartbeat: number; receipts: number };
  logLastError: string | null;
  stats: {
    providersLive: number;
    providersConnected: number;
    capacity: number;
    jobsTotal: number;
    jobsCompleted: number;
    paidUsdMicros: number;
  };
  heartbeatIntervalMs: number;
}

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BROKER_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

export const api = {
  network: () => get<NetworkInfo>("/api/network"),
  providers: () => get<{ providers: Provider[] }>("/api/providers").then((r) => r.providers),
  jobs: (limit = 25) => get<{ jobs: Job[] }>(`/api/jobs?limit=${limit}`).then((r) => r.jobs),
  job: (id: string) => get<{ job: Job }>(`/api/jobs/${id}`).then((r) => r.job),
  receipts: () =>
    get<{
      log: { address: string; url: string } | null;
      receipts: Array<{
        sequence: number;
        blockNumber: number;
        transactionHash: string;
        author: string;
        payload: unknown;
      }>;
    }>(
      "/api/receipts",
    ),
};

/** micro-USD → "$0.0010". Mirrors the CLI's formatting so numbers agree. */
export function formatUsd(micros: number | null | undefined): string {
  if (micros == null) return "—";
  const dollars = micros / 1_000_000;
  if (dollars === 0) return "$0";
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4)}`;
}

export function formatAgo(epochMs: number, now = Date.now()): string {
  const delta = Math.max(0, now - epochMs);
  if (delta < 2_000) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  return `${Math.round(delta / 86_400_000)}d ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** ArcScan base for the configured network. */
function explorerBase(): string {
  return NETWORK === "eip155:5042" ? "https://arcscan.app" : "https://testnet.arcscan.app";
}

export function explorerAddress(address: string): string {
  return `${explorerBase()}/address/${address}`;
}

/**
 * ArcScan link for a transaction.
 *
 * A plain hash, appended. Its Hedera predecessor had to rewrite the separators
 * first — the SDK renders a transaction id as `0.0.123@1699.000000000` and
 * HashScan wants `0.0.123-1699-000000000` — which is the kind of formatting
 * detail that silently produces 404 links when someone forgets it.
 */
export function explorerTx(transactionHash: string): string {
  return `${explorerBase()}/tx/${transactionHash}`;
}
