/**
 * The Kazuo domain model.
 *
 * These shapes cross process boundaries — CLI ⇄ broker ⇄ browser — so they are
 * plain JSON-safe data with no class instances and no bigints. Money is carried
 * as integer strings in the asset's smallest unit for the same reason: a job
 * priced at $0.001 must survive a round trip through JSON without a float
 * quietly rounding someone's earnings.
 */

/** Which local agent CLI a provider hands a job to. */
export type AdapterKind =
  | "claude-code"
  | "codex"
  | "grok"
  | "opencode"
  | "openai-compatible"
  | "echo";

/** Every adapter Kazuo knows how to drive, in the order the wizard offers them. */
export const ADAPTER_KINDS: AdapterKind[] = [
  "claude-code",
  "codex",
  "grok",
  "opencode",
  "openai-compatible",
  "echo",
];

/**
 * One sellable unit of capacity: "I will run a job on this agent, for this
 * price". A provider advertises one capability per agent CLI they're sharing.
 */
export interface Capability {
  /** Stable id within the provider, e.g. "claude-code". */
  id: string;
  adapter: AdapterKind;
  /** Human label shown in the job board, e.g. "Claude Code (Opus)". */
  displayName: string;
  /** Model passed through to the CLI, when the provider pinned one. */
  model?: string | null;
  /** Price per job in millionths of a US dollar. $0.01 → 10000. */
  priceUsdMicros: number;
  /** How many jobs of this kind may run at once on this node. */
  maxConcurrency: number;
}

export type ProviderStatus = "online" | "busy" | "offline";

/** A live node on the network, as the broker sees it. */
export interface Provider {
  id: string;
  /** Display name chosen by the operator. */
  label: string;
  /** Arc address that receives USDC for this provider's jobs. */
  address: string;
  /** Publicly reachable base URL of the node (usually a Cloudflare tunnel). */
  endpoint: string;
  capabilities: Capability[];
  status: ProviderStatus;
  /** Jobs in flight right now, across all capabilities. */
  activeJobs: number;
  /** Epoch ms of the last accepted heartbeat. */
  lastHeartbeatAt: number;
  registeredAt: number;
  /** kazuo CLI version, for compatibility triage. */
  version: string;
  /** Free-form region hint the operator set, e.g. "eu-west". */
  region?: string | null;
  stats: ProviderStats;
  /** Transaction hash of the on-chain registration entry, when published. */
  registryTxHash?: string | null;
  /**
   * True when the node proved, with World AgentKit, that its payout address is
   * registered in AgentBook to a real human.
   *
   * The anonymous human id itself never leaves the broker — the boolean is
   * the whole public claim. It matters for a market sorted on reputation: a
   * bot farm can spin up a thousand nodes, but one person cannot back a
   * thousand human-backed nodes.
   */
  humanBacked?: boolean;
}

export interface ProviderStats {
  jobsCompleted: number;
  jobsFailed: number;
  /** Lifetime earnings in micro-USDC (6dp), summed across settled jobs. */
  earnedUsdcMicros: number;
  /** Rolling mean job duration in ms; 0 until the first job lands. */
  avgDurationMs: number;
}

export type JobStatus =
  | "quoted"
  | "paid"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "expired";

/**
 * Which asset a job was paid in.
 *
 * One member, and it stays a union on purpose. On Hedera this was
 * `"usdc" | "hbar"` because the chain had a separate gas token you could also
 * price in. On Arc, USDC *is* the gas token — there is nothing else to be paid
 * in. Keeping the type rather than collapsing it to a string means receipts
 * written under either chain still parse, and a second asset would be an
 * additive change rather than a schema break.
 */
export type PayAsset = "usdc";

/** What the poster asked for. */
export interface JobRequest {
  prompt: string;
  /** Preferred adapter; when null the broker matches on price alone. */
  adapter?: AdapterKind | null;
  /** Ceiling the poster will pay, in micro-USD. */
  maxPriceUsdMicros: number;
  /** Optional label so posters can find their job again. */
  title?: string | null;
  /** Hard deadline in epoch ms; the broker won't assign past it. */
  deadlineAt?: number | null;
  /** Only match providers whose operator is a verified human (World AgentKit). */
  humanBackedOnly?: boolean;
}

/** A single streamed step from the provider while the job runs. */
export interface JobEvent {
  at: number;
  kind: "status" | "message" | "tool_call" | "file_edit" | "error" | "reasoning";
  text: string;
}

/** Proof that a job was paid for, with everything needed to audit it. */
export interface PaymentRecord {
  asset: PayAsset;
  /** ERC-20 contract address of the token that moved. */
  assetId: string;
  /** Amount in the asset's smallest unit (6dp), as an integer string. */
  amount: string;
  network: string;
  /** Hash of the settled transfer. */
  transactionHash: string;
  /** Address debited — the buyer, who signed but never broadcast. */
  payer: string;
  /** Address credited — the provider. */
  payTo: string;
  settledAt: number;
  /** Direct ArcScan link, precomputed so every surface shows the same one. */
  explorerUrl: string;
}

export interface Job {
  id: string;
  request: JobRequest;
  status: JobStatus;
  createdAt: number;
  /** Provider the quote was pinned to; set as soon as the job is quoted. */
  providerId?: string | null;
  providerLabel?: string | null;
  providerAddress?: string | null;
  capabilityId?: string | null;
  /** Agreed price in micro-USD, fixed at quote time. */
  priceUsdMicros?: number | null;
  payment?: PaymentRecord | null;
  assignedAt?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  /** The answer, when the job succeeded. */
  result?: string | null;
  /** sha-256 of `result`, mirrored into the on-chain receipt so it's tamper-evident. */
  resultHash?: string | null;
  error?: string | null;
  events: JobEvent[];
  /** Transaction hash of the on-chain receipt entry, once published. */
  receiptTxHash?: string | null;
  /** The provider that ran it was human-backed at quote time. */
  providerHumanBacked?: boolean;
  /** The buyer (often an agent) proved a human behind it with World AgentKit. */
  buyerHumanBacked?: boolean;
}

// ---------------------------------------------------------------------------
// Wire messages: CLI → broker
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  label: string;
  address: string;
  endpoint: string;
  capabilities: Capability[];
  version: string;
  region?: string | null;
  /** Node's public key fingerprint; the broker echoes it back in the token. */
  nodeId: string;
}

export interface RegisterResponse {
  provider: Provider;
  /** Bearer token the node presents on heartbeat and job callbacks. */
  token: string;
  /** On-chain registration entry, when publishing succeeded. */
  registry?: { contract: string; transactionHash: string; explorerUrl: string } | null;
}

export interface HeartbeatRequest {
  activeJobs: number;
  /** Seconds the node has been up, for the fleet view. */
  uptimeSeconds: number;
  /** Per-capability availability, so a busy adapter can be skipped. */
  available: Record<string, boolean>;
}

export interface HeartbeatResponse {
  ok: true;
  status: ProviderStatus;
  /** Jobs the broker wants this node to pick up right now. */
  pending: DispatchedJob[];
  /** Echoed so a node can tell when the broker restarted and re-register. */
  brokerEpoch: number;
}

/** What a node receives when work is handed to it. */
export interface DispatchedJob {
  jobId: string;
  capabilityId: string;
  prompt: string;
  /** Wall-clock ceiling for this job. */
  timeoutMs: number;
  /** Price the provider will be paid, in micro-USD, for display in the node UI. */
  priceUsdMicros: number;
}

// ---------------------------------------------------------------------------
// Audit-log envelopes
// ---------------------------------------------------------------------------

/**
 * The envelope shape is deliberately unchanged from the Hedera Consensus
 * Service version. The audit format is protocol — a consumer written against
 * the old topics parses these entries without modification, and the only field
 * that moved is the chain-specific transaction identifier inside a receipt.
 */
export type LogMessageKind = "provider.registered" | "provider.heartbeat" | "job.receipt";

export interface LogEnvelope<T> {
  v: number;
  kind: LogMessageKind;
  at: number;
  data: T;
}

export interface LogProviderRegistered {
  providerId: string;
  label: string;
  address: string;
  capabilities: Array<{ id: string; adapter: string; priceUsdMicros: number }>;
  version: string;
}

export interface LogHeartbeat {
  providerId: string;
  activeJobs: number;
  capacity: number;
  uptimeSeconds: number;
}

export interface LogJobReceipt {
  jobId: string;
  providerId: string;
  providerAddress: string;
  payer: string;
  asset: string;
  amount: string;
  transactionHash: string;
  /** sha-256 of the result text, so the payload is auditable without publishing it. */
  resultHash: string;
  durationMs: number;
  ok: boolean;
}
