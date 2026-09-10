/**
 * The chain side of the broker: the audit trail, and the money.
 *
 * Two responsibilities that both need the operator's key, kept together so
 * there is exactly one place in the process that can sign.
 *
 * ## One client, not two
 *
 * The Hedera version of this file ran two SDK clients on purpose, and the
 * comment explaining why was the longest in the codebase: the facilitator and
 * the audit writer could not share one, because `TopicMessageSubmitTransaction`
 * is chunked and re-freezes itself inside `executeAll`, so a concurrent
 * settlement mutating the client underneath it produced an intermittent
 * "transaction must have been frozen" on a call that succeeded in isolation.
 *
 * viem clients hold no per-transaction state. Both jobs use the same wallet
 * client, and the class of bug is gone rather than worked around. What remains
 * is ordinary nonce management, which the RPC handles.
 */

import {
  appendEntrySafe,
  envelope,
  explorerAddress,
  explorerTx,
  logAddress,
  readClient,
  writeClient,
  type LogHeartbeat,
  type LogJobReceipt,
  type LogMessageKind,
  type LogProviderRegistered,
  type Provider,
} from "@xorv/protocol";
import type { PublicClient, WalletClient } from "viem";
import type { BrokerConfig } from "./config.js";

export interface PublishResult {
  contract: string;
  transactionHash: string;
  explorerUrl: string;
  blockNumber?: string;
}

/**
 * What the HTTP layer actually needs from the chain.
 *
 * Stated as an interface so the app can be booted against a stub in tests. The
 * alternative — reaching for the real `Chain` — means every integration test
 * needs a funded account and a network round-trip, which is a good way to end
 * up with no integration tests at all.
 */
export interface ChainLike {
  readonly network: string;
  readonly operatorAddress: string;
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  describeLog(): { address: string; url: string } | null;
  counts(): { registry: number; heartbeat: number; receipts: number };
  lastPublishError(): string | null;
  publishRegistration(provider: Provider): Promise<PublishResult | null>;
  publishHeartbeat(data: LogHeartbeat): Promise<PublishResult | null>;
  publishReceipt(data: LogJobReceipt): Promise<PublishResult | null>;
  close(): void;
}

export class Chain implements ChainLike {
  readonly publicClient: PublicClient;
  readonly walletClient: WalletClient;
  readonly network: string;
  readonly operatorAddress: string;
  private readonly contract: string | null;
  /** Publish failures, kept for /api/network so a misconfig is visible. */
  private lastError: string | null = null;
  private published = { registry: 0, heartbeat: 0, receipts: 0 };

  constructor(config: BrokerConfig) {
    this.network = config.network;
    this.operatorAddress = config.operatorAddress;
    this.contract = config.logAddress ?? logAddress();
    this.publicClient = readClient(config.network);
    this.walletClient = writeClient(config.network, config.operatorKey);
  }

  /** The log contract plus its ArcScan link, for the network panel. */
  describeLog(): { address: string; url: string } | null {
    return this.contract
      ? { address: this.contract, url: explorerAddress(this.network, this.contract) }
      : null;
  }

  counts(): { registry: number; heartbeat: number; receipts: number } {
    return { ...this.published };
  }

  lastPublishError(): string | null {
    return this.lastError;
  }

  private async publish(
    kind: LogMessageKind,
    subject: string,
    data: unknown,
    counter: keyof typeof this.published,
  ): Promise<PublishResult | null> {
    const contract = this.contract;
    const result = await appendEntrySafe(
      { wallet: this.walletClient, public: this.publicClient },
      contract,
      kind,
      subject,
      envelope(kind, data),
      (err) => {
        this.lastError = `${kind}: ${err.message}`;
        console.error(`[broker] audit ${kind} publish failed:`, err.stack ?? err.message);
      },
    );
    if (!result || !contract) return null;
    this.published[counter] += 1;
    return {
      contract,
      transactionHash: result.transactionHash,
      explorerUrl: explorerTx(this.network, result.transactionHash),
      blockNumber: result.blockNumber,
    };
  }

  /** Announce a provider joining the network. */
  async publishRegistration(provider: Provider): Promise<PublishResult | null> {
    const data: LogProviderRegistered = {
      providerId: provider.id,
      label: provider.label.slice(0, 64),
      address: provider.address,
      capabilities: provider.capabilities.map((c) => ({
        id: c.id,
        adapter: c.adapter,
        priceUsdMicros: c.priceUsdMicros,
      })),
      version: provider.version,
    };
    return this.publish("provider.registered", provider.id, data, "registry");
  }

  /**
   * Record a liveness beat.
   *
   * Not every beat: at one entry per provider per 15s this would be several
   * thousand transactions a day per node, which is noise rather than evidence —
   * and unlike a Hedera topic message, every one of them costs gas. The caller samples (see
   * `HEARTBEAT_PUBLISH_EVERY`) so the log carries a periodic, checkable proof of
   * uptime without paying to write a heartbeat nobody will ever read.
   */
  async publishHeartbeat(data: LogHeartbeat): Promise<PublishResult | null> {
    return this.publish("provider.heartbeat", data.providerId, data, "heartbeat");
  }

  /** Record what a job paid, and to whom. */
  async publishReceipt(data: LogJobReceipt): Promise<PublishResult | null> {
    return this.publish("job.receipt", data.jobId, data, "receipts");
  }

  close(): void {
    // viem clients hold an HTTP transport with no long-lived socket to release.
    // Kept on the interface so the shutdown path is identical across chains.
  }
}
