/**
 * The audit trail's wire format.
 *
 * These are the parts a third party has to agree with us on to verify the
 * record independently: what a `kind` number means, how a `subject` is derived,
 * and what an envelope looks like. Get any of them wrong and the log is still
 * "on chain" while being unreadable by anyone who did not write it — which is
 * the same as not having one.
 */

import { describe, expect, it } from "vitest";
import { envelope, kindName, kindNumber, subjectOf } from "../src/log.js";
import { LOG_KIND, LOG_SCHEMA_VERSION } from "../src/constants.js";
import type { LogMessageKind } from "../src/types.js";

const KINDS: LogMessageKind[] = ["provider.registered", "provider.heartbeat", "job.receipt"];

describe("envelope", () => {
  it("stamps the schema version, so a consumer can evolve safely", () => {
    const e = envelope("job.receipt", { jobId: "job_abc" });
    expect(e.v).toBe(LOG_SCHEMA_VERSION);
    expect(e.kind).toBe("job.receipt");
    expect(e.data).toEqual({ jobId: "job_abc" });
  });

  it("carries a wall-clock timestamp distinct from the block's", () => {
    // The chain supplies ordering; this records when the *writer* believed the
    // event happened, which is what a heartbeat is actually asserting.
    const before = Date.now();
    const e = envelope("provider.heartbeat", {});
    expect(e.at).toBeGreaterThanOrEqual(before);
  });
});

describe("kind discriminators", () => {
  it("matches the contract's KIND_ constants exactly", () => {
    expect(kindNumber("provider.registered")).toBe(LOG_KIND.registration);
    expect(kindNumber("provider.heartbeat")).toBe(LOG_KIND.heartbeat);
    expect(kindNumber("job.receipt")).toBe(LOG_KIND.receipt);
  });

  it("round-trips every kind through the number and back", () => {
    for (const kind of KINDS) {
      expect(kindName(kindNumber(kind))).toBe(kind);
    }
  });

  it("never emits 0, which the contract rejects", () => {
    // `append` reverts on an unknown kind. A zero would be an entry that costs
    // gas and lands nowhere, so the mapping must not be able to produce one.
    for (const kind of KINDS) expect(kindNumber(kind)).toBeGreaterThan(0);
  });

  it("returns null for a kind written by something that isn't us", () => {
    expect(kindName(0)).toBeNull();
    expect(kindName(99)).toBeNull();
  });
});

describe("subjectOf", () => {
  it("is deterministic, so a reader can reconstruct the topic to filter by", () => {
    // This is the whole reason the subject is hashed explicitly rather than
    // left to the EVM: a caller who knows the job id can compute the same
    // 32 bytes and query for it.
    expect(subjectOf("job_LOqvjZ2Pj3u7")).toBe(subjectOf("job_LOqvjZ2Pj3u7"));
  });

  it("produces a 32-byte topic", () => {
    expect(subjectOf("prv_abc")).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("separates different ids", () => {
    expect(subjectOf("job_a")).not.toBe(subjectOf("job_b"));
  });
});
